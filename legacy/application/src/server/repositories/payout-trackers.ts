import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayoutTrackerRow } from "@/features/payout-tracker/types";

/**
 * Prize Payout Tracker — tracker repository (thin Supabase access only).
 * Ownership is enforced in services via requirePayoutTrackerOwned; RLS is
 * the database backstop. Status/share_token writes are impossible here —
 * the transition guard trigger rejects them; use the *_viaQuota/*_viaRpc
 * wrappers (service-role RPCs) instead.
 */

const TRACKER_COLUMNS =
  "id, organization_id, created_by, event_name, currency, deadline, status, share_token, published_at, completed_at, created_at, updated_at";

export type CreatePayoutTrackerInput = {
  organization_id: string;
  created_by: string;
  event_name: string;
  currency: string;
  deadline: string | null;
};

export async function createPayoutTracker(
  supabase: SupabaseClient,
  input: CreatePayoutTrackerInput,
): Promise<PayoutTrackerRow> {
  const { data, error } = await supabase
    .from("payout_trackers")
    .insert({
      organization_id: input.organization_id,
      created_by: input.created_by,
      event_name: input.event_name,
      currency: input.currency,
      deadline: input.deadline,
    })
    .select(TRACKER_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayoutTrackerRow;
}

export async function findPayoutTrackerById(
  supabase: SupabaseClient,
  id: string,
): Promise<PayoutTrackerRow | null> {
  const { data, error } = await supabase.from("payout_trackers").select(TRACKER_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as PayoutTrackerRow;
}

export async function listPayoutTrackersByOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<PayoutTrackerRow[]> {
  const { data, error } = await supabase
    .from("payout_trackers")
    .select(TRACKER_COLUMNS)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PayoutTrackerRow[];
}

export async function updatePayoutTrackerMeta(
  supabase: SupabaseClient,
  id: string,
  input: { event_name: string; deadline: string | null },
): Promise<PayoutTrackerRow> {
  const { data, error } = await supabase
    .from("payout_trackers")
    .update({ event_name: input.event_name, deadline: input.deadline })
    .eq("id", id)
    .select(TRACKER_COLUMNS)
    .single();
  if (error) throw error;
  return data as PayoutTrackerRow;
}

export async function deletePayoutTracker(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("payout_trackers").delete().eq("id", id);
  if (error) throw error;
}

/** Published trackers since a timestamp (workspace-month usage prefilter). */
export async function listPublishedPayoutTrackersSince(
  supabase: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<Pick<PayoutTrackerRow, "id" | "published_at">>> {
  const { data, error } = await supabase
    .from("payout_trackers")
    .select("id, published_at")
    .eq("organization_id", organizationId)
    .in("status", ["published", "completed"])
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<Pick<PayoutTrackerRow, "id" | "published_at">>;
}

/** Atomic publish + quota (service-role RPC). Idempotent for published rows. */
export async function publishPayoutTrackerViaQuota(
  adminClient: SupabaseClient,
  organizationId: string,
  trackerId: string,
  userId: string,
): Promise<PayoutTrackerRow> {
  const { data, error } = await adminClient.rpc("consume_payout_tracker_publish", {
    p_org_id: organizationId,
    p_tracker_id: trackerId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as PayoutTrackerRow;
}

/** Revoke share link by rotating the token (service-role RPC). */
export async function rotatePayoutTrackerTokenViaRpc(
  adminClient: SupabaseClient,
  organizationId: string,
  trackerId: string,
  userId: string,
): Promise<PayoutTrackerRow> {
  const { data, error } = await adminClient.rpc("rotate_payout_tracker_token", {
    p_org_id: organizationId,
    p_tracker_id: trackerId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as PayoutTrackerRow;
}

/** Recompute published/completed after recipient mutations (service-role RPC). */
export async function refreshPayoutTrackerStatusViaRpc(
  adminClient: SupabaseClient,
  organizationId: string,
  trackerId: string,
  userId: string,
): Promise<PayoutTrackerRow> {
  const { data, error } = await adminClient.rpc("refresh_payout_tracker_status", {
    p_org_id: organizationId,
    p_tracker_id: trackerId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as PayoutTrackerRow;
}
