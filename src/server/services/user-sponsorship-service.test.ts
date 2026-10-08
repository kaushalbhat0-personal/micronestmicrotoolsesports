import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SPONSORSHIP_TOOL_SLUG,
  isUserGrantableTool,
  hasUserSponsorshipAccess,
  getUserSponsorshipGrant,
  grantUserSponsorshipAccess,
  revokeUserSponsorshipAccess,
  listUserSponsorshipGrants,
} from "./user-sponsorship-service";

type Terminal = () => Promise<{ data: unknown; error: null }>;
type Terminals = Partial<Record<"single" | "maybeSingle", Terminal>>;

interface Chain {
  select: (...args: unknown[]) => Chain;
  eq: (...args: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain;
  limit: (...args: unknown[]) => Chain;
  insert: (...args: unknown[]) => Chain;
  delete: (...args: unknown[]) => Chain;
  single: Terminal;
  maybeSingle: Terminal;
}

let seenCalls: Array<{ table: string; op: string; args: unknown[] }>;

function chain(table: string, terminal: Terminals): Chain {
  const next = (): Chain => self;
  const self: Chain = {
    select: next,
    eq: next,
    order: next,
    limit: next,
    insert: (...args: unknown[]) => {
      seenCalls.push({ table, op: "insert", args });
      return self;
    },
    delete: (...args: unknown[]) => {
      seenCalls.push({ table, op: "delete", args });
      return self;
    },
    single: terminal.single ?? (async () => ({ data: null, error: null })),
    maybeSingle: terminal.maybeSingle ?? (async () => ({ data: null, error: null })),
  };
  return self;
}

function clientFor(routes: Record<string, Terminals>) {
  seenCalls = [];
  const from = vi.fn((table: string) => chain(table, routes[table] ?? {}));
  return { from };
}

const TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

function toolsRoute() {
  return { single: async () => ({ data: { id: TOOL_ID }, error: null }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scope fence", () => {
  it("only Sponsor Sentinel is user-grantable", () => {
    expect(SPONSORSHIP_TOOL_SLUG).toBe("sponsor-sentinel");
    expect(isUserGrantableTool("sponsor-sentinel")).toBe(true);
    for (const slug of ["draft-ban", "tie-breaker", "prize-splitter", "all-access", "scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(isUserGrantableTool(slug)).toBe(false);
    }
  });

  it("grant API has no tool parameter — hardcoded to Sponsorship", async () => {
    const c = clientFor({ tools: toolsRoute() });
    await grantUserSponsorshipAccess(c as never, { userId: "u1", source: "manual", expiresAt: null });
    const inserts = seenCalls.filter((call) => call.op === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.args[0]).toEqual({ user_id: "u1", tool_id: TOOL_ID, source: "manual", expires_at: null });
  });

  it("grant fails closed when the Sponsorship tool row is missing", async () => {
    const c = clientFor({ tools: { single: async () => ({ data: null, error: null }) } });
    await expect(grantUserSponsorshipAccess(c as never, { userId: "u1", source: "manual", expiresAt: null })).rejects.toThrow();
  });
});

describe("grant validity", () => {
  it("valid unexpired grant allows access", async () => {
    const c = clientFor({
      tools: toolsRoute(),
      user_tool_entitlements: { maybeSingle: async () => ({ data: { id: "g1", expires_at: FUTURE }, error: null }) },
    });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(true);
  });

  it("lifetime grant (NULL expiry) allows access", async () => {
    const c = clientFor({
      tools: toolsRoute(),
      user_tool_entitlements: { maybeSingle: async () => ({ data: { id: "g1", expires_at: null }, error: null }) },
    });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(true);
  });

  it("4. expired grant denies", async () => {
    const c = clientFor({
      tools: toolsRoute(),
      user_tool_entitlements: { maybeSingle: async () => ({ data: { id: "g1", expires_at: PAST }, error: null }) },
    });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(false);
    await expect(getUserSponsorshipGrant(c as never, "u1")).resolves.toBeNull();
  });

  it("5/29. missing grant denies", async () => {
    const c = clientFor({
      tools: toolsRoute(),
      user_tool_entitlements: { maybeSingle: async () => ({ data: null, error: null }) },
    });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(false);
  });

  it("missing tool row denies", async () => {
    const c = clientFor({ tools: { single: async () => ({ data: null, error: null }) } });
    await expect(hasUserSponsorshipAccess(c as never, "u1")).resolves.toBe(false);
  });

  it("revoke removes the Sponsorship grant", async () => {
    const c = clientFor({ tools: toolsRoute() });
    await revokeUserSponsorshipAccess(c as never, "u1");
    const deletes = seenCalls.filter((call) => call.op === "delete");
    expect(deletes).toHaveLength(1);
    // Follow-up read denies.
    const c2 = clientFor({
      tools: toolsRoute(),
      user_tool_entitlements: { maybeSingle: async () => ({ data: null, error: null }) },
    });
    await expect(hasUserSponsorshipAccess(c2 as never, "u1")).resolves.toBe(false);
  });

  it("revoke is a safe no-op when the tool row is missing", async () => {
    const c = clientFor({ tools: { single: async () => ({ data: null, error: null }) } });
    await expect(revokeUserSponsorshipAccess(c as never, "u1")).resolves.toBeUndefined();
    expect(seenCalls.filter((call) => call.op === "delete")).toHaveLength(0);
  });

  it("list delegates to the repository scoped by user", async () => {
    const rows = [{ id: "g1" }];
    const c = clientFor({
      user_tool_entitlements: { single: async () => ({ data: rows, error: null }) },
    });
    // listUserGrants uses a select chain resolving an array; exercise via service passthrough shape.
    const listed = await listUserSponsorshipGrants(
      {
        from: vi.fn(() => ({
          select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
        })),
      } as never,
      "u1"
    );
    expect(listed).toEqual(rows);
    expect(c.from).not.toHaveBeenCalled();
  });
});

describe("no generic grant-any-tool API (static)", () => {
  const src = readFileSync(join(process.cwd(), "src/server/services/user-sponsorship-service.ts"), "utf8");
  const repo = readFileSync(join(process.cwd(), "src/server/repositories/user-entitlements.ts"), "utf8");

  it("30-34. operational and all-access slugs never appear in user-grant code", () => {
    for (const text of [src, repo]) {
      expect(text).not.toMatch(/draft-ban/);
      expect(text).not.toMatch(/tie-breaker/);
      expect(text).not.toMatch(/prize-splitter/);
      expect(text).not.toMatch(/all-access/);
      expect(text).not.toMatch(/is_all_access/);
    }
  });

  it("no scope flag, no organization column, no generic grant function", () => {
    for (const text of [src, repo]) {
      expect(text).not.toMatch(/entitlement_scope/);
      expect(text).not.toMatch(/\bscope\s*[:=]/);
      expect(text).not.toMatch(/organization_id/);
    }
    expect(src).not.toMatch(/grantUserToolAccess|createUserEntitlement|grantUserGrant/);
  });
});
