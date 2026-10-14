import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCronLedgerSummaries, type CronJobLedgerSummary } from "@/server/cron/run-ledger";
import { STUCK_CREATED_AFTER_HOURS } from "@/server/admin/billing-exceptions";

/**
 * Minimal platform health probes — admin-only. No monitoring platform.
 * Keeps the honest distinction: Configured ≠ Executed ≠ Healthy.
 */

export interface DbProbe {
  healthy: boolean;
  latencyMs: number | null;
  error?: string | undefined;
}

export interface WebhookHealth {
  unprocessedCount: number | null;
  oldestUnprocessedAgeHours: number | null;
  recentFailureCount: number | null;
  error?: string | undefined;
}

export interface OrderHealth {
  stuckCreatedCount: number | null;
  error?: string | undefined;
}

export interface AdminHealthResult {
  db: DbProbe;
  webhooks: WebhookHealth;
  orders: OrderHealth;
  cron: CronJobLedgerSummary[];
  cronError?: string | undefined;
}

export const CRON_JOB_IDS = ["/api/cron/sentinel-scan", "/api/cron/sentinel-retention"] as const;

export async function getAdminHealth(): Promise<AdminHealthResult> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // DB probe — authenticated/admin-only, bounded latency, no connection details
  let db: DbProbe = { healthy: false, latencyMs: null };
  try {
    const start = Date.now();
    const { error } = await admin.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    const latencyMs = Date.now() - start;
    if (error) throw error;
    db = { healthy: true, latencyMs };
  } catch {
    db = { healthy: false, latencyMs: null, error: "Database probe failed" };
  }

  // Webhooks: unprocessed count, oldest unprocessed age, recent failure count
  let webhooks: WebhookHealth = { unprocessedCount: null, oldestUnprocessedAgeHours: null, recentFailureCount: null };
  try {
    const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("processed", false);
    if (error) throw error;
    let oldestAge: number | null = null;
    try {
      const { data } = await admin
        .from("webhook_events")
        .select("created_at")
        .eq("processed", false)
        .order("created_at", { ascending: true })
        .limit(1);
      const oldest = (data as Array<{ created_at: string }> | null)?.[0]?.created_at;
      if (oldest) oldestAge = Math.round((Date.now() - new Date(oldest).getTime()) / 3600000);
    } catch {
      oldestAge = null;
    }
    let recentFailures: number | null = null;
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count: failCount } = await admin
        .from("webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since);
      recentFailures = failCount ?? 0;
    } catch {
      recentFailures = null;
    }
    webhooks = { unprocessedCount: count ?? 0, oldestUnprocessedAgeHours: oldestAge, recentFailureCount: recentFailures };
  } catch {
    webhooks = { unprocessedCount: null, oldestUnprocessedAgeHours: null, recentFailureCount: null, error: "Webhook metrics unavailable" };
  }

  // Orders: stuck created count
  let orders: OrderHealth = { stuckCreatedCount: null };
  try {
    const cutoff = new Date(Date.now() - STUCK_CREATED_AFTER_HOURS * 3600 * 1000).toISOString();
    const { count, error } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "created")
      .lt("created_at", cutoff);
    if (error) throw error;
    orders = { stuckCreatedCount: count ?? 0 };
  } catch {
    orders = { stuckCreatedCount: null, error: "Order metrics unavailable" };
  }

  // Cron ledger
  let cron: CronJobLedgerSummary[] = [];
  let cronError: string | undefined;
  try {
    cron = await getCronLedgerSummaries([...CRON_JOB_IDS]);
  } catch {
    cronError = "Cron ledger unavailable.";
  }

  return { db, webhooks, orders, cron, cronError };
}
