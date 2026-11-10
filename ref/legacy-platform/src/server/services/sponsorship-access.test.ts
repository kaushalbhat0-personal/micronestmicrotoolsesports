import { describe, expect, it, vi, beforeEach } from "vitest";
import { hasSponsorshipAccessForOrg } from "./sponsorship-access";

const SPONSOR_TOOL_ID = "tool-sponsor-id";
const FUTURE = new Date(Date.now() + 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

type Fixture = {
  rpcAccess?: boolean | null;
  orgRows?: Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>;
  ownerId?: string | null;
  ownerMembers?: string[];
  userGrants?: Record<string, { expires_at: string | null } | null>;
  userGrantsError?: unknown;
};

function clientFor(fx: Fixture) {
  const eqArgs: Array<{ col: string; val: unknown }> = [];
  let inArgs: { col: string; vals: unknown[] } | null = null;
  let lastTable = "";
  const chain = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {};
    self.select = () => self;
    self.eq = (col: string, val: unknown) => {
      eqArgs.push({ col, val });
      return self;
    };
    self.in = (col: string, vals: unknown[]) => {
      inArgs = { col, vals };
      return self;
    };
    self.order = () => self;
    self.limit = () => self;
    const userGrantFor = (userId: unknown) => {
      const g = (fx.userGrants ?? {})[String(userId)];
      if (fx.userGrantsError) throw fx.userGrantsError;
      return { data: g ?? null, error: null };
    };
    self.single = async () => {
      if (lastTable === "tools") return { data: { id: SPONSOR_TOOL_ID }, error: null };
      if (lastTable === "organizations") return { data: fx.ownerId ? { owner_id: fx.ownerId } : null, error: null };
      if (lastTable === "user_tool_entitlements") {
        const uid = eqArgs.filter((a) => a.col === "user_id").pop()?.val;
        return userGrantFor(uid);
      }
      return { data: null, error: null };
    };
    self.maybeSingle = self.single;
    self.then = (resolve: (v: unknown) => void) => {
      if (lastTable === "tool_entitlements") resolve({ data: fx.orgRows ?? [], error: null });
      else if (lastTable === "organization_members")
        resolve({ data: (fx.ownerMembers ?? []).map((user_id) => ({ user_id })), error: null });
      else if (lastTable === "user_tool_entitlements") {
        if (fx.userGrantsError) throw fx.userGrantsError;
        const wanted = inArgs && inArgs.col === "user_id" ? new Set((inArgs.vals as unknown[]).map(String)) : null;
        const rows = Object.entries(fx.userGrants ?? {})
          .filter(([uid, g]) => g !== null && (!wanted || wanted.has(uid)))
          .map(([user_id, g]) => ({ user_id, expires_at: (g as { expires_at: string | null }).expires_at }));
        resolve({ data: rows, error: null });
      } else resolve({ data: null, error: null });
    };
    return self;
  };
  return {
    rpc: vi.fn(async () => ({ data: fx.rpcAccess ?? null, error: null })),
    from: vi.fn((table: string) => {
      lastTable = table;
      return chain();
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasSponsorshipAccessForOrg — background coverage", () => {
  it("legacy org grant (RPC) → covered", async () => {
    await expect(hasSponsorshipAccessForOrg(clientFor({ rpcAccess: true }) as never, "org-a")).resolves.toBe(true);
  });

  it("legacy per-tool org row (RPC unavailable) → covered", async () => {
    const c = clientFor({ rpcAccess: null, orgRows: [{ is_all_access: false, tool_id: SPONSOR_TOOL_ID, expires_at: null }] });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(true);
  });

  it("all-access org row → covered", async () => {
    const c = clientFor({ rpcAccess: null, orgRows: [{ is_all_access: true, tool_id: null, expires_at: null }] });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(true);
  });

  it("new org, entitled owner (lifetime grant) → covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", userGrants: { "owner-1": { expires_at: null } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-new")).resolves.toBe(true);
  });

  it("owner via role membership (owner_id differs) → covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", ownerMembers: ["owner-2"], userGrants: { "owner-2": { expires_at: FUTURE } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(true);
  });

  it("expired owner grant → not covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", userGrants: { "owner-1": { expires_at: PAST } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(false);
  });

  it("ordinary member grant alone → not covered (members never consulted)", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", ownerMembers: [], userGrants: { "member-9": { expires_at: FUTURE } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(false);
  });

  it("caller leg: entitled caller without org/owner grant → covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", userGrants: { "caller-1": { expires_at: FUTURE } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a", "caller-1")).resolves.toBe(true);
  });

  it("caller leg: expired caller grant → not covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", userGrants: { "caller-1": { expires_at: PAST } } });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a", "caller-1")).resolves.toBe(false);
  });

  it("new org, nobody entitled → not covered", async () => {
    const c = clientFor({ rpcAccess: false, orgRows: [], ownerId: "owner-1", userGrants: {} });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-new")).resolves.toBe(false);
  });

  it("missing user-grant table fails closed, never throws", async () => {
    const c = clientFor({
      rpcAccess: false,
      orgRows: [],
      ownerId: "owner-1",
      userGrantsError: { code: "42P01", message: 'relation "public.user_tool_entitlements" does not exist' },
    });
    await expect(hasSponsorshipAccessForOrg(c as never, "org-a")).resolves.toBe(false);
  });

  it("never consults operational tools (static)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/server/services/sponsorship-access.ts"), "utf8");
    expect(src).toContain("SPONSORSHIP_TOOL_SLUG");
    // No operational/all-access tool SLUG is ever queried (prose mentions of
    // the org-level all-access flag are fine — legacy all-access org rows
    // must keep working).
    for (const slug of ["draft-ban", "tie-breaker", "prize-splitter"]) {
      expect(src).not.toContain(`"${slug}"`);
      expect(src).not.toContain(`'${slug}'`);
    }
    expect(src).not.toMatch(/["']all-access["']/);
  });
});
