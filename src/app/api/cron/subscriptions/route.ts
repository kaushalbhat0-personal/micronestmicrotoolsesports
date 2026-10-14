import { NextResponse } from "next/server";
import { assertCronAuth } from "@/server/cron/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileAllSubscriptions } from "@/server/subscriptions/reconciler";
import { recordCronRunStart, recordCronRunComplete } from "@/server/cron/run-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertCronAuth(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const code = msg.includes("CRON_SECRET") ? 500 : 401;
    return NextResponse.json({ error: msg }, { status: code });
  }

  const supabase = createAdminClient();
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  console.warn(JSON.stringify({ event: "subscription_reconcile_started", runId, startedAt }));
  try {
    await recordCronRunStart("/api/cron/subscriptions", runId).catch(() => undefined);
    const result = await reconcileAllSubscriptions(supabase as never, { runId });
    console.warn(JSON.stringify({ event: "subscription_reconcile_completed", ...result }));
    await recordCronRunComplete(runId, true).catch(() => undefined);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(JSON.stringify({ event: "subscription_reconcile_failed", runId, error: msg.slice(0, 200) }));
    await recordCronRunComplete(runId, false, msg).catch(() => undefined);
    return NextResponse.json({ error: msg.slice(0, 200), runId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
