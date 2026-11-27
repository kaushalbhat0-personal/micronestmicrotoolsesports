// Tournament publishing writer (P3) — VALIDATION + GATE ONLY.
// Persistent tournament writes stay DISABLED until, in order: (1) data-model
// acceptance (04-data-model.md), (2) migration + remote application by the
// authorized owner flow, (3) organizer-permission + moderation-boundary
// approval, (4) session-derived operation verification, (5) database
// authorization tests. The kill switch below is asserted ON by
// `src/app/tournaments/routes.test.ts`: flipping it without the acceptance
// sequence breaks the suite on purpose.
//
// What this module DOES today (all safe without a database):
// - Strict Zod validation of publish/update/unpublish inputs (protected
//   keys — ids, owner identity, lifecycle internals, verification flags —
//   are REJECTED, never silently dropped).
// - An explicit TournamentWriteDisabledError BEFORE any table touch, so no
//   fake success is possible and no unsafe write path is enabled.
//
// Identity + below-gate statements are deliberately absent: the ownership
// model (organizer reference vs organization authority) is undecided, so
// even the gated SQL shape is not specified here — see 04-data-model.md.

import {
  TournamentWriteDisabledError,
  TournamentDirectoryValidationError,
} from "../domain/public-card";
import {
  tournamentDraftSchema,
  tournamentUpdateSchema,
  unpublishSchema,
  type TournamentDraftInput,
  type TournamentUpdateInput,
  type UnpublishInput,
} from "../schemas/tournament";

/** Kill switch. Enabling requires the acceptance sequence AND updating the static gate test. */
export const TOURNAMENT_WRITES_ENABLED: boolean = false;

function isDisabled(): boolean {
  return !TOURNAMENT_WRITES_ENABLED;
}

export function parseTournamentDraft(input: unknown): TournamentDraftInput {
  try {
    return tournamentDraftSchema.parse(input);
  } catch {
    throw new TournamentDirectoryValidationError();
  }
}

export function parseTournamentUpdate(input: unknown): TournamentUpdateInput {
  try {
    return tournamentUpdateSchema.parse(input);
  } catch {
    throw new TournamentDirectoryValidationError();
  }
}

export function parseUnpublish(input: unknown): UnpublishInput {
  try {
    return unpublishSchema.parse(input);
  } catch {
    throw new TournamentDirectoryValidationError();
  }
}

// Publishing operation. Validates, then blocks before any table touch.
export function publishTournamentOp(input: unknown): { slug: string } {
  const parsed = parseTournamentDraft(input);
  void parsed;
  if (isDisabled()) {
    throw new TournamentWriteDisabledError();
  }
  // --- Below the gate (acceptance sequence only; ownership model pending) ---
  throw new TournamentWriteDisabledError();
}

export function updateTournamentOp(input: unknown): { slug: string } {
  const parsed = parseTournamentUpdate(input);
  void parsed;
  if (isDisabled()) {
    throw new TournamentWriteDisabledError();
  }
  throw new TournamentWriteDisabledError();
}

export function unpublishTournamentOp(input: unknown): { slug: string } {
  const parsed = parseUnpublish(input);
  void parsed;
  if (isDisabled()) {
    throw new TournamentWriteDisabledError();
  }
  throw new TournamentWriteDisabledError();
}
