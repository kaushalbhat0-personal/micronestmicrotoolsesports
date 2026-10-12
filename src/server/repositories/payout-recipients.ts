import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayoutRecipientRow } from "@/features/payout-tracker/types";

/**
 * Prize Payout Tracker — recipient repository (thin Supabase access only).
 * Tenant isolation inherits through the parent tracker (RLS policies join
 * payout_trackers + is_org_member). Status toggles go through the atomic
 * apply RPC — direct status writes here are for tests only via RLS client
 * paths the services never use for toggles.
 */

const RECIPIENT_COLUMNS =
  "id, tracker_id, recipient_name, amount_minor, status, paid_at, reference_last4, proof_url, sort_order, created_at, updated_at";

export type CreatePayoutRecipientInput = {
  tracker_id: string;
  recipient_name: string;
  amount_minor: number;
  reference_last4: string | null;
  proof_url: string | null;
  sort_order: number;
};

export async function createPayoutRecipient(
  supabase: SupabaseClient,
  input: CreatePayoutRecipientInput,
): Promise<PayoutRecipientRow> {
  const { data, error } = await supabase
    .from("payout_recipients")
    .insert({
      tracker_id: input.tracker_id,
      recipient_name: input.recipient_name,
      amount_minor: input.amount_minor,
      reference_last4: input.reference_last4,
      proof_url: input.proof_url,
      sort_order: input.sort_order,
    })
    .select(RECIPIENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayoutRecipientRow;
}

export async function listPayoutRecipientsByTracker(
  supabase: SupabaseClient,
  trackerId: string,
): Promise<PayoutRecipientRow[]> {
  const { data, error } = await supabase
    .from("payout_recipients")
    .select(RECIPIENT_COLUMNS)
    .eq("tracker_id", trackerId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PayoutRecipientRow[];
}

export async function countPayoutRecipientsByTracker(
  supabase: SupabaseClient,
  trackerId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("payout_recipients")
    .select("id", { count: "exact", head: true })
    .eq("tracker_id", trackerId);
  if (error) throw error;
  return count ?? 0;
}

export async function findPayoutRecipientById(
  supabase: SupabaseClient,
  id: string,
): Promise<PayoutRecipientRow | null> {
  const { data, error } = await supabase.from("payout_recipients").select(RECIPIENT_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as PayoutRecipientRow;
}

export async function updatePayoutRecipient(
  supabase: SupabaseClient,
  id: string,
  input: { recipient_name: string; amount_minor: number; reference_last4: string | null; proof_url: string | null },
): Promise<PayoutRecipientRow> {
  const { data, error } = await supabase
    .from("payout_recipients")
    .update({
      recipient_name: input.recipient_name,
      amount_minor: input.amount_minor,
      reference_last4: input.reference_last4,
      proof_url: input.proof_url,
    })
    .eq("id", id)
    .select(RECIPIENT_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayoutRecipientRow;
}

export async function deletePayoutRecipient(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("payout_recipients").delete().eq("id", id);
  if (error) throw error;
}

/** Atomic recipient creation with tracker-scoped cap serialization (service-role RPC). */
export async function createPayoutRecipientViaRpc(
  adminClient: SupabaseClient,
  organizationId: string,
  trackerId: string,
  userId: string,
  input: { recipient_name: string; amount_minor: number; reference_last4: string | null; proof_url: string | null },
): Promise<PayoutRecipientRow> {
  const { data, error } = await adminClient.rpc("create_payout_recipient", {
    p_org_id: organizationId,
    p_tracker_id: trackerId,
    p_user_id: userId,
    p_name: input.recipient_name,
    p_amount_minor: input.amount_minor,
    p_reference_last4: input.reference_last4,
    p_proof_url: input.proof_url,
  });
  if (error) throw error;
  return data as PayoutRecipientRow;
}

/** Atomic status toggle + completion derivation (service-role RPC). */
export async function applyPayoutRecipientStatusViaRpc(
  adminClient: SupabaseClient,
  organizationId: string,
  trackerId: string,
  recipientId: string,
  status: "pending" | "paid",
  userId: string,
): Promise<PayoutRecipientRow> {
  const { data, error } = await adminClient.rpc("apply_payout_recipient_status", {
    p_org_id: organizationId,
    p_tracker_id: trackerId,
    p_recipient_id: recipientId,
    p_status: status,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as PayoutRecipientRow;
}
