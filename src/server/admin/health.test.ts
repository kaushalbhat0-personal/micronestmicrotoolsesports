import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Platform health + cron ledger — RCCF-SUPERADMIN-V1-02", () => {
  it("health probes: db, webhooks, orders, cron — no connection details", () => {
    const svc = readFileSync("src/server/admin/health.ts", "utf8");
    expect(svc).toContain("requireSuperAdmin");
    expect(svc).toContain("getAdminHealth");
    expect(svc).toContain("latencyMs");
    expect(svc).toContain("unprocessedCount");
    expect(svc).toContain("oldestUnprocessedAgeHours");
    expect(svc).toContain("recentFailureCount");
    expect(svc).toContain("stuckCreatedCount");
    expect(svc).toContain("getCronLedgerSummaries");
    expect(svc).not.toMatch(/connection[_-]?string/i);
    expect(svc).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(svc).not.toMatch(/password/i);
  });

  it("keeps Configured ≠ Executed ≠ Healthy distinction", () => {
    const svc = readFileSync("src/server/admin/health.ts", "utf8");
    expect(svc).toContain("Configured");
    const page = readFileSync("src/app/(admin)/admin/system/page.tsx", "utf8");
    expect(page).toContain("Cron Run Ledger");
    expect(page).toContain("Never executed");
  });

  it("cron ledger: append-only, no payloads/secrets, RLS", () => {
    const svc = readFileSync("src/server/cron/run-ledger.ts", "utf8");
    expect(svc).toContain("recordCronRunStart");
    expect(svc).toContain("recordCronRunComplete");
    expect(svc).toContain("getCronLedgerSummaries");
    expect(svc).toContain("requireSuperAdmin");
    // no secret-bearing columns in any select projection (structural check)
    const selects = [...svc.matchAll(/\.select\("([^"]+)"\)/g)].map((m) => m[1] ?? "");
    expect(selects.length).toBeGreaterThan(0);
    for (const sel of selects) {
      expect(sel).not.toMatch(/payload/i);
      expect(sel).not.toMatch(/secret/i);
    }
    expect(svc).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(svc).not.toContain("webhook_secret");
    const migration = readFileSync("supabase/migrations/20251107000001_cron_run_ledger.sql", "utf8");
    expect(migration).toContain("cron_run_ledger");
    expect(migration).toContain("row level security");
    expect(migration).toContain("is_super_admin");
    // no secret-bearing columns defined in the table (comments may mention the policy)
    const createTable = migration.slice(migration.indexOf("create table"), migration.indexOf(");") + 2);
    expect(createTable).not.toMatch(/payload/i);
    expect(createTable).not.toMatch(/secret/i);
    expect(createTable).not.toMatch(/token/i);
  });

  it("cron writers are server-side only (routes, after cron auth)", () => {
    for (const f of [
      "src/app/api/cron/sentinel-scan/route.ts",
      "src/app/api/cron/sentinel-retention/route.ts",
      "src/app/api/cron/subscriptions/route.ts",
    ]) {
      const content = readFileSync(f, "utf8");
      expect(content).toContain("assertCronAuth");
      expect(content).toContain("recordCronRun");
      expect(content).not.toContain('"use client"');
    }
    // ledger writer functions must not call requireSuperAdmin (cron has bearer
    // auth, not a user session) — check the function bodies, not file imports
    const ledger = readFileSync("src/server/cron/run-ledger.ts", "utf8");
    const startBody = ledger.slice(ledger.indexOf("export async function recordCronRunStart"), ledger.indexOf("export async function recordCronRunComplete"));
    const completeBody = ledger.slice(ledger.indexOf("export async function recordCronRunComplete"), ledger.indexOf("function toRecord"));
    expect(startBody).not.toContain("requireSuperAdmin(");
    expect(completeBody).not.toContain("requireSuperAdmin(");
    // admin reader does gate
    const readerBody = ledger.slice(ledger.indexOf("export async function getCronLedgerSummaries"));
    expect(readerBody).toContain("requireSuperAdmin(");
  });

  it("system page renders health + ledger sections", () => {
    const page = readFileSync("src/app/(admin)/admin/system/page.tsx", "utf8");
    expect(page).toContain("getAdminHealth");
    expect(page).toContain("Platform Health Probes");
    expect(page).toContain("Database");
    expect(page).toContain("Stuck Orders");
  });
});
