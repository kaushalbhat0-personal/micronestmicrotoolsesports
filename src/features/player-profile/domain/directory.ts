// Public directory contract (G1-4).
// Authoritative: 04 section 5 + 05 section 5 + 11 sections 3-4
// (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11).
// This is a strict mirror of domain/public-projection.ts: exactly the frozen
// 12 columns, in frozen order. game_user_id (full or masked), user IDs,
// verification data, evidence and timestamps are never members here.

import { PUBLIC_PROJECTION_COLUMNS } from "./public-projection";

export interface PublicPlayerCard {
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  game_key: string;
  game_name: string;
  ign: string;
  primary_role: string | null;
  play_modes: string[];
  region_code: string | null;
  availability: string[];
}

// Compile-time guard: the card exposes exactly the frozen columns (key-set
// equality is additionally asserted at runtime in tests/public-projection +
// tests/directory-reader tests).
type FrozenKey = (typeof PUBLIC_PROJECTION_COLUMNS)[number];
type CardKey = keyof PublicPlayerCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
// Both resolve to never when the card matches the frozen contract exactly.
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

// Domain errors (07 section 3: repositories throw domain errors, never raw
// PostgREST errors to UI). Messages are generic by design (08 T5/T8).

export class DirectoryValidationError extends Error {
  constructor() {
    super("Invalid directory search input.");
    this.name = "DirectoryValidationError";
  }
}

export class DirectoryOperationError extends Error {
  constructor() {
    super("Could not load the player directory. Please retry.");
    this.name = "DirectoryOperationError";
  }
}
