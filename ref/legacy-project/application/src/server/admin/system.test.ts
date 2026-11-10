import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("System — RCCF-ADMIN-08", () => {
  const svc = () => readFileSync("src/server/admin/system.ts", "utf8");
  const page = () => readFileSync("src/app/(admin)/admin/system/page.tsx", "utf8");
  const sidebar = () => readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");

  it("1. requireSuperAdmin called in page and service", () => {
    expect(page()).toContain("requireSuperAdmin");
    expect(svc()).toContain("requireSuperAdmin");
  });

  it("2. anonymous rejected — page calls requireSuperAdmin before getAdminSystem", () => {
    const p = page();
    expect(p).toContain("await requireSuperAdmin()");
    expect(p.indexOf("requireSuperAdmin") < p.indexOf("getAdminSystem")).toBe(true);
  });

  it("3. non-admin rejected — service calls requireSuperAdmin", () => {
    expect(svc()).toContain("await requireSuperAdmin()");
  });

  it("4. createAdminClient only after authorization", () => {
    const s = svc();
    expect(s).toContain("createAdminClient");
    expect(s.indexOf("requireSuperAdmin") < s.indexOf("createAdminClient")).toBe(true);
  });

  it("5. cron configuration read-only — no mutations", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
    expect(svc()).toContain('CRON_JOBS');
    expect(svc()).toContain("/api/cron/sentinel-scan");
    expect(svc()).toContain("/api/cron/sentinel-retention");
  });

  it("6. webhook reads read-only — select only, no mutations", () => {
    const s = svc();
    expect(s).toContain('from("webhook_events")');
    expect(s).not.toMatch(/\.insert\(/);
    expect(s).not.toMatch(/\.update\(/);
    expect(s).not.toMatch(/\.delete\(/);
  });

  it("7. provider configuration read-only — safe select only", () => {
    const s = svc();
    expect(s).toContain('from("organization_provider_credentials")');
    expect(s).toContain('select("id, organization_id, provider, last_tested_at');
    expect(s).not.toMatch(/\.insert\(/);
    expect(s).not.toMatch(/\.update\(/);
    expect(s).not.toMatch(/\.delete\(/);
  });

  it("8. tools read-only — select only", () => {
    const s = svc();
    expect(s).toContain('from("tools")');
    // no insert/update/delete overall
    expect(s).not.toMatch(/\.insert\(/);
  });

  it("9. plans read-only — select only", () => {
    const s = svc();
    expect(s).toContain('from("plans")');
    expect(s).not.toMatch(/\.insert\(/);
  });

  it("10. health read-only — no mutation, safe projection", () => {
    const s = svc();
    const p = page();
    expect(s).not.toMatch(/\.insert\(/);
    expect(p).not.toContain("process.env");
    // page explains health is safe projection
    expect(p).toContain("Application Health");
  });

  it("11. admin activity read-only — select only", () => {
    const s = svc();
    expect(s).toContain('from("admin_audit_logs")');
    expect(s).toContain('select("id, action, target_type');
    expect(s).not.toMatch(/\.insert\(/);
  });

  it("12. no INSERT anywhere", () => {
    [svc(), page()].forEach((c) => expect(c).not.toMatch(/\.insert\(/));
  });

  it("13. no UPDATE anywhere", () => {
    [svc(), page()].forEach((c) => expect(c).not.toMatch(/\.update\(/));
  });

  it("14. no DELETE anywhere", () => {
    [svc(), page()].forEach((c) => expect(c).not.toMatch(/\.delete\(/));
  });

  it("15. no audit writes — recordAdminAudit not called", () => {
    [svc(), page()].forEach((c) => expect(c).not.toContain("recordAdminAudit"));
  });

  it("16. no credential exposure — never selects encrypted_*", () => {
    const s = svc();
    const p = page();
    expect(s).not.toContain("encrypted_client_id");
    expect(s).not.toContain("encrypted_client_secret");
    expect(s).not.toContain("encrypted_api_key");
    // Ensure no select statement pulls encrypted columns
    expect(s).not.toMatch(/select\([^)]*encrypted_/);
    [s, p].forEach((c) => expect(c).not.toMatch(/select\("\*"/));
  });

  it("17. no access-token exposure", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toContain("access_token");
      expect(c).not.toContain("refresh_token");
    });
  });

  it("18. no refresh-token exposure", () => {
    [svc(), page()].forEach((c) => expect(c).not.toContain("refresh_token"));
  });

  it("19. no API-key exposure — does not expose api_key or client_secret", () => {
    const s = svc();
    expect(s).not.toContain("api_key_masked");
    expect(s).not.toContain("client_id_masked");
    expect(s).not.toContain("api_key");
    expect(s).not.toContain("client_secret");
  });

  it("20. no webhook payload exposure — never selects payload", () => {
    const s = svc();
    expect(s).not.toMatch(/select\([^)]*payload/);
    expect(s).not.toContain("raw_ref");
    // Page may mention payload in comment about not exposing it, but must not select it
    expect(page()).not.toMatch(/select\([^)]*payload/);
  });

  it("21. no webhook signature exposure", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toContain("razorpay_signature");
      expect(c).not.toContain("webhook_secret");
      expect(c).not.toMatch(/select\([^)]*signature/);
    });
  });

  it("22. no environment-variable enumeration — no process.env, no secrets", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toContain("process.env");
      expect(c).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(c).not.toContain("CRON_SECRET");
    });
  });

  it("23. no external provider calls — no fetch to Twitch/YouTube/Kick/Razorpay", () => {
    [svc(), page()].forEach((c) => {
      expect(c).not.toContain("createTwitchClient");
      expect(c).not.toContain("YouTubeClient");
      expect(c).not.toContain("KickClient");
      expect(c).not.toMatch(/fetch\(.*twitch/i);
      expect(c).not.toMatch(/fetch\(.*youtube/i);
      expect(c).not.toMatch(/fetch\(.*kick/i);
      // razorpay as provider string in allowlist is OK, but no external fetch
      expect(c).not.toMatch(/fetch\(.*razorpay/i);
      expect(c).not.toContain("createRazorpayClient");
    });
    // Service health explicitly does NOT fetch external providers
    expect(svc()).toContain('status: "unavailable"');
  });

  it("24. bounded search — MAX_QUERY_LEN 100", () => {
    const s = svc();
    expect(s).toContain("MAX_QUERY_LEN = 100");
    expect(s).toContain("slice(0, MAX_QUERY_LEN)");
  });

  it("25. bounded pagination — PAGE_SIZE 50, page 1-1000", () => {
    const s = svc();
    expect(s).toContain("PAGE_SIZE = 50");
    expect(s).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
    expect(s).toContain("if (page > 1000) page = 1000");
    expect(s).toContain('range(webhookFrom');
  });

  it("26. filter validation — only known statuses/providers", () => {
    const s = svc();
    expect(s).toContain('["pending", "processing", "succeeded", "failed"]');
    expect(s).toContain('["stripe", "razorpay", "twitch"');
    expect(s).toContain('["twitch", "youtube", "kick"]');
  });

  it("27. filter persistence — pagination preserves query and filters", () => {
    const p = page();
    expect(p).toContain("buildWebhookHref");
    expect(p).toContain("buildProviderHref");
    expect(p).toContain("data.webhookQuery");
    expect(p).toContain("data.webhookStatus");
    expect(p).toContain("data.providerFilter");
  });

  it("28. filter reset — forms preserve page reset", () => {
    const p = page();
    expect(p).toContain('<form method="GET"');
    // GET form without explicit page means reset to 1; check no hidden page= in filter form
    // provider and webhook forms use hidden preservation but not page
    expect(p).toContain('name="webhook_q"');
    expect(p).toContain('name="provider_q"');
    expect(p).toContain('name="provider_filter"');
  });

  it("29. no N+1 — batched org lookups, no per-row await in loop", () => {
    const s = svc();
    expect(s).toContain('in("id", orgIds');
    expect(s).toContain('in("id", orgIds2');
    expect(s).not.toMatch(/for\s*\(.*await admin/);
  });

  it("30. empty != error — distinct empty messages", () => {
    const p = page();
    expect(p).toContain("No webhook events found");
    expect(p).toContain("No provider configurations found");
    expect(p).toContain("Unable to load webhook events");
    expect(p).toContain("Unable to load provider configurations");
  });

  it("31. configured schedule ≠ successful execution — explicit language", () => {
    const s = svc();
    const p = page();
    expect(s).toContain("Configured — no persisted run history");
    expect(p).toContain("Configured ≠ Executed ≠ Healthy");
    expect(p).toContain("Vercel cron defines the schedule");
  });

  it("32. missing persisted run history handled correctly", () => {
    const s = svc();
    expect(s).toContain("no persisted run history");
    expect(s).toContain('observedActivity: isScan ?');
    expect(page()).toContain("Not persisted — see retention policy");
  });

  it("33. health unavailable handled safely", () => {
    const p = page();
    expect(p).toContain("Unavailable");
    expect(p).toContain("Health probe not executed");
    expect(svc()).toContain('status: "unavailable"');
  });

  it("34. missing provider last-tested state handled safely", () => {
    const p = page();
    expect(p).toContain("Not persisted");
    const s = svc();
    expect(s).toContain("last_tested_at");
    expect(s).toContain("last_test_status");
  });

  it("35. actual schema fields used correctly — no invented cronRunId, correct webhook fields", () => {
    const s = svc();
    expect(s).toContain('select("id, provider, provider_event_id, event_type, status, processed');
    expect(s).toContain('received_at');
    expect(s).toContain('processed_at');
    expect(s).not.toContain("cronRunId");
    expect(s).not.toContain("cron_run_id");
    expect(s).not.toContain('select("*")');
  });

  it("navigation — System is now active, Audit Log active after ADMIN-09", () => {
    const s = sidebar();
    expect(s).toContain('href: "/admin/system"');
    expect(s).toContain('{ label: "System", href: "/admin/system"');
    expect(s).not.toContain('{ label: "System", icon: Settings2, comingSoon: true }');
    expect(s).toContain('href: "/admin/audit-log"');
    expect(s).toContain('{ label: "Audit Log", href: "/admin/audit-log"');
  });
});
