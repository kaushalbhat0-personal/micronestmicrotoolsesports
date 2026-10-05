import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRetention } from "@/server/cron/sentinel-retention";
import { reconcileAllSubscriptions } from "@/server/subscriptions/reconciler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: Daily maintenance — retention + subscription reconciliation.
 * Merged for Hobby plan (2-cron limit). Both run sequentially, isolated.
 * - Retention: Sponsor Sentinel evidence/evaluation/scan/webhook cleanup (bounded, tenant-safe).
 * - Subscriptions: webhook subscription reconciliation (bounded, tenant-safe).
 * No organization_id from request; derived from trusted DB records only.
 * CRON_SECRET validated once at entry; both subsystems reuse same admin client.
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  const cronStart = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  try {
    assertCronAuth(request);

    console.warn(JSON.stringify({ event: "daily_maintenance_started", cronRunId, startedAt: new Date().toISOString() }));

    const supabase = createAdminClient();

    // Run retention first — bounded and tenant-isolated
    let retentionSummary: Awaited<ReturnType<typeof runRetention>> | null = null;
    let retentionError: unknown = null;
    try {
      console.warn(JSON.stringify({ event: "sentinel_retention_started", cronRunId, startedAt: new Date().toISOString() }));
      retentionSummary = await runRetention(supabase, { cronRunId });
      console.warn(JSON.stringify({ event: "sentinel_retention_completed", cronRunId, ...retentionSummary }));
    } catch (e) {
      retentionError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(JSON.stringify({ event: "sentinel_retention_failed", cronRunId, error: msg.slice(0, 200) }));
    }

    // Run subscription reconciliation second — bounded, failure isolated
    let subscriptionResult: Awaited<ReturnType<typeof reconcileAllSubscriptions>> | null = null;
    let subscriptionError: unknown = null;
    try {
      console.warn(JSON.stringify({ event: "subscription_reconcile_started", runId: cronRunId, startedAt: new Date().toISOString() }));
      subscriptionResult = await reconcileAllSubscriptions(supabase as never, { runId: cronRunId });
      console.warn(JSON.stringify({ event: "subscription_reconcile_completed", ...subscriptionResult }));
    } catch (e) {
      subscriptionError = e;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(JSON.stringify({ event: "subscription_reconcile_failed", runId: cronRunId, error: msg.slice(0, 200) }));
    }

    const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - cronStart);
    console.warn(
      JSON.stringify({
        event: "daily_maintenance_completed",
        cronRunId,
        durationMs,
        retention: retentionSummary ?? { error: retentionError instanceof Error ? retentionError.message.slice(0, 200) : String(retentionError) },
        subscriptions: subscriptionResult ?? { error: subscriptionError instanceof Error ? subscriptionError.message.slice(0, 200) : String(subscriptionError) },
      }),
    );

    // If both failed, propagate error (so Vercel marks cron failed)
    if (retentionError && subscriptionError) {
      throw retentionError;
    }
    if (retentionError) throw retentionError;
    if (subscriptionError) throw subscriptionError;

    return NextResponse.json({ ok: true, retention: retentionSummary, subscriptions: subscriptionResult, durationMs }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
