import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runWebhookPipeline } from "@/server/events/webhook-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Thin webhook boundary for YouTube PubSubHubbub (08B).
 * Challenge via GET hub.challenge echo, notifications via POST Atom.
 * Verification: verify_token + topic + Atom valid (no HMAC).
 */
async function handleYouTube(request: Request) {
  const rawBody = request.method === "POST" ? await request.text() : "";

  // YouTube challenge is GET with hub.challenge — pipeline handles it via verifier
  const supabase = createAdminClient();
  const result = await runWebhookPipeline({ supabase: supabase as never, provider: "youtube", request, rawBody });

  if (result.status === "challenge" && result.challenge) {
    return new NextResponse(result.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (result.status === "processed" || result.status === "duplicate" || result.status === "ignored") {
    return NextResponse.json({ status: result.status, provider: "youtube", externalEventId: result.externalEventId }, { status: 200 });
  }
  if (result.status === "invalid") {
    return NextResponse.json({ status: "REJECTED", errorKind: "invalid_verify_token" }, { status: 403 });
  }
  if (result.status === "unsupported") {
    return NextResponse.json({ status: "UNSUPPORTED" }, { status: 400 });
  }
  if (result.status === "error") {
    const isPayloadError = result.reason?.includes("malformed") || result.reason?.includes("missing");
    return NextResponse.json({ status: "error", reason: result.reason }, { status: isPayloadError ? 400 : 500 });
  }
  return NextResponse.json({ status: result.status }, { status: 200 });
}

export async function GET(request: Request) {
  return handleYouTube(request);
}

export async function POST(request: Request) {
  return handleYouTube(request);
}
