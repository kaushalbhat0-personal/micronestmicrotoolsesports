import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "actor-1" })),
}));
vi.mock("@/lib/auth/organization-context", () => ({
  requireOrganizationContext: vi.fn(async () => ({
    organization: { id: "org-1", name: "Org", slug: "org" },
    membership: { role: "owner", id: "mem-1" },
    user: { id: "actor-1" },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const TARGET = "22222222-2222-4222-8222-222222222222";

async function mockedAdmin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return vi.mocked(createAdminClient);
}

function adminWith(opts: {
  profiles?: Array<{ id: string; email: string }>;
  rpcData?: unknown;
  rpcError?: { message: string } | null;
  members?: Array<Record<string, unknown>>;
}) {
  const rpc = vi.fn(async () => ({ data: opts.rpcData ?? { ok: true }, error: opts.rpcError ?? null }));
  const admin = {
    rpc,
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            ilike: async () => ({ data: opts.profiles ?? [], error: null }),
            in: async () => ({ data: opts.profiles ?? [], error: null }),
          }),
        };
      }
      if (table === "organization_members") {
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: opts.members ?? [], error: null }) }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
    }),
  };
  return { admin, rpc };
}

describe("Organization member service — RCCF-ORG-MEMBERS-01", () => {
  beforeEach(() => vi.clearAllMocks());

  it("owner can add a member by exact email", async () => {
    const { addMemberByEmail } = await import("./members");
    const { admin, rpc } = adminWith({ profiles: [{ id: TARGET, email: "mate@example.com" }], rpcData: { ok: true, role: "member" } });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await addMemberByEmail("org", "  MATE@example.com ", "member");
    expect(res).toEqual({ ok: true, role: "member" });
    expect(rpc).toHaveBeenCalledWith("add_organization_member", {
      p_org: "org-1",
      p_target: TARGET,
      p_role: "member",
      p_actor: "actor-1",
    });
  });

  it("unknown email is rejected without RPC", async () => {
    const { addMemberByEmail } = await import("./members");
    const { admin, rpc } = adminWith({ profiles: [] });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await addMemberByEmail("org", "ghost@example.com", "member");
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("invalid email and invalid role rejected", async () => {
    const { addMemberByEmail } = await import("./members");
    // no admin mock queued: both inputs fail before any client is created
    expect((await addMemberByEmail("org", "not-an-email", "member")).ok).toBe(false);
    expect((await addMemberByEmail("org", "mate@example.com", "owner" as never)).ok).toBe(false);
  });

  it("admin caller cannot assign admin role (fast failure)", async () => {
    const { requireOrganizationContext } = await import("@/lib/auth/organization-context");
    vi.mocked(requireOrganizationContext).mockResolvedValueOnce({
      organization: { id: "org-1", name: "Org", slug: "org" },
      membership: { role: "admin", id: "mem-2" },
      user: { id: "actor-1" },
    } as never);
    const { addMemberByEmail } = await import("./members");
    // no admin mock queued: fast failure happens before client creation
    const res = await addMemberByEmail("org", "mate@example.com", "admin");
    expect(res.ok).toBe(false);
  });

  it("RPC domain errors map to safe messages", async () => {
    const { removeMember, changeMemberRole, transferOwnership, leaveOrganization } = await import("./members");
    const adminMock = await mockedAdmin();
    for (const [fn, args] of [
      [removeMember, ["org", TARGET]],
      [changeMemberRole, ["org", TARGET, "admin"]],
      [transferOwnership, ["org", TARGET]],
      [leaveOrganization, ["org"]],
    ] as const) {
      const { admin } = adminWith({ rpcData: { ok: false, error: "forbidden" } });
      adminMock.mockReturnValueOnce(admin as never);
      const res = await (fn as (...a: string[]) => Promise<{ ok: boolean; error?: string }>)(...args);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("Your role cannot perform this action");
    }
  });

  it("sole-owner leave maps to transfer-first message", async () => {
    const { leaveOrganization } = await import("./members");
    const { admin } = adminWith({ rpcData: { ok: false, error: "last_owner" } });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await leaveOrganization("org");
    expect(res).toEqual({ ok: false, error: "The final owner cannot leave — transfer ownership first" });
  });

  it("target IDs are UUID-validated before any RPC", async () => {
    const { removeMember } = await import("./members");
    // no admin mock queued: UUID check fails before client creation
    const res = await removeMember("org", "not-a-uuid");
    expect(res.ok).toBe(false);
  });

  it("listMembers returns safe projection with caller role", async () => {
    const { listMembers } = await import("./members");
    const { admin } = adminWith({
      members: [{ user_id: "actor-1", role: "owner", created_at: "2026-01-01T00:00:00Z" }],
      profiles: [],
    });
    // profiles come through the same mock via .in()
    (admin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ in: async () => ({ data: [{ id: "actor-1", email: "owner@example.com", display_name: "Ow" }], error: null }) }) };
      }
      return {
        select: () => ({
          eq: () => ({ order: async () => ({ data: [{ user_id: "actor-1", role: "owner", created_at: "2026-01-01T00:00:00Z" }], error: null }) }),
        }),
      };
    });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await listMembers("org");
    expect(res.callerRole).toBe("owner");
    expect(res.members).toEqual([
      { userId: "actor-1", email: "owner@example.com", displayName: "Ow", role: "owner", createdAt: "2026-01-01T00:00:00Z" },
    ]);
  });
});
