import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockRequireUser = vi.fn();
const mockRequireOrganizationMember = vi.fn();

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: (...args: unknown[]) => mockRequireUser(...args),
  getCurrentUser: (...args: unknown[]) => mockRequireUser(...args),
}));

vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: (...args: unknown[]) => mockRequireOrganizationMember(...args),
}));

import {
  getPrimaryOrganizationForUser,
  setPrimaryOrganizationForUser,
  resolveDisplayWorkspace,
} from "./primary-workspace-service";
import { forbiddenError, notFoundError } from "@/lib/errors";

/** Minimal chainable query mock. Terminals resolve per-table canned results. */
type Terminal = () => Promise<{ data: unknown; error: null }>;
type Terminals = Partial<Record<"single" | "maybeSingle", Terminal>>;

interface Chain {
  select: (...args: unknown[]) => Chain;
  eq: (...args: unknown[]) => Chain;
  order: (...args: unknown[]) => Chain;
  limit: (...args: unknown[]) => Chain;
  update: (...args: unknown[]) => Chain;
  single: Terminal;
  maybeSingle: Terminal;
}

let updateArgs: unknown[][];

function chain(terminal: Terminals): Chain {
  const next = (): Chain => self;
  const self: Chain = {
    select: next,
    eq: next,
    order: next,
    limit: next,
    update: (...args: unknown[]) => {
      updateArgs.push(args);
      return self;
    },
    single: terminal.single ?? (async () => ({ data: null, error: null })),
    maybeSingle: terminal.maybeSingle ?? (async () => ({ data: null, error: null })),
  };
  return self;
}

function clientFor(routes: Record<string, Terminals>) {
  updateArgs = [];
  const from = vi.fn((table: string) => chain(routes[table] ?? {}));
  return { from, getUpdates: () => updateArgs };
}

const ORG_A = { id: "org-a", name: "Alpha", slug: "alpha" };
const PROFILE = (primary: string | null) => ({ id: "user-1", primary_organization_id: primary });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1", email: "u@example.com" });
  mockRequireOrganizationMember.mockImplementation(async (orgId: string) => {
    if (orgId === "org-a") {
      return { user: { id: "user-1" }, membership: { id: "m1" }, organization: ORG_A };
    }
    if (orgId === "missing") throw notFoundError("Organization not found");
    throw forbiddenError("You are not a member of this organization");
  });
});

describe("primary workspace selection", () => {
  it("1. user can set their own member organization as primary", async () => {
    const c = clientFor({
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
      profiles: { single: async () => ({ data: { ...PROFILE(null), primary_organization_id: "org-a" }, error: null }) },
    });
    const result = await setPrimaryOrganizationForUser(c as never, "user-1", "org-a");
    expect(result).toEqual(ORG_A);
    expect(mockRequireOrganizationMember).toHaveBeenCalledWith("org-a");
  });

  it("2. user cannot set a non-member organization as primary", async () => {
    const c = clientFor({});
    await expect(setPrimaryOrganizationForUser(c as never, "user-1", "org-b")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(c.from).not.toHaveBeenCalledWith("profiles");
  });

  it("2b. nonexistent organization is rejected", async () => {
    const c = clientFor({});
    await expect(setPrimaryOrganizationForUser(c as never, "user-1", "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("3. user cannot set another user's profile", async () => {
    const c = clientFor({
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
      profiles: { single: async () => ({ data: PROFILE(null), error: null }) },
    });
    await expect(setPrimaryOrganizationForUser(c as never, "user-2", "org-a")).rejects.toMatchObject({ code: "FORBIDDEN" });
    // RLS own-row confinement is the backstop, but the service must never even attempt it.
    expect(c.from).not.toHaveBeenCalledWith("profiles");
  });

  it("4-5. setting primary updates only the preference field on their profile", async () => {
    const c = clientFor({
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
      profiles: { single: async () => ({ data: { ...PROFILE(null), primary_organization_id: "org-a" }, error: null }) },
    });
    await setPrimaryOrganizationForUser(c as never, "user-1", "org-a");
    expect(c.getUpdates()).toEqual([[{ primary_organization_id: "org-a" }]]);
  });

  it("6-8. ownership, memberships, entitlements, billing remain unchanged", async () => {
    const c = clientFor({
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
      profiles: { single: async () => ({ data: { ...PROFILE(null), primary_organization_id: "org-a" }, error: null }) },
    });
    await setPrimaryOrganizationForUser(c as never, "user-1", "org-a");
    for (const table of c.from.mock.calls.map((call) => call[0] as string)) {
      expect(["profiles", "organizations"]).toContain(table);
    }
    for (const forbidden of ["tool_entitlements", "orders", "payments", "subscriptions", "organization_members"]) {
      expect(c.from).not.toHaveBeenCalledWith(forbidden);
    }
  });
});

describe("multiple users", () => {
  it("9. two users can select the same organization as primary", async () => {
    const c = clientFor({
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
      profiles: { single: async () => ({ data: PROFILE("org-a"), error: null }) },
    });
    mockRequireUser
      .mockResolvedValueOnce({ id: "user-1", email: "a@example.com" })
      .mockResolvedValueOnce({ id: "user-2", email: "b@example.com" });
    // requireOrganizationMember mock accepts org-a for any caller in this suite.
    await expect(setPrimaryOrganizationForUser(c as never, "user-1", "org-a")).resolves.toEqual(ORG_A);
    await expect(setPrimaryOrganizationForUser(c as never, "user-2", "org-a")).resolves.toEqual(ORG_A);
  });

  it("10. each user can select a different primary", async () => {
    const orgB = { id: "org-b", name: "Beta", slug: "beta" };
    mockRequireOrganizationMember.mockImplementation(async (orgId: string) => {
      if (orgId === "org-b") {
        return { user: { id: "user-1" }, membership: { id: "m2" }, organization: orgB };
      }
      throw forbiddenError("You are not a member of this organization");
    });
    const c = clientFor({
      organizations: {
        single: async () => ({ data: orgB, error: null }),
      },
      profiles: { single: async () => ({ data: { ...PROFILE(null), primary_organization_id: "org-b" }, error: null }) },
    });
    await expect(setPrimaryOrganizationForUser(c as never, "user-1", "org-b")).resolves.toEqual(orgB);
  });
});

describe("null state", () => {
  it("11. user with no organization has NULL primary", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE(null), error: null }) },
    });
    await expect(getPrimaryOrganizationForUser(c as never, "user-1")).resolves.toBeNull();
  });

  it("12. clearing primary is safe", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE(null), error: null }) },
    });
    await expect(setPrimaryOrganizationForUser(c as never, "user-1", null)).resolves.toBeNull();
    expect(c.getUpdates()).toEqual([[{ primary_organization_id: null }]]);
    expect(mockRequireOrganizationMember).not.toHaveBeenCalled();
  });
});

