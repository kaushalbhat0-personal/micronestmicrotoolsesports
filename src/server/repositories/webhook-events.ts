import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebhookEvent } from "@/types/database";

export type CreateWebhookEventInput = {
  organization_id?: string | null;
  provider: WebhookEvent["provider"];
  provider_event_id: string;
  platform?: WebhookEvent["platform"];
  external_event_id?: string | null;
  event_type?: string | null;
  payload?: unknown | null;
  received_at?: string;
  status?: "pending" | "processing" | "succeeded" | "failed";
};

export async function createWebhookEvent(
  supabase: SupabaseClient,
  input: CreateWebhookEventInput,
): Promise<WebhookEvent> {
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      organization_id: input.organization_id ?? null,
      provider: input.provider,
      provider_event_id: input.provider_event_id,
      platform: input.platform ?? null,
      external_event_id: input.external_event_id ?? input.provider_event_id,
      event_type: input.event_type ?? null,
      payload: input.payload ?? null,
      received_at: input.received_at ?? new Date().toISOString(),
      status: input.status ?? "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as WebhookEvent;
}

export type PersistResult =
  | { status: "new"; event: WebhookEvent }
  | { status: "duplicate"; event: WebhookEvent | null }
  | { status: "failed"; error: string };

/**
 * Idempotent persist — uses unique (provider, external_event_id).
 * Never throws on duplicate; returns typed result.
 * Payload is sanitized caller-side (no secrets/signatures).
 */
export async function persistWebhookEventIdempotent(
  supabase: SupabaseClient,
  input: CreateWebhookEventInput,
): Promise<PersistResult> {
  try {
    const event = await createWebhookEvent(supabase, input);
    return { status: "new", event };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isDuplicate = msg.includes("duplicate") || msg.includes("unique") || msg.includes("violates unique constraint") || msg.includes("already exists");
    if (isDuplicate) {
      // Try to fetch existing for caller convenience (best effort, ignore mock limitations)
      try {
        const existing = await findWebhookEventByProviderId(supabase, input.provider, input.provider_event_id);
        return { status: "duplicate", event: existing };
      } catch {
        return { status: "duplicate", event: null };
      }
    }
    return { status: "failed", error: msg };
  }
}

export async function findWebhookEventByProviderId(
  supabase: SupabaseClient,
  provider: string,
  providerEventId: string,
): Promise<WebhookEvent | null> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .single();
  if (error) return null;
  return data as WebhookEvent;
}
