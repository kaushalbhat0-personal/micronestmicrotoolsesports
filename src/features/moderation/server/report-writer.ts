// Moderation writer (P10) — VALIDATION + GATE ONLY.
// Report submission, report review, moderation decisions, and verification
// submissions stay DISABLED until, in order: (1) moderation-authority approval
// (P10-04: platform_admins via is_super_admin, SLA, queue retention/visibility,
// takedown power), (2) verification-policy approval (P10-05: evidence types,
// handling, retention, approver roles, expiry), (3) the queue/audit tables and
// their RLS landing via an approved migration, (4) session-derived operation
// verification, (5) database authorization tests. The kill switch below is
// asserted OFF by `src/app/workspace/moderation/routes.test.ts`: flipping it
// without the acceptance sequence breaks the suite on purpose.
//
// What this module DOES today (all safe without a database):
// - Strict Zod validation of report intake, review, decision, and
//   verification-submit inputs (protected keys — reporter/reviewer identity,
//   timestamps, status, lifecycle, trust — are REJECTED, never dropped).
// - An explicit ModerationWriteDisabledError BEFORE any table touch, so no
//   fake success is possible and no unsafe write path is enabled.
// - The self-approval guard shape (`isSelfApproval` documented in
//   domain/decision.ts) is specified for the approving migration; reviewer
//   identity is session-derived only and never accepted as input here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import { ModerationWriteDisabledError, ReportValidationError } from "../domain/report";
import { VerificationValidationError } from "../domain/verification";
import {
  moderationDecisionInputSchema,
  reviewReportInputSchema,
  submitReportInputSchema,
  verificationSubmitInputSchema,
  type ModerationDecisionInput,
  type ReviewReportInput,
  type SubmitReportInput,
  type VerificationSubmitInput,
} from "../schemas/report";

/** Kill switch. Enabling requires the acceptance sequence AND updating the static gate test. */
export const MODERATION_WRITES_ENABLED: boolean = false;

function isDisabled(): boolean {
  return !MODERATION_WRITES_ENABLED;
}

export function parseSubmitReportInput(input: unknown): SubmitReportInput {
  try {
    return submitReportInputSchema.parse(input);
  } catch {
    throw new ReportValidationError();
  }
}

export function parseReviewReportInput(input: unknown): ReviewReportInput {
  try {
    return reviewReportInputSchema.parse(input);
  } catch {
    throw new ReportValidationError();
  }
}

export function parseModerationDecisionInput(input: unknown): ModerationDecisionInput {
  try {
    return moderationDecisionInputSchema.parse(input);
  } catch {
    throw new ReportValidationError();
  }
}

export function parseVerificationSubmitInput(input: unknown): VerificationSubmitInput {
  try {
    return verificationSubmitInputSchema.parse(input);
  } catch {
    throw new VerificationValidationError();
  }
}

export async function submitReportOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseSubmitReportInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new ModerationWriteDisabledError();
  }
  // --- Below the gate (acceptance sequence only) ---
  void parsed;
  throw new ModerationWriteDisabledError();
}

export async function reviewReportOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseReviewReportInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new ModerationWriteDisabledError();
  }
  void parsed;
  throw new ModerationWriteDisabledError();
}

export async function recordModerationDecisionOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseModerationDecisionInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new ModerationWriteDisabledError();
  }
  void parsed;
  throw new ModerationWriteDisabledError();
}

export async function submitVerificationOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseVerificationSubmitInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new ModerationWriteDisabledError();
  }
  void parsed;
  throw new ModerationWriteDisabledError();
}

// Moderator-only actions are separately gated: they throw the disabled error
// even if the general gate ever flips, until the moderation boundary is
// approved. This function documents that boundary in code — it never touches
// the database today.
export function assertModeratorActionAllowed(action: string): never {
  throw new ModerationWriteDisabledError();
  void action;
}
