import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleSentinelWebhookEvent } from "./sentinel-handler";

/**
 * Event ingestor for webhooks (09).
 * Dispatches normalized event to Sentinel handler which may trigger scoped scanner.
 * Does NOT duplicate provider fetch/evaluation logic — scanner remains authoritative.
 */
export async function ingestWebhookEvent(
  supabase: SupabaseClient,
  _canonical: CanonicalLiveStream | CanonicalVideo | null,
  webhook: CanonicalWebhookEvent,
): Promise<void> {
  await handleSentinelWebhookEvent(supabase, webhook);
}

export interface WebhookIngestor {
  ingest(canonical: CanonicalLiveStream | CanonicalVideo | null, webhook: CanonicalWebhookEvent): Promise<void>;
}
