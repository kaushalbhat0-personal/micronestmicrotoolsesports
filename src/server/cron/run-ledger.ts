import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";

export type CronRunStatus = "running" | "succeeded" | "failed";

export interface CronRunRecord {
  id: string;
  jobId: string;
  runId: string;
  status: CronRunStatus;
  startedAt: string;
  completedAt: string | null;
  errorSummary: string | null;
}

export interface CronJobLedgerSummary {
  jobId: string;
  lastRun: CronRunRecord | null;
  lastSuccess: CronRunRecord | null;
  lastFailure: CronRunRecord | null;
  totalRuns: number | null;
}

/**
 * Server-side only cron run writer. Called from cron route handlers AFTER
 * assertCronAuth — never from client components. Uses service_role directly
 * (no requireSuperAdmin: cron has no user session, auth is the bearer secret).
 */
export async function recordCronRunStart(jobId: string, runId: string): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cron_run_ledger")
    .insert({ job_id: jobId.slice(0, 120), run_id: runId.slice(0, 120), status: "running" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to record cron run start: ${error?.message ?? "unknown"}`);
  return { id: (data as { id: string }).id };
}

export async function recordCronRunComplete(runId: string, ok: boolean, errorSummary?: string): Promise<void> {
  const admin = createAdminClient();
  // Guard to running rows: with DB-level lifecycle enforcement, a second
  // completion of an already-terminal row must be a safe no-op, never an
  // arbitrary rewrite. Unknown run_ids still surface as errors.
  const { data, error } = await admin
    .from("cron_run_ledger")
    .update({
      status: ok ? "succeeded" : "failed",
      completed_at: new Date().toISOString(),
      error_summary: ok ? null : (errorSummary ?? "failed").slice(0, 500),
    })
    .eq("run_id", runId)
    .eq("status", "running")
    .select("id");
  if (error) throw new Error(`Failed to record cron run completion: ${error.message}`);
  const changed = Array.isArray(data) ? data.length > 0 : Boolean(data);
  if (!changed) {
    const { data: existing } = await admin.from("cron_run_ledger").select("id, status").eq("run_id", runId).maybeSingle();
    const status = (existing as { status: string } | null)?.status;
    // Already terminal → idempotent re-completion, no state change
    if (status === "succeeded" || status === "failed") return;
    throw new Error(`Cron run not found or not running: ${runId.slice(0, 120)}`);
  }
}

function toRecord(row: {
  id: string;
  job_id: string;
  run_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_summary: string | null;
}): CronRunRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    runId: row.run_id,
    status: row.status as CronRunStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorSummary: row.error_summary,
  };
}

/**
 * Admin-only ledger read. requireSuperAdmin before service_role.
 */
export async function getCronLedgerSummaries(jobIds: string[]): Promise<CronJobLedgerSummary[]> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const out: CronJobLedgerSummary[] = [];
  for (const jobId of jobIds.slice(0, 20)) {
    let lastRun: CronRunRecord | null = null;
    let lastSuccess: CronRunRecord | null = null;
    let lastFailure: CronRunRecord | null = null;
    let totalRuns: number | null = null;
    try {
      const { data } = await admin
        .from("cron_run_ledger")
        .select("id, job_id, run_id, status, started_at, completed_at, error_summary")
        .eq("job_id", jobId)
        .order("started_at", { ascending: false })
        .limit(1);
      const row = (data as Array<Parameters<typeof toRecord>[0]> | null)?.[0];
      if (row) lastRun = toRecord(row);
    } catch {
      lastRun = null;
    }
    try {
      const { data } = await admin
        .from("cron_run_ledger")
        .select("id, job_id, run_id, status, started_at, completed_at, error_summary")
        .eq("job_id", jobId)
        .eq("status", "succeeded")
        .order("started_at", { ascending: false })
        .limit(1);
      const row = (data as Array<Parameters<typeof toRecord>[0]> | null)?.[0];
      if (row) lastSuccess = toRecord(row);
    } catch {
      lastSuccess = null;
    }
    try {
      const { data } = await admin
        .from("cron_run_ledger")
        .select("id, job_id, run_id, status, started_at, completed_at, error_summary")
        .eq("job_id", jobId)
        .eq("status", "failed")
        .order("started_at", { ascending: false })
        .limit(1);
      const row = (data as Array<Parameters<typeof toRecord>[0]> | null)?.[0];
      if (row) lastFailure = toRecord(row);
    } catch {
      lastFailure = null;
    }
    try {
      const { count } = await admin.from("cron_run_ledger").select("id", { count: "exact", head: true }).eq("job_id", jobId);
      totalRuns = count ?? 0;
    } catch {
      totalRuns = null;
    }
    out.push({ jobId, lastRun, lastSuccess, lastFailure, totalRuns });
  }
  return out;
}
