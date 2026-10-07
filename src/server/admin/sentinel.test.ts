import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Sentinel — RCCF-ADMIN-07", () => {
  it("requireSuperAdmin is called in page and service", () => {
    expect(readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8")).toContain("requireSuperAdmin");
    expect(readFileSync("src/server/admin/sentinel.ts", "utf8")).toContain("requireSuperAdmin");
  });

  it("service-role client only after guard and not in client components", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain("createAdminClient");
    expect(svc.indexOf("requireSuperAdmin") < svc.indexOf("createAdminClient")).toBe(true);
    expect(readFileSync("src/components/admin/AdminShell.tsx", "utf8")).not.toContain("createAdminClient");
    expect(readFileSync("src/components/admin/AdminSidebar.tsx", "utf8")).not.toContain("createAdminClient");
  });

  it("campaigns read-only — select only", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('from("sponsor_campaigns")');
    expect(svc).toContain('from("connected_channels")');
    expect(svc).toContain('from("scans")');
  });

  it("no INSERT/UPDATE/DELETE in service or page", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
  });

  it("no audit writes", () => {
    expect(readFileSync("src/server/admin/sentinel.ts", "utf8")).not.toContain("recordAdminAudit");
    expect(readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8")).not.toContain("recordAdminAudit");
  });

  it("no auth.users exposure", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).not.toContain('from("auth.users")');
    expect(svc).not.toContain("auth.users");
  });

  it("no provider secrets — does not select OAuth tokens or encrypted fields", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).not.toContain("encrypted_");
    expect(svc).not.toContain("access_token");
    expect(svc).not.toContain("refresh_token");
    expect(svc).not.toContain("client_secret");
    expect(svc).not.toContain("api_key");
    expect(svc).toContain('select("id, organization_id, platform, external_handle');
  });

  it("no OAuth token exposure", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).not.toContain("oauth");
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).not.toContain("access_token");
  });

  it("no raw payload exposure — does not select evidence payload or raw_ref", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).not.toContain("payload");
    expect(svc).not.toContain("raw_ref");
    expect(svc).not.toContain("metadata");
  });

  it("bounded search — MAX_QUERY_LEN 100", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
    expect(svc).toContain("trim()");
  });

  it("bounded pagination — PAGE_SIZE 50, page 1-1000", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain("PAGE_SIZE = 50");
    expect(svc).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
    expect(svc).toContain("if (page > 1000) page = 1000");
  });

  it("filter validation — only known statuses/platforms", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('["draft", "active", "completed", "archived"]');
    expect(svc).toContain('["connected", "disconnected", "expired", "revoked"]');
    expect(svc).toContain('["twitch", "youtube", "kick"]');
    expect(svc).toContain('["pending", "running", "success", "failed", "partial"]');
  });

  it("filter persistence — pagination preserves query and filters", () => {
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("buildPageHref");
    expect(page).toContain("data.query");
    expect(page).toContain("data.campaignStatus");
  });

  it("filter reset — form submit resets page to 1", () => {
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain('<form method="GET"');
    expect(page).toContain('name="section" value={section}');
    expect(page).not.toContain('name="page"');
  });

  it("no N+1 — batched org/campaign lookups", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('in("id", orgIds');
    expect(svc).toContain('in("id", campIds');
    expect(svc).not.toMatch(/for\s*\(.*await admin/);
  });

  it("empty/error distinction", () => {
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("Unable to load sentinel data");
    expect(page).toContain("No campaigns found");
    expect(page).toContain("No channels found");
    expect(page).toContain("No scans found");
    expect(page).toContain("hasError");
  });

  it("safe error handling — does not expose raw DB errors", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain("Unable to load");
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).not.toMatch(/error\.message/);
  });

  it("scan status mapping uses actual statuses", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('eq("status", scanStatus)');
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("success");
    expect(page).toContain("failed");
    expect(page).toContain("partial");
  });

  it("campaign status mapping uses actual statuses", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('eq("status", campaignStatus)');
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("draft");
    expect(page).toContain("active");
  });

  it("actual schema fields used correctly — no invented cronRunId", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    expect(svc).toContain('select("id, organization_id, platform, external_handle');
    expect(svc).toContain('select("id, organization_id, campaign_id, platform, status');
    expect(svc).not.toContain("cron_run_id");
    expect(svc).not.toContain("cronRunId");
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("cronRunId not persisted");
  });

  it("webhook and retention not exposed as raw payload, retention state not persisted", () => {
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    expect(page).toContain("Retention state is not persisted");
    expect(page).toContain("Provider health is not persisted");
  });

  it("does not call external provider APIs", () => {
    const svc = readFileSync("src/server/admin/sentinel.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/sentinel/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toContain("fetch(");
      expect(c).not.toContain("createTwitchClient");
      expect(c).not.toContain("YouTubeClient");
    });
  });
});
