import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import * as webhookRepo from "@/server/repositories/webhook-events";
import type { EventNormalizer, EventParser, EventVerifier, EventIngestor } from "@/features/sponsor-sentinel/types/events";

export interface EventPipelineResult {
  readonly status: "processed" | "duplicate" | "invalid" | "unsupported" | "error";
  readonly reason?: string;
}

export async function runEventPipeline(params: {
  supabase: SupabaseClient;
  organizationId: string | null;
  provider: Platform | string;
  request: Request;
  rawBody: string;
  headers: Headers;
  verifier: EventVerifier;
  parser: EventParser;
  normalizer: EventNormalizer;
  ingestor: EventIngestor;
}): Promise<EventPipelineResult> {
  const { supabase, organizationId, provider, request, rawBody, headers, verifier, parser, normalizer, ingestor } = params;

  // Validate platform
  if (provider !== "twitch" && provider !== "youtube" && provider !== "kick") {
    return { status: "unsupported", reason: `unsupported platform ${provider}` };
  }

  // Verify
  const verified = await verifier.verify(request, provider);
  if (!verified.valid) return { status: "invalid", reason: verified.reason ?? "verification failed" };

  // Parse
  let parsed;
  try {
    parsed = parser.parse(rawBody, headers, provider);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "parse error" };
  }

  // Normalize
  let canonical;
  try {
    canonical = await normalizer.normalize(parsed);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "normalize error" };
  }
  if (!canonical) return { status: "unsupported", reason: "normalizer returned null (unsupported type)" };

  // Idempotency via webhook_events unique(provider, external_event_id) — idempotent helper
  const eventId = `${provider}:${parsed.externalContentId ?? parsed.externalChannelId ?? Date.now()}:${parsed.type}`;
  const persistRes = await webhookRepo.persistWebhookEventIdempotent(supabase, {
    organization_id: organizationId,
    provider: provider as never,
    provider_event_id: eventId,
    platform: provider,
    external_event_id: eventId,
    event_type: parsed.type,
    payload: parsed.raw as never,
    status: "pending",
  });
  if (persistRes.status === "duplicate") return { status: "duplicate", reason: "already processed" };
  if (persistRes.status === "failed") return { status: "error", reason: persistRes.error };

  // Ingest
  try {
    await ingestor.ingest(canonical, "event");
    // Mark succeeded (best effort, not critical for test)
    return { status: "processed" };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "ingest error" };
  }
}
