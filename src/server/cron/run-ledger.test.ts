import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const JOB = "/api/cron/sentinel-scan";
const RUN = "run-ledger-regression-1";

async function mockedAdmin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return vi.mocked(createAdminClient);
}

// Builder for the update → eq(run_id) → eq(status) → select(id) chain plus
// the follow-up existence re-read used by recordCronRunComplete.
function completeAdmin(opts: { updated: Array<{ id: string }>; existingStatus?: string | null }) {
  const update = vi.fn(async () => ({ data: opts.updated, error: null }));
  const admin = {
    from: vi.fn((table: string) => {
      if (table !== "cron_run_ledger") return {};
      return {
        insert: vi.fn((row: Record<string, unknown>) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { id: "ledger-1", ...row }, error: null })),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ select: vi.fn(update) })),
            maybeSingle: vi.fn(async () => ({
              data: opts.existingStatus ? { id: "ledger-1", status: opts.existingStatus } : null,
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({ select: vi.fn(update) })),
            select: vi.fn(update),
          })),
          select: vi.fn(update),
        })),
      };
    }),
  };
  return admin;
}

describe("Cron ledger immutability — RCCF-SUPERADMIN-V1-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insert works through the trusted writer path as running", async () => {
    const { recordCronRunStart } = await import("./run-ledger");
    const admin = completeAdmin({ updated: [] });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await recordCronRunStart(JOB, RUN);
    expect(res.id).toBe("ledger-1");
    const insert = (admin.from as ReturnType<typeof vi.fn>).mock.results[0]?.value.insert as ReturnType<typeof vi.fn>;
    expect(insert).toHaveBeenCalledWith({ job_id: JOB, run_id: RUN, status: "running" });
  });

  it("running → succeeded works through the guarded writer", async () => {
    const { recordCronRunComplete } = await import("./run-ledger");
    const admin = completeAdmin({ updated: [{ id: "ledger-1" }] });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    await recordCronRunComplete(RUN, true);
    const update = (admin.from as ReturnType<typeof vi.fn>).mock.results[0]?.value.update as ReturnType<typeof vi.fn>;
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "succeeded", error_summary: null }),
    );
    // guarded to running rows only
    const firstEq = update.mock.results[0]?.value.eq as ReturnType<typeof vi.fn>;
    expect(firstEq).toHaveBeenCalledWith("run_id", RUN);
    const secondEq = firstEq.mock.results[0]?.value.eq as ReturnType<typeof vi.fn>;
    expect(secondEq).toHaveBeenCalledWith("status", "running");
  });

  it("running → failed records a bounded error summary", async () => {
    const { recordCronRunComplete } = await import("./run-ledger");
    const admin = completeAdmin({ updated: [{ id: "ledger-1" }] });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    await recordCronRunComplete(RUN, false, "x".repeat(9000));
    const update = (admin.from as ReturnType<typeof vi.fn>).mock.results[0]?.value.update as ReturnType<typeof vi.fn>;
    const payload = update.mock.calls[0]?.[0] as { status: string; error_summary: string; completed_at: string };
    expect(payload.status).toBe("failed");
    expect(payload.error_summary.length).toBeLessThanOrEqual(500);
    expect(typeof payload.completed_at).toBe("string");
  });

  it("terminal re-completion is a safe no-op, unknown runs still error", async () => {
    const { recordCronRunComplete } = await import("./run-ledger");
    const adminMock = await mockedAdmin();

    // already succeeded → resolves without throwing (idempotent)
    adminMock.mockReturnValueOnce(completeAdmin({ updated: [], existingStatus: "succeeded" }) as never);
    await expect(recordCronRunComplete(RUN, true)).resolves.toBeUndefined();

    // unknown run_id → truthful failure (writer cannot invent history)
    adminMock.mockReturnValueOnce(completeAdmin({ updated: [], existingStatus: null }) as never);
    await expect(recordCronRunComplete("no-such-run", true)).rejects.toThrow(/not found or not running/);
  });

  it("migration enforces lifecycle at the DB layer for all roles", () => {
    const sql = readFileSync("supabase/migrations/20251108000001_superadmin_v1_03_hardening.sql", "utf8");
    // single lifecycle function + three triggers (insert/update/delete)
    expect(sql).toMatch(/create or replace function public\.enforce_cron_run_ledger_lifecycle\(\)/);
    expect(sql).toMatch(/before insert on public\.cron_run_ledger/);
    expect(sql).toMatch(/before update on public\.cron_run_ledger/);
    expect(sql).toMatch(/before delete on public\.cron_run_ledger/);
    // terminal rows immutable, single legal transition, identity immutable
    expect(sql).toMatch(/terminal rows are immutable/);
    expect(sql).toMatch(/only running → succeeded\/failed allowed/);
    expect(sql).toMatch(/identity columns are immutable/);
    expect(sql).toMatch(/INSERT must start as running/);
    expect(sql).toMatch(/DELETE not allowed/);
    expect(sql).toMatch(/must set completed_at/);
  });

  it("migration preserves RLS, uniqueness, and the 500-char error limit", () => {
    const sql = readFileSync("supabase/migrations/20251108000001_superadmin_v1_03_hardening.sql", "utf8");
    // no RLS or index changes — the original table definition stands
    expect(sql).not.toMatch(/enable row level security/);
    expect(sql).not.toMatch(/create policy/);
    expect(sql).not.toMatch(/cron_run_ledger_run_unique/);
    expect(sql).not.toMatch(/char_length\(error_summary\)/);
    // no secret-bearing columns in the trigger DDL (header prose may name
    // the policy, e.g. "no secrets/payloads", but DDL must not add them)
    const ddl = sql.slice(sql.indexOf("create or replace function public.enforce_cron_run_ledger_lifecycle()"));
    expect(ddl).not.toMatch(/payload/i);
    expect(ddl).not.toMatch(/secret/i);
    expect(ddl).not.toMatch(/token/i);
  });

  it("admin reader remains super-admin gated", () => {
    const svc = readFileSync("src/server/cron/run-ledger.ts", "utf8");
    const readerBody = svc.slice(svc.indexOf("export async function getCronLedgerSummaries"));
    expect(readerBody).toContain("requireSuperAdmin(");
  });
});
