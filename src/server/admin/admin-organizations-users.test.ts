import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Organizations tests
describe("Organizations — RCCF-ADMIN-04", () => {
  it("Super Admin authorization required in page and service", () => {
    const page = readFileSync("src/app/(admin)/admin/organizations/page.tsx", "utf8");
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(page).toContain("requireSuperAdmin");
    expect(svc).toContain("requireSuperAdmin");
  });

  it("search parameter is trimmed and bounded to 100", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain("trim()");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
    expect(svc).toContain("slice(0, MAX_QUERY_LEN)");
  });

  it("invalid page falls back to 1 and page bounded", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
    expect(svc).toContain("if (page > 1000) page = 1000");
  });

  it("default page size is 50 and not user-controlled", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain("PAGE_SIZE = 50");
    expect(svc).not.toContain("searchParams.pageSize");
    expect(svc).not.toContain("Number(searchParams.pageSize)");
  });

  it("pagination query is bounded via range", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain(".range(from, to)");
    expect(svc).toContain("from = (page - 1) * pageSize");
  });

  it("organization source is organizations with correct fields", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain('from("organizations")');
    expect(svc).toContain("select(\"id, name, slug, created_at\")");
    expect(svc).not.toContain("status"); // status not in current schema, must be omitted
  });

  it("member count uses batched query, no N+1", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain('from("organization_members")');
    expect(svc).toContain('.in("organization_id", ids)');
    expect(svc).not.toMatch(/for\s*\(.*await supabase/);
  });

  it("no organization mutation exists", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/organizations/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
    expect(page).not.toMatch(/suspend/i);
  });

  it("raw DB errors are not exposed — shows Unable to load", () => {
    const page = readFileSync("src/app/(admin)/admin/organizations/page.tsx", "utf8");
    expect(page).toContain("Unable to load organizations");
    expect(page).not.toMatch(/error\.message/);
    expect(page).not.toMatch(/Supabase/);
  });

  it("empty results distinguishable from query errors", () => {
    const page = readFileSync("src/app/(admin)/admin/organizations/page.tsx", "utf8");
    expect(page).toContain("No organizations found");
    expect(page).toContain('No organizations match');
    // hasError case separate
    expect(page).toContain("hasError");
  });

  it("search is server-side via ilike on name/slug", () => {
    const svc = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(svc).toContain("ilike");
    expect(svc).toContain("name.ilike");
    expect(svc).toContain("slug.ilike");
  });
});

describe("Users — RCCF-ADMIN-04", () => {
  it("Super Admin authorization required in page and service", () => {
    const page = readFileSync("src/app/(admin)/admin/users/page.tsx", "utf8");
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(page).toContain("requireSuperAdmin");
    expect(svc).toContain("requireSuperAdmin");
  });

  it("search parameter is trimmed/bounded", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).toContain("trim()");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
  });

  it("invalid page falls back to 1", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
  });

  it("default page size is 50", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).toContain("PAGE_SIZE = 50");
  });

  it("user source is profiles with safe fields", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).toContain('from("profiles")');
    expect(svc).toContain("select(\"id, email, display_name, avatar_url, created_at\")");
    expect(svc).not.toContain('from("auth.users")');
    expect(svc).not.toContain("password_hash");
    expect(svc).not.toContain("refresh_token");
  });

  it("organization memberships are batched, not N+1", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).toContain('from("organization_members")');
    expect(svc).toContain('.in("user_id", ids)');
    expect(svc).not.toMatch(/for\s*\(.*await supabase/);
  });

  it("no user mutation exists", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/users/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
    expect(page).not.toMatch(/impersonation/i);
    expect(page).not.toMatch(/password reset/i);
  });

  it("sensitive auth fields are not selected", () => {
    const svc = readFileSync("src/server/admin/users.ts", "utf8");
    expect(svc).not.toContain("encrypted");
    expect(svc).not.toContain("secret");
    expect(svc).not.toContain("token");
    const page = readFileSync("src/app/(admin)/admin/users/page.tsx", "utf8");
    expect(page).not.toContain("auth.users");
  });

  it("raw DB errors not exposed", () => {
    const page = readFileSync("src/app/(admin)/admin/users/page.tsx", "utf8");
    expect(page).toContain("Unable to load users");
  });

  it("empty distinguishable from error", () => {
    const page = readFileSync("src/app/(admin)/admin/users/page.tsx", "utf8");
    expect(page).toContain("No users found");
    expect(page).toContain("No users match");
  });
});

