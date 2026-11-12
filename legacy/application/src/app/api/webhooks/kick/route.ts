import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWebhookPipeline } from "@/server/events/webhook-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thin webhook boundary for Kick (08B).
 * VERIFY (RSA 08A) → PARSE → NORMALIZE → TENANT RESOLVE → PERSIST → INGEST
 */
async function handleKick(request: Request) {
  const rawBody = await request.text();
  const supabase = createAdminClient();
  const result = await runWebhookPipeline({ supabase: supabase as never, provider: "kick", request, rawBody });

  if (result.status === "processed" || result.status === "duplicate" || result.status === "ignored") {
    return NextResponse.json({ status: result.status, provider: "kick", externalEventId: result.externalEventId }, { status: 200 });
  }
  if (result.status === "invalid") {
    return NextResponse.json({ status: "REJECTED", errorKind: "invalid_signature" }, { status: 403 });
  }
  if (result.status === "unsupported") {
    return NextResponse.json({ status: "UNSUPPORTED" }, { status: 400 });
  }
  if (result.status === "error") {
    const isPayloadError = result.reason?.includes("malformed") || result.reason?.includes("parse");
    return NextResponse.json({ status: "error", reason: result.reason }, { status: isPayloadError ? 400 : 500 });
  }
  return NextResponse.json({ status: result.status }, { status: 200 });
}

export async function POST(request: Request) {
  return handleKick(request);
}

export async function GET(request: Request) {
  return handleKick(request);
}
