import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PayoutRecipientRow,
  PayoutTrackerRow,
} from "../types";
import {
  createTrackerSchema,
  trackerIdSchema,
  updateTrackerSchema,
  type CreateTrackerInput,
  type UpdateTrackerInput,
} from "../schemas";
import { deadlineInputToIso } from "./deadline";
import { toMinor } from "./totals";
import { assertTransition } from "./transitions";
import * as trackerRepo from "@/server/repositories/payout-trackers";
import * as recipientRepo from "@/server/repositories/payout-recipients";
import {
  FREE_PAYOUT_TRACKER_HISTORY_LIMIT,
  assertPayoutTrackerCovered,
  mapConsumePayoutPublishError,
  recipientsMaxForLevel,
  resolvePayoutTrackerAccessLevel,
  type PayoutTrackerAccessLevel,
} from "@/server/services/payout-tracker-policy";

/**
 * Prize Payout Tracker — tracker service.
 * Reads stay on the caller's RLS-aware client. Publish/revoke RPC calls
 * use the service-role client (those RPCs revoke authenticated execution).
 */

export function requirePayoutTrackerOwned(
  tracker: PayoutTrackerRow | null,
  organizationId: string,
): PayoutTrackerRow {
  if (!tracker) throw notFoundError("Tracker not found");
  if (tracker.organization_id !== organizationId) throw forbiddenError("You don't have access to this tracker.");
  return tracker;
}

export interface TrackerDetail {
  readonly tracker: PayoutTrackerRow;
  readonly recipients: PayoutRecipientRow[];
}

export async function createTracker(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  raw: CreateTrackerInput,
): Promise<TrackerDetail> {
  const input = parseOrThrow(createTrackerSchema, raw);
  const level = await resolvePayoutTrackerAccessLevel(supabase, { organizationId });
  assertPayoutTrackerCovered(level);
  const max = recipientsMaxForLevel(level);
  if (input.recipients.length > max) {
    throw validationError(
      level === "paid"
        ? `A tracker holds at most ${max} recipients.`
        : `Free trackers hold at most ${max} recipients. Upgrade for up to 200.`,
    );
  }
  const tracker = await trackerRepo.createPayoutTracker(supabase, {
    organization_id: organizationId,
    created_by: userId,
    event_name: input.eventName,
    currency: input.currency,
    deadline: input.deadline ? deadlineInputToIso(input.deadline) : null,
  });
  const recipients: PayoutRecipientRow[] = [];
  let order = 0;
  for (const r of input.recipients) {
    recipients.push(
      await recipientRepo.createPayoutRecipient(supabase, {
        tracker_id: tracker.id,
        recipient_name: r.name,
        amount_minor: toMinor(r.amountMajor),
        reference_last4: null,
        proof_url: null,
        sort_order: order++,
      }),
    );
  }
  return { tracker, recipients };
}

export async function getTrackerDetail(
  supabase: SupabaseClient,
  organizationId: string,
  trackerId: string,
): Promise<TrackerDetail> {
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await trackerRepo.findPayoutTrackerById(supabase, id), organizationId);
  const recipients = await recipientRepo.listPayoutRecipientsByTracker(supabase, tracker.id);
  return { tracker, recipients };
}

export interface TrackerSummary {
  readonly tracker: PayoutTrackerRow;
  readonly paidCount: number;
  readonly totalCount: number;
  readonly totalMinor: number;
  readonly paidMinor: number;
}

/** Workspace list. Free shows all drafts + the latest N non-draft trackers (retained, never deleted). */
export async function listTrackers(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ summaries: TrackerSummary[]; level: PayoutTrackerAccessLevel }> {
  const level = await resolvePayoutTrackerAccessLevel(supabase, { organizationId });
  const trackers = await trackerRepo.listPayoutTrackersByOrg(supabase, organizationId);
  const visible =
    level === "paid"
      ? trackers
      : [
          ...trackers.filter((t) => t.status === "draft"),
          ...trackers.filter((t) => t.status !== "draft").slice(0, FREE_PAYOUT_TRACKER_HISTORY_LIMIT),
        ];
  const summaries: TrackerSummary[] = [];
  for (const tracker of visible) {
    const recipients = await recipientRepo.listPayoutRecipientsByTracker(supabase, tracker.id);
    let paidMinor = 0;
    let totalMinor = 0;
    let paidCount = 0;
    for (const r of recipients) {
      totalMinor += r.amount_minor;
      if (r.status === "paid") {
        paidMinor += r.amount_minor;
        paidCount += 1;
      }
    }
    summaries.push({ tracker, paidCount, totalCount: recipients.length, totalMinor, paidMinor });
  }
  return { summaries, level };
}

export async function updateTracker(
  supabase: SupabaseClient,
  organizationId: string,
  trackerId: string,
  raw: UpdateTrackerInput,
): Promise<PayoutTrackerRow> {
  const input = parseOrThrow(updateTrackerSchema, raw);
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await trackerRepo.findPayoutTrackerById(supabase, id), organizationId);
  return trackerRepo.updatePayoutTrackerMeta(supabase, tracker.id, {
    event_name: input.eventName,
    deadline: input.deadline ? deadlineInputToIso(input.deadline) : null,
  });
}

export async function deleteTracker(
  supabase: SupabaseClient,
  organizationId: string,
  trackerId: string,
): Promise<void> {
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await trackerRepo.findPayoutTrackerById(supabase, id), organizationId);
  // Recipients cascade; the public link dies with the row. The monthly
  // publish ledger intentionally survives (quota stays consumed).
  await trackerRepo.deletePayoutTracker(supabase, tracker.id);
}

/** Publish a draft. Only new publications consume Free quota (RPC is idempotent). */
export async function publishTracker(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
): Promise<PayoutTrackerRow> {
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await trackerRepo.findPayoutTrackerById(supabase, id), organizationId);
  assertTransition(tracker.status, "published");
  try {
    return await trackerRepo.publishPayoutTrackerViaQuota(createAdminClient(), organizationId, tracker.id, userId);
  } catch (e) {
    throw mapConsumePayoutPublishError(e);
  }
}

/** Revoke the public link by rotating the token. Data and quota untouched. */
export async function revokeShareLink(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  trackerId: string,
): Promise<PayoutTrackerRow> {
  const id = parseOrThrow(trackerIdSchema, trackerId);
  const tracker = requirePayoutTrackerOwned(await trackerRepo.findPayoutTrackerById(supabase, id), organizationId);
  if (tracker.status === "draft") throw validationError("Draft trackers have no public link to revoke.");
  return trackerRepo.rotatePayoutTrackerTokenViaRpc(createAdminClient(), organizationId, tracker.id, userId);
}
