import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadEligibleCampaigns, runCampaignScans } from "@/server/cron/sentinel-scan";
import { recordCronRunStart, recordCronRunComplete } from "@/server/cron/run-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: Sponsor Sentinel scheduled scan
 * Vercel Cron → Authorization: Bearer <CRON_SECRET> → eligible campaigns → executeScan()
 * No tenant identity from request — derived from trusted DB records only.
 * 06B hardening: cronRunId correlation, monotonic timing, structured safe logs.
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  const cronStart = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  try {
    assertCronAuth(request);

    // Append-only run ledger (best-effort — never blocks the scan)
    try {
      await recordCronRunStart("/api/cron/sentinel-scan", cronRunId);
    } catch {
      // ledger write failure is non-fatal
    }

    console.warn(
      JSON.stringify({
        event: "sentinel_cron_started",
        cronRunId,
        startedAt: new Date().toISOString(),
      }),
    );

    const supabase = createAdminClient();

    const eligible = await loadEligibleCampaigns(supabase);

    console.warn(
      JSON.stringify({
        event: "sentinel_cron_eligible",
        cronRunId,
        eligibleCount: eligible.length,
      }),
    );

    const { attempted, succeeded, failed } = await runCampaignScans(supabase, eligible, { cronRunId });

    try {
      await recordCronRunComplete(cronRunId, failed === 0);
    } catch {
      // non-fatal
    }

    const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - cronStart);
    console.warn(
      JSON.stringify({
        event: "sentinel_cron_completed",
        cronRunId,
        durationMs,
        attempted,
        succeeded,
        failed,
      }),
    );

    return NextResponse.json({ ok: true, attempted, succeeded, failed }, { status: 200 });
  } catch (error) {
    // Genuine runtime failure before campaign execution (auth/config) — do not swallow as 200
    try {
      await recordCronRunComplete(cronRunId, false, error instanceof Error ? error.message : String(error));
    } catch {
      // non-fatal
    }
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
