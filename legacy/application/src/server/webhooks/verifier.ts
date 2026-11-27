import type { VerificationResult } from "./types";
import { verifyTwitchRequest } from "@/server/integrations/twitch/verifier";
import { verifyKickRequest } from "@/server/integrations/kick/verifier";
import { verifyYouTubeRequest } from "@/server/integrations/youtube/verifier";

export async function verifyWebhookRequest(
  request: Request,
  rawBody: string,
): Promise<VerificationResult> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.includes("/webhooks/twitch") || path.includes("/twitch")) {
    return verifyTwitchRequest(request, rawBody);
  }
  if (path.includes("/webhooks/kick") || path.includes("/kick")) {
    return verifyKickRequest(request, rawBody);
  }
  if (path.includes("/webhooks/youtube") || path.includes("/youtube")) {
    return verifyYouTubeRequest(request, rawBody);
  }

  // Fallback: try header-based provider detection
  if (request.headers.has("twitch-eventsub-message-id") || request.headers.has("Twitch-Eventsub-Message-Id")) {
    return verifyTwitchRequest(request, rawBody);
  }
  if (request.headers.has("kick-event-message-id") || request.headers.has("Kick-Event-Message-Id")) {
    return verifyKickRequest(request, rawBody);
  }
  if (request.headers.get("content-type")?.includes("atom+xml") || url.searchParams.has("hub.challenge")) {
    return verifyYouTubeRequest(request, rawBody);
  }

  return {
    status: "UNSUPPORTED",
    provider: "unknown" as unknown as VerificationResult["provider"],
    errorKind: "unsupported_provider",
    message: "Unsupported webhook provider",
  };
}