describe("deletion", () => {
  it("13. deleted primary organization resolves to NULL without moving the user", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE("org-gone"), error: null }) },
      organization_members: { maybeSingle: async () => ({ data: { id: "m1" }, error: null }) },
      organizations: { single: async () => ({ data: null, error: null }) },
    });
    // findOrganizationById returns null on error → getter returns null, writes nothing.
    await expect(getPrimaryOrganizationForUser(c as never, "user-1")).resolves.toBeNull();
    expect(c.getUpdates()).toEqual([]);
  });

  it("13b. lapsed membership resolves to NULL without persisting", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE("org-a"), error: null }) },
      organization_members: { maybeSingle: async () => ({ data: null, error: null }) },
    });
    await expect(getPrimaryOrganizationForUser(c as never, "user-1")).resolves.toBeNull();
    expect(c.getUpdates()).toEqual([]);
  });
});

describe("display fallback (never persisted)", () => {
  it("suggests oldest membership when primary is unset, without writing", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE(null), error: null }) },
      organization_members: {
        maybeSingle: async () => ({ data: { organization: ORG_A }, error: null }),
      },
    });
    const resolved = await resolveDisplayWorkspace(c as never, "user-1");
    expect(resolved).toEqual({ primary: null, fallback: ORG_A });
    expect(c.getUpdates()).toEqual([]);
  });

  it("returns no fallback when a verified primary exists", async () => {
    const c = clientFor({
      profiles: { single: async () => ({ data: PROFILE("org-a"), error: null }) },
      organization_members: { maybeSingle: async () => ({ data: { id: "m1" }, error: null }) },
      organizations: { single: async () => ({ data: ORG_A, error: null }) },
    });
    const resolved = await resolveDisplayWorkspace(c as never, "user-1");
    expect(resolved).toEqual({ primary: ORG_A, fallback: null });
  });
});

describe("authorization invariants (static)", () => {
  // Strip comments: assert on code, not explanatory prose.
  const strip = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n");
  const serviceSrc = strip(
    readFileSync(join(process.cwd(), "src/server/services/primary-workspace-service.ts"), "utf8")
  );
  const repoSrc = strip(readFileSync(join(process.cwd(), "src/server/repositories/profiles.ts"), "utf8"));

  it("15-19. primary workspace never consults entitlements, billing, or All Access", () => {
    for (const src of [serviceSrc, repoSrc]) {
      expect(src).not.toMatch(/require-entitlement/);
      expect(src).not.toMatch(/entitlement-service/);
      expect(src).not.toMatch(/has_tool_access/);
      expect(src).not.toMatch(/tool_entitlements/);
      expect(src).not.toMatch(/checkout-service/);
      expect(src).not.toMatch(/all-access/);
      expect(src).not.toMatch(/is_all_access/);
      expect(src).not.toMatch(/\.rpc\(/);
    }
  });

  it("16/20. URL organization context is never consulted — primary is preference, not context", () => {
    expect(serviceSrc).not.toMatch(/organization-context/);
    expect(serviceSrc).not.toMatch(/orgSlug/);
  });

  it("membership: setter delegates to the canonical helper; service never inserts/deletes", () => {
    expect(serviceSrc).toMatch(/requireOrganizationMember/);
    expect(serviceSrc).not.toMatch(/\.(insert|delete)\(/);
    // The only membership read is the lapsed-membership guard in the getter.
    expect(serviceSrc).not.toMatch(/\.(insert|update)\(\{\s*organization_id/);
  });
});
