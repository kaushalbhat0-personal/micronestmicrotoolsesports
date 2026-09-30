import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { handleRouteError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRetention } from "@/server/cron/sentinel-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron: Sponsor Sentinel retention — deterministic, tenant-safe, bounded.
 * No organization_id from request; derived from trusted DB records only.
 */
async function handler(request: Request) {
  const cronRunId = randomUUID();
  const cronStart = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  try {
    assertCronAuth(request);

    console.warn(JSON.stringify({ event: "sentinel_retention_started", cronRunId, startedAt: new Date().toISOString() }));

    const supabase = createAdminClient();
    const summary = await runRetention(supabase, { cronRunId });

    const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - cronStart);
    console.warn(
      JSON.stringify({
        event: "sentinel_retention_completed",
        cronRunId,
        durationMs,
        ...summary,
      }),
    );

    return NextResponse.json({ ok: true, ...summary }, { status: 200 });
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
