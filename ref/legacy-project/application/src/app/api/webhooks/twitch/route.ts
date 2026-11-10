import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWebhookPipeline } from "@/server/events/webhook-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thin webhook boundary for Twitch EventSub (08B).
 * VERIFY (08A) → PARSE → NORMALIZE → TENANT RESOLVE → PERSIST → INGEST
 * Challenge is echoed as text/plain, never persisted.
 */
async function handleTwitch(request: Request) {
  const rawBody = await request.text();

  // For health checks without body
  if (request.method === "GET" && !rawBody) {
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }

  const supabase = createAdminClient();
  const result = await runWebhookPipeline({ supabase: supabase as never, provider: "twitch", request, rawBody });

  if (result.status === "challenge" && result.challenge) {
    return new NextResponse(result.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Content-Length": String(result.challenge.length) },
    });
  }
  if (result.status === "processed" || result.status === "duplicate" || result.status === "ignored") {
    return NextResponse.json({ status: result.status, provider: "twitch", externalEventId: result.externalEventId }, { status: 200 });
  }
  if (result.status === "invalid") {
    return NextResponse.json({ status: "REJECTED", errorKind: "invalid_signature" }, { status: 403 });
  }
  if (result.status === "unsupported") {
    return NextResponse.json({ status: "UNSUPPORTED" }, { status: 400 });
  }
  if (result.status === "error") {
    // Persistence failure → 500 so provider retries; parse errors → 400
    const isPayloadError = result.reason?.includes("malformed") || result.reason?.includes("parse");
    return NextResponse.json({ status: "error", reason: result.reason }, { status: isPayloadError ? 400 : 500 });
  }
  return NextResponse.json({ status: result.status }, { status: 200 });
}

export async function POST(request: Request) {
  return handleTwitch(request);
}

export async function GET(request: Request) {
  return handleTwitch(request);
}
