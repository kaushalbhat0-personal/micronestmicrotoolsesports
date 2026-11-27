import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { VerificationResult } from "@/server/webhooks/types";
import { verifyWebhookRequest } from "@/server/webhooks/verifier";
import { parseTwitchEvent } from "@/server/integrations/twitch/parser";
import { parseKickEvent } from "@/server/integrations/kick/parser";
import { parseYouTubeAtom } from "@/server/integrations/youtube/parser";
import { normalizeWebhookEvent } from "./normalizer";
import { resolveTenantForWebhook } from "./tenant-resolver";
import { persistWebhookEventIdempotent } from "@/server/repositories/webhook-events";
import { ingestWebhookEvent } from "./ingestor";

export type WebhookPipelineStatus =
  | "processed"
  | "duplicate"
  | "ignored"
  | "challenge"
  | "invalid"
  | "unsupported"
  | "error";

export interface WebhookPipelineResult {
  readonly status: WebhookPipelineStatus;
  readonly reason?: string;
  readonly challenge?: string;
  readonly organizationId?: string | null;
  readonly externalEventId?: string;
}

/**
 * Staged webhook ingestion pipeline (08B):
 * VERIFY → PARSE → NORMALIZE → TENANT RESOLVE → PERSIST → INGEST
 * Thin orchestration; provider-specific logic isolated in parsers.
 */
export async function runWebhookPipeline(params: {
  supabase: SupabaseClient;
  provider: Platform | string;
  request: Request;
  rawBody: string;
}): Promise<WebhookPipelineResult> {
  const { supabase, provider, request, rawBody } = params;

  // Validate provider from route (trusted boundary)
  if (provider !== "twitch" && provider !== "youtube" && provider !== "kick") {
    return { status: "unsupported", reason: `unsupported platform ${provider}` };
  }

  // 1. VERIFY (08A boundary, raw body)
  let verified: VerificationResult;
  try {
    verified = await verifyWebhookRequest(request, rawBody);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "verify error" };
  }
  if (verified.status !== "VERIFIED") {
    if (verified.status === "UNSUPPORTED") return { status: "unsupported", reason: verified.message };
    if (verified.status === "MALFORMED" || verified.status === "STALE" || verified.status === "REPLAY") {
      return { status: "invalid", reason: verified.message };
    }
    return { status: "invalid", reason: verified.message };
  }

  // Challenge handling — do NOT persist as business event (Twitch/YouTube)
  if (verified.challenge) {
    return { status: "challenge", challenge: verified.challenge };
  }
  // Twitch revocation — not a business event
  if (verified.messageType === "revocation") {
    return { status: "ignored", reason: "revocation" };
  }

  // 2. PARSE — provider-specific, only after verification
  let canonical;
  let parsed;
  try {
    if (provider === "twitch") {
      const res = parseTwitchEvent(rawBody, verified, request.headers);
      if (res.kind === "challenge") return { status: "challenge", challenge: res.challenge };
      if (res.kind === "revocation") return { status: "ignored", reason: "revocation" };
      parsed = res.parsed;
      canonical = res.canonical;
    } else if (provider === "kick") {
      const res = parseKickEvent(rawBody, verified, request.headers);
      parsed = res.parsed;
      canonical = res.canonical;
    } else if (provider === "youtube") {
      const res = parseYouTubeAtom(rawBody, verified);
      if (res && typeof res === "object" && "kind" in res && (res as { kind: string }).kind === "challenge") {
        return { status: "challenge", challenge: (res as { challenge: string }).challenge };
      }
      const yt = res as unknown as { parsed: typeof parsed; canonical: typeof canonical };
      parsed = yt.parsed;
      canonical = yt.canonical;
    }
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "parse error" };
  }
  if (!canonical || !parsed) return { status: "error", reason: "parse returned empty" };

  // 3. NORMALIZE — provider-neutral canonical live/video or null (unsupported type)
  let normalized;
  try {
    normalized = await normalizeWebhookEvent(parsed);
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "normalize error" };
  }
  // Note: normalized === null means valid but irrelevant to Sentinel (still persist but not ingest as evidence)
  // We continue to persist for idempotency/debug.

  // 4. TENANT RESOLVE — from trusted connected_channels, never from payload
  let organizationId: string | null = null;
  try {
    organizationId = await resolveTenantForWebhook(supabase, provider as Platform, canonical.externalChannelId);
  } catch {
    organizationId = null;
  }
  if (!organizationId) {
    // Persist as unmapped/ignored with null org for debugging (if we can), then return ignored
    // Do not trigger ingestion
    const payloadToStore = sanitizePayloadForStorage(canonical.payload);
    const persistRes = await persistWebhookEventIdempotent(supabase, {
      organization_id: null,
      provider: provider as never,
      provider_event_id: canonical.externalEventId,
      platform: provider as Platform,
      external_event_id: canonical.externalEventId,
      event_type: canonical.eventType,
      payload: payloadToStore as never,
      status: "failed",
    });
    if (persistRes.status === "duplicate") return { status: "duplicate", reason: "already processed", externalEventId: canonical.externalEventId };
    if (persistRes.status === "failed") return { status: "error", reason: persistRes.error };
    return { status: "ignored", reason: "unmapped channel", organizationId: null, externalEventId: canonical.externalEventId };
  }

  // 5. PERSIST — idempotent via unique (provider, external_event_id)
  const payloadToStore = sanitizePayloadForStorage(canonical.payload);
  const persistResult = await persistWebhookEventIdempotent(supabase, {
    organization_id: organizationId,
    provider: provider as never,
    provider_event_id: canonical.externalEventId,
    platform: provider as Platform,
    external_event_id: canonical.externalEventId,
    event_type: canonical.eventType,
    payload: payloadToStore as never,
    status: "succeeded",
  });
  if (persistResult.status === "duplicate") {
    return { status: "duplicate", reason: "already processed", organizationId, externalEventId: canonical.externalEventId };
  }
  if (persistResult.status === "failed") {
    return { status: "error", reason: persistResult.error };
  }

  // 6. INGEST — only on NEW; dispatches to Sentinel handler (09) which may trigger scoped scanner
  try {
    await ingestWebhookEvent(supabase, normalized, canonical);
  } catch (e) {
    // Ingestion failure should not revert persistence; log and return accordingly
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(JSON.stringify({ event: "webhook_ingest_failed", organizationId, externalEventId: canonical.externalEventId, provider, error: msg.slice(0, 200) }));
    // Still return processed as webhook was persisted; scanner will retry via cron on failure
  }

  return { status: "processed", organizationId, externalEventId: canonical.externalEventId };
}

function sanitizePayloadForStorage(payload: unknown): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== "object") return payload;
  // Shallow sanitize: remove known secret keys if present (defense in depth)
  const obj = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(sanitized)) {
    const lk = k.toLowerCase();
    if (lk.includes("secret") || lk.includes("signature") || lk.includes("authorization") || lk.includes("verify_token")) {
      delete sanitized[k];
    }
  }
  // Recurse one level for subscription.transport.secret
  if (sanitized.subscription && typeof sanitized.subscription === "object") {
    const sub = sanitized.subscription as Record<string, unknown>;
    if (sub.transport && typeof sub.transport === "object") {
      const t = sub.transport as Record<string, unknown>;
      const { secret: _s, ...rest } = t;
      void _s;
      sanitized.subscription = { ...sub, transport: rest };
    }
  }
  return sanitized;
}
