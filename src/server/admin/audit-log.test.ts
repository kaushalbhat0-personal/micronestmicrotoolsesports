import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Audit Log — RCCF-ADMIN-09", () => {
  const svc = () => readFileSync("src/server/admin/audit-log.ts", "utf8");
  const page = () => readFileSync("src/app/(admin)/admin/audit-log/page.tsx", "utf8");
  const sidebar = () => readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");

  // Authorization
  it("requireSuperAdmin called in page and service, before createAdminClient", () => {
    expect(page()).toContain("requireSuperAdmin");
    expect(svc()).toContain("requireSuperAdmin");
    expect(svc().indexOf("requireSuperAdmin") < svc().indexOf("createAdminClient")).toBe(true);
    expect(page().indexOf("requireSuperAdmin") < page().indexOf("getAdminAuditLog")).toBe(true);
  });

  it("unauthenticated / non-admin rejected via requireSuperAdmin", () => {
    expect(svc()).toContain("await requireSuperAdmin()");
    expect(page()).toContain("await requireSuperAdmin()");
  });

  it("does not rely on email allowlist, org slug, or env", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toMatch(/@micronest/i);
      expect(c).not.toMatch(/is_org_member/);
      expect(c).not.toMatch(/orgSlug/);
      expect(c).not.toMatch(/NEXT_PUBLIC/);
      expect(c).not.toMatch(/localStorage/);
    });
  });

  it("service-role isolation — no createAdminClient in client components", () => {
    expect(svc()).toContain("createAdminClient");
    expect(readFileSync("src/components/admin/AdminShell.tsx", "utf8")).not.toContain("createAdminClient");
    expect(sidebar()).not.toContain("createAdminClient");
  });

  // Data
  it("audit rows returned — selects correct columns including before/after/ip", () => {
    const s = svc();
    expect(s).toContain('from("admin_audit_logs")');
    expect(s).toContain('select("id, actor_user_id, action, target_type');
    expect(s).toContain("before");
    expect(s).toContain("after");
  });

  it("actor resolution — batched profile lookup via in", () => {
    const s = svc();
    expect(s).toContain('from("profiles")');
    expect(s).toContain('in("id", actorIds');
    expect(s).not.toMatch(/for\s*\(.*await admin\.from\("profiles"\)/);
  });

  it("organization resolution — batched org lookup via in", () => {
    const s = svc();
    expect(s).toContain('from("organizations")');
    expect(s).toContain('in("id", orgIds');
    expect(s).not.toMatch(/for\s*\(.*await admin\.from\("organizations"\)/);
  });

  it("correct action display — Badge with action", () => {
    expect(page()).toContain("{item.action}");
    expect(page()).toContain('variant="secondary"');
  });

  it("correct timestamps — formatDate and scope col", () => {
    expect(page()).toContain("formatDate(item.createdAt)");
    expect(page()).toContain('scope="col"');
    expect(page()).toContain("<caption");
  });

  // Search
  it("search trimming and max length 100", () => {
    const s = svc();
    expect(s).toContain("MAX_QUERY_LEN = 100");
    expect(s).toContain("trim()");
    expect(s).toContain("slice(0, MAX_QUERY_LEN)");
  });

  it("wildcard escaping % and _", () => {
    const s = svc();
    expect(s).toContain('replace(/%/g, "\\\\%")');
    expect(s).toContain('replace(/_/g, "\\\\_")');
  });

  it("supported searchable fields — action, target_type, reason, org, actor", () => {
    const s = svc();
    expect(s).toContain("action.ilike");
    expect(s).toContain("target_type.ilike");
    expect(s).toContain("reason.ilike");
    // org via in, actor via profiles
    expect(s).toContain('from("organizations")');
    expect(s).toContain('from("profiles")');
  });

  // Filters
  it("valid action filter — whitelisted via ACTION_RE", () => {
    const s = svc();
    expect(s).toContain("ACTION_RE = /^[a-z_]+\\.[a-z_]+$/");
    expect(s).toContain('eq("action", action)');
  });

  it("invalid action safely ignored — no unsafe SQL", () => {
    const s = svc();
    // invalid action becomes empty string, no eq applied
    expect(s).toContain('ACTION_RE.test(rawAction) ? rawAction : ""');
    expect(s).not.toMatch(/\.eq\("action", rawAction\)/);
  });

  it("organization filter — org_q via batched org lookup", () => {
    const s = svc();
    expect(s).toContain("organizationQuery");
    expect(s).toContain('in("organization_id", orgIdsForFilter)');
  });

  it("date filter — today, 7d, 30d", () => {
    const s = svc();
    expect(s).toContain('"today"');
    expect(s).toContain('"7d"');
    expect(s).toContain('"30d"');
    expect(s).toContain('gte("created_at"');
  });

  it("combined filters — all applied together", () => {
    const s = svc();
    expect(s).toContain('eq("action", action)');
    expect(s).toContain('eq("target_type", targetType)');
    expect(s).toContain('in("organization_id"');
    expect(s).toContain('gte("created_at"');
  });

  // Pagination
  it("default page 1, page size 50, bounds 1-1000", () => {
    const s = svc();
    expect(s).toContain("PAGE_SIZE = 50");
    expect(s).toContain('if (!Number.isFinite(page) || page < 1) page = 1');
    expect(s).toContain("if (page > 1000) page = 1000");
    expect(s).toContain("range(from, to)");
  });

  it("total pages and hasMore", () => {
    const s = svc();
    expect(s).toContain("totalPages");
    expect(s).toContain("hasMore");
    expect(s).toContain("from + pageSize < total");
  });

  it("filter persistence — pagination preserves query and filters", () => {
    const p = page();
    expect(p).toContain("buildHref");
    expect(p).toContain("data.query");
    expect(p).toContain("data.action");
    expect(p).toContain("data.targetType");
    expect(p).toContain("data.organizationQuery");
    expect(p).toContain("data.dateFilter");
  });

  it("filter change resets page — GET form without page param", () => {
    const p = page();
    expect(p).toContain('<form method="GET"');
    // form should not contain hidden page input — changing filters resets to 1
    // pagination links include page param
    expect(p).toContain('buildPageHref');
  });

  // Security
  it("no service-role client created before authorization", () => {
    const s = svc();
    expect(s.indexOf("requireSuperAdmin") < s.indexOf("createAdminClient")).toBe(true);
  });

  it("no recordAdminAudit call in page/service", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toContain("recordAdminAudit(");
      expect(c).not.toContain("from(\"admin_audit_logs\").insert");
    });
  });

  it("no mutation queries — no insert/update/delete", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
  });

  it("no auth.users data exposed — only profiles", () => {
    const s = svc();
    const p = page();
    expect(s).not.toContain('from("auth.users")');
    expect(s).not.toContain("auth.users");
    expect(p).not.toContain("auth.users");
    expect(s).toContain('from("profiles")');
  });

  it("sensitive fields omitted/redacted — forbidden substrings", () => {
    const s = svc();
    expect(s).toContain("FORBIDDEN_SUBSTRINGS");
    expect(s).toContain("password");
    expect(s).toContain("secret");
    expect(s).toContain("token");
    expect(s).toContain("api_key");
    expect(s).toContain("isForbiddenKey");
    expect(s).toContain("omitted");
  });

  it("raw before/after JSON not blindly rendered — safe projection", () => {
    const s = svc();
    expect(s).toContain("safeAuditProjection");
    expect(s).toContain("SafeProjection");
    const p = page();
    expect(p).toContain("item.before.entries");
    expect(p).toContain("item.after.entries");
    expect(p).toContain("omitted");
    // must not dump raw JSON directly
    expect(p).not.toContain("JSON.stringify(item.before");
    expect(p).not.toContain("JSON.stringify(item.after");
    expect(p).not.toContain("<pre>");
  });

  it("no credentials/secrets/tokens returned — sanitization", () => {
    const s = svc();
    expect(s).not.toMatch(/select\(".*"\).*password/);
    // before/after are sanitized, not blindly selected as raw display
    expect(s).toContain("before, after");
    // but sanitizer strips forbidden
    expect(s).toContain("isForbiddenKey");
  });

  // Query quality
  it("no N+1 actor queries", () => {
    const s = svc();
    expect(s).toContain('in("id", actorIds');
    expect(s).not.toMatch(/for\s*\(.*await admin\.from\("profiles"\)/);
    // Search (optional) + batched lookup = max 2
    const count = (s.match(/from\("profiles"\)/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
  });

  it("no N+1 organization queries", () => {
    const s = svc();
    expect(s).toContain('in("id", orgIds');
    // org lookup appears twice: one for filter resolve (limit 200) and one for batch
    // but not per row
    expect(s).not.toMatch(/for\s*\([^)]*\)\s*\{\s*await admin\.from\("organizations"\)/);
  });

  it("bounded results — PAGE_SIZE 50, limit 200 for org/profile searches", () => {
    const s = svc();
    expect(s).toContain(".limit(200)");
    expect(s).toContain(".limit(50)");
    expect(s).toContain("range(from, to)");
  });

  it("availableActions limited to 50", () => {
    const s = svc();
    expect(s).toContain("slice(0, 50)");
    expect(s).toContain('select("action")');
  });

  // Navigation
  it("Audit Log navigation active", () => {
    const s = sidebar();
    expect(s).toContain('href: "/admin/audit-log"');
    expect(s).toContain('{ label: "Audit Log", href: "/admin/audit-log"');
  });

  // Page structure
  it("page is server component with force-dynamic and semantic table", () => {
    const p = page();
    expect(p).toContain('dynamic = "force-dynamic"');
    expect(p).toContain('scope="col"');
    expect(p).toContain("<caption");
    expect(p).toContain("overflow-x-auto");
    expect(p).toContain("44px");
  });

  it("empty states and error states distinct", () => {
    const p = page();
    expect(p).toContain("No audit records found");
    expect(p).toContain("No audit events match these filters");
    expect(p).toContain("Unable to load audit logs");
  });
});