describe("Navigation — RCCF-ADMIN-04", () => {
  it("Organizations and Users now active, others still Soon", () => {
    const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
    expect(sidebar).toContain('href: "/admin/organizations"');
    expect(sidebar).toContain('href: "/admin/users"');
    expect(sidebar).toContain('href: "/admin/entitlements"');
    expect(sidebar).toContain('href: "/admin/billing"');
    expect(sidebar).toContain('href: "/admin/sentinel"');
    expect(sidebar).toContain('href: "/admin/system"');
    expect(sidebar).toContain('href: "/admin/audit-log"');
  });
});

describe("Service-role safety — RCCF-ADMIN-04", () => {
  it("no client component imports createAdminClient", () => {
    const shell = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
    const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");
    const header = readFileSync("src/components/admin/AdminHeader.tsx", "utf8");
    [shell, sidebar, header].forEach((c) => expect(c).not.toContain("createAdminClient"));
    // server services are allowed
    expect(readFileSync("src/server/admin/organizations.ts", "utf8")).toContain("createAdminClient");
    expect(readFileSync("src/server/admin/users.ts", "utf8")).toContain("createAdminClient");
  });
});

describe("Organizations runtime — pagination & search — RCCF-ADMIN-04", () => {
  it("invalid page falls back to 1 and trimmed search bounded", async () => {
    const makeQuery = () => {
      const q: unknown = Promise.resolve({ count: 0, data: [], error: null });
      (q as Record<string, unknown>).or = vi.fn(() => q);
      (q as Record<string, unknown>).order = vi.fn(() => q);
      (q as Record<string, unknown>).range = vi.fn(() => q);
      (q as Record<string, unknown>).eq = vi.fn(() => q);
      (q as Record<string, unknown>).in = vi.fn(() => q);
      return q as never;
    };
    const adminModule = await import("@/lib/supabase/admin");
    const mockedCreate = adminModule.createAdminClient as unknown as ReturnType<typeof vi.fn>;
    mockedCreate.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            select: vi.fn(() => makeQuery()),
          })),
        }) as never,
    );
    const { getAdminOrganizations } = await import("./organizations");
    const res = await getAdminOrganizations({ q: "  tag  ", page: "abc" } as unknown as Record<string, string>);
    expect(res.page).toBe(1);
    expect(res.query).toBe("tag");
    expect(res.pageSize).toBe(50);
  });

  it("search not constructed via raw SQL", () => {
    const content = readFileSync("src/server/admin/organizations.ts", "utf8");
    expect(content).not.toContain("`select * from");
    expect(content).not.toContain("query(`select");
    expect(content).toContain("ilike");
  });
});

describe("Users runtime — pagination & search — RCCF-ADMIN-04", () => {
  it("invalid page falls back to 1", async () => {
    const makeQuery = () => {
      const q: unknown = Promise.resolve({ count: 0, data: [], error: null });
      (q as Record<string, unknown>).or = vi.fn(() => q);
      (q as Record<string, unknown>).order = vi.fn(() => q);
      (q as Record<string, unknown>).range = vi.fn(() => q);
      (q as Record<string, unknown>).eq = vi.fn(() => q);
      (q as Record<string, unknown>).in = vi.fn(() => q);
      return q as never;
    };
    const adminModule = await import("@/lib/supabase/admin");
    const mockedCreate = adminModule.createAdminClient as unknown as ReturnType<typeof vi.fn>;
    mockedCreate.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            select: vi.fn(() => makeQuery()),
          })),
        }) as never,
    );
    const { getAdminUsers } = await import("./users");
    const res = await getAdminUsers({ page: "-5" } as unknown as Record<string, string>);
    expect(res.page).toBe(1);
  });
});
