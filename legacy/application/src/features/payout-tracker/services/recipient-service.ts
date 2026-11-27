import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PayoutRecipientRow } from "../types";
import {
  addRecipientSchema,
  recipientIdSchema,
  recipientStatusSchema,
  trackerIdSchema,
  updateRecipientSchema,
  type AddRecipientInput,
  type UpdateRecipientInput,
} from "../schemas";
import { toMinor } from "./totals";
import { findPayoutTrackerById, refreshPayoutTrackerStatusViaRpc } from "@/server/repositories/payout-trackers";
import * as recipientRepo from "@/server/repositories/payout-recipients";
import { requirePayoutTrackerOwned } from "./tracker-service";
import { assertPayoutTrackerCovered, mapCreatePayoutRecipientError, resolvePayoutTrackerAccessLevel } from "@/server/services/payout-tracker-policy";

/**
 * Prize Payout Tracker — recipient service.
 * Mutations verify parent-tracker ownership first (cross-org recipient IDs
 * resolve to 404/403, never to another workspace's data). Paid/pending
 * toggles go through the atomic apply RPC so the published/completed
 * derivation commits in the same transaction.
 */

function requireRecipientOwned(
  recipient: PayoutRecipientRow | null,
  trackerId: string,
): PayoutRecipientRow {
  if (!recipient) throw notFoundError("Recipient not found");
  if (recipient.tracker_id !== trackerId) throw forbiddenError("You don't have access to this recipient.");
  return recipient;
}

async function refreshIfLive(organizationId: string, userId: string, trackerId: string, status: string): Promise<void> {
  if (status === "published" || status === "completed") {
    await refreshPayoutTrackerStatusViaRpc(createAdminClient(), organizationId, trackerId, userId);
  }
}

export async function addRecipient(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
  raw: AddRecipientInput,
): Promise<PayoutRecipientRow> {
  const input = parseOrThrow(addRecipientSchema, raw);
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await findPayoutTrackerById(supabase, id), organizationId);
  const level = await resolvePayoutTrackerAccessLevel(supabase, { organizationId });
  assertPayoutTrackerCovered(level);
  // Cap + insert + live-status refresh commit atomically inside
  // create_payout_recipient (tracker-scoped advisory lock), so concurrent
  // adds serialize instead of racing past the cap.
  try {
    return await recipientRepo.createPayoutRecipientViaRpc(createAdminClient(), organizationId, tracker.id, userId, {
      recipient_name: input.name,
      amount_minor: toMinor(input.amountMajor),
      reference_last4: input.referenceLast4 ?? null,
      proof_url: input.proofUrl ?? null,
    });
  } catch (e) {
    throw mapCreatePayoutRecipientError(e, level);
  }
}

export async function updateRecipient(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
  recipientId: string,
  raw: UpdateRecipientInput,
): Promise<PayoutRecipientRow> {
  const input = parseOrThrow(updateRecipientSchema, raw);
  const tid = parseOrThrow(trackerIdSchema, trackerId);
  const rid = parseOrThrow(recipientIdSchema, recipientId);
  const tracker = requirePayoutTrackerOwned(await findPayoutTrackerById(supabase, tid), organizationId);
  requireRecipientOwned(await recipientRepo.findPayoutRecipientById(supabase, rid), tracker.id);
  const recipient = await recipientRepo.updatePayoutRecipient(supabase, rid, {
    recipient_name: input.name,
    amount_minor: toMinor(input.amountMajor),
    reference_last4: input.referenceLast4,
    proof_url: input.proofUrl,
  });
  await refreshIfLive(organizationId, userId, tracker.id, tracker.status);
  return recipient;
}

export async function removeRecipient(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
  recipientId: string,
): Promise<void> {
  const tid = parseOrThrow(trackerIdSchema, trackerId);
  const rid = parseOrThrow(recipientIdSchema, recipientId);
  const tracker = requirePayoutTrackerOwned(await findPayoutTrackerById(supabase, tid), organizationId);
  requireRecipientOwned(await recipientRepo.findPayoutRecipientById(supabase, rid), tracker.id);
  await recipientRepo.deletePayoutRecipient(supabase, rid);
  await refreshIfLive(organizationId, userId, tracker.id, tracker.status);
}

/** Mark paid / back to pending. Atomic with the completion derivation (apply RPC). */
export async function setRecipientStatus(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
  recipientId: string,
  raw: unknown,
): Promise<PayoutRecipientRow> {
  const status = parseOrThrow(recipientStatusSchema, raw);
  const tid = parseOrThrow(trackerIdSchema, trackerId);
  const rid = parseOrThrow(recipientIdSchema, recipientId);
  const tracker = requirePayoutTrackerOwned(await findPayoutTrackerById(supabase, tid), organizationId);
  requireRecipientOwned(await recipientRepo.findPayoutRecipientById(supabase, rid), tracker.id);
  return recipientRepo.applyPayoutRecipientStatusViaRpc(
    createAdminClient(),
    organizationId,
    tracker.id,
    rid,
    status,
    userId,
  );
}
