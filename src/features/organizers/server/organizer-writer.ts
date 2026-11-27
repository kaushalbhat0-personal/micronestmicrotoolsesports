// Organizer + tournament writer (P9) — VALIDATION + GATE ONLY.
// Persistent organizer and tournament writes stay DISABLED until, in order:
// (1) data-model acceptance, (2) local migrations applied by the authorized
// owner flow, (3) organizer-permission + moderation-boundary approval, (4)
// session-derived operation verification, (5) database authorization tests.
// The kill switch below is asserted OFF by
// `src/app/workspace/organizer/routes.test.ts`: flipping it without the
// acceptance sequence breaks the suite on purpose.
//
// What this module DOES today (all safe without a database):
// - Strict Zod validation of organizer creation/settings and tournament
//   draft/update inputs (protected keys — ids, owner identity, membership,
//   verification, lifecycle internals, counts — are REJECTED, never silently
//   dropped).
// - An explicit OrganizerWriteDisabledError BEFORE any table touch, so no
//   fake success is possible and no unsafe write path is enabled.
//
// Identity + below-gate statements are deliberately present but unreachable
// while disabled: session-derived creator columns (never caller-supplied),
// explicit editable column lists, lifecycle-gated transitions. Moderator publish/unpublish/archive statements are specified
// as gated shapes only — moderation authority is unresolved, so those
// transitions throw even if the general gate ever flips, until a separate
// moderation approval lands.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import {
  OrganizerDirectoryValidationError,
  OrganizerWriteDisabledError,
} from "../domain/organizer";
import {
  createOrganizerInputSchema,
  createTournamentInputSchema,
  updateOrganizerInputSchema,
  updateTournamentInputSchema,
  type CreateOrganizerInput,
  type CreateTournamentInput,
  type UpdateOrganizerInput,
  type UpdateTournamentInput,
} from "../schemas/manage";

/** Kill switch. Enabling requires the acceptance sequence AND updating the static gate test. */
export const ORGANIZER_WRITES_ENABLED: boolean = false;

function isDisabled(): boolean {
  return !ORGANIZER_WRITES_ENABLED;
}

export function parseCreateOrganizerInput(input: unknown): CreateOrganizerInput {
  try {
    return createOrganizerInputSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
}

export function parseUpdateOrganizerInput(input: unknown): UpdateOrganizerInput {
  try {
    return updateOrganizerInputSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
}

export function parseCreateTournamentInput(input: unknown): CreateTournamentInput {
  try {
    return createTournamentInputSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
}

export function parseUpdateTournamentInput(input: unknown): UpdateTournamentInput {
  try {
    return updateTournamentInputSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
}

export async function createOrganizerOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string; slug: string }> {
  const parsed = parseCreateOrganizerInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new OrganizerWriteDisabledError();
  }
  // --- Below the gate (acceptance sequence only) ---
  void parsed;
  throw new OrganizerWriteDisabledError();
}

export async function updateOrganizerOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseUpdateOrganizerInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new OrganizerWriteDisabledError();
  }
  void parsed;
  throw new OrganizerWriteDisabledError();
}

export async function createTournamentDraftOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string; slug: string }> {
  const parsed = parseCreateTournamentInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new OrganizerWriteDisabledError();
  }
  void parsed;
  throw new OrganizerWriteDisabledError();
}

export async function updateTournamentDraftOp(
  client: SupabaseClient,
  input: unknown
): Promise<{ id: string }> {
  const parsed = parseUpdateTournamentInput(input);
  await ensureAppUser(client);
  if (isDisabled()) {
    throw new OrganizerWriteDisabledError();
  }
  void parsed;
  throw new OrganizerWriteDisabledError();
}

// Lifecycle transitions that require moderator authority are separately
// gated: they throw the disabled error even if the general gate ever flips,
// until the moderation boundary is approved. This function documents that
// boundary in code — it never touches the database today.
export function assertModerationTransitionAllowed(transition: string): never {
  throw new OrganizerWriteDisabledError();
  void transition;
}
