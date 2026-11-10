/**
 * YouTube WebSub (PubSubHubbub) verification — no cryptographic signature for MVP.
 * Per https://developers.google.com/youtube/v3/guides/push_notifications and PubSubHubbub spec:
 * - Subscription verification is GET to callback with hub.mode, hub.topic, hub.challenge
 * - Notifications are POST with Atom XML, Content-Type application/atom+xml, no HMAC.
 * We model this difference explicitly: YouTube does NOT use HMAC/signature.
 */

import type { VerificationResult } from "@/server/webhooks/types";

export async function verifyYouTubeRequest(request: Request, rawBody: string): Promise<VerificationResult> {
  const url = new URL(request.url);

  // Challenge verification for subscription (GET)
  const hubMode = url.searchParams.get("hub.mode");
  const hubChallenge = url.searchParams.get("hub.challenge");
  const hubTopic = url.searchParams.get("hub.topic");
  const hubVerifyToken = url.searchParams.get("hub.verify_token");

  // If this is a challenge request, handle it
  if (hubMode && hubChallenge) {
    // For MVP polling, we don't enforce verify_token strictly unless configured
    const expectedToken = process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN;
    if (expectedToken && hubVerifyToken !== expectedToken) {
      return { status: "REJECTED", provider: "youtube", errorKind: "invalid_verify_token", message: "Invalid YouTube verify token" };
    }
    // Verify hub.topic looks like YouTube feed
    if (hubTopic && !hubTopic.includes("youtube.com")) {
      return { status: "MALFORMED", provider: "youtube", errorKind: "invalid_topic", message: "Invalid YouTube hub topic" };
    }

    return {
      status: "VERIFIED",
      provider: "youtube",
      rawBody,
      challenge: hubChallenge,
      eventType: hubMode,
    };
  }

  // POST notification handling
  if (request.method === "POST") {
    if (rawBody.length > 1_000_000) {
      return { status: "MALFORMED", provider: "youtube", errorKind: "body_too_large", message: "Body too large" };
    }
    if (!rawBody || rawBody.trim().length === 0) {
      return { status: "MALFORMED", provider: "youtube", errorKind: "empty_body", message: "Empty YouTube notification body" };
    }
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    // YouTube notifications are Atom XML, but we accept without strict check for forward compatibility
    const isXml = rawBody.trim().startsWith("<?xml") || rawBody.trim().startsWith("<feed") || rawBody.includes("<entry");
    if (!isXml && !contentType.includes("xml") && !contentType.includes("atom")) {
      // Not strictly rejecting, but mark as malformed; for MVP we treat non-XML as malformed
      return { status: "MALFORMED", provider: "youtube", errorKind: "malformed_body", message: "YouTube notification expected Atom XML" };
    }

    // Extract basic metadata for verification result without trusting it
    let eventId: string | undefined;
    let eventType: string | undefined;
    try {
      // Simple extraction without full XML parse for verification boundary
      const match = rawBody.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (match) eventId = match[1];
      if (rawBody.includes("<entry")) eventType = "video_published";
    } catch {
      // ignore
    }

    return {
      status: "VERIFIED",
      provider: "youtube",
      eventId,
      eventType,
      rawBody,
    };
  }

  // For GET without challenge, or other methods, treat as unsupported
  if (request.method === "GET" && !hubChallenge) {
    return { status: "MALFORMED", provider: "youtube", errorKind: "missing_challenge", message: "Missing hub.challenge for YouTube verification" };
  }

  return { status: "UNSUPPORTED", provider: "youtube", errorKind: "unsupported_method", message: "Unsupported YouTube webhook method" };
}
