// P3 tournaments — public card/detail contracts for the PROPOSED masked
// RPC pair `search_tournaments` / `get_tournament_by_slug` (no migration
// exists; see docs/product-development/P3-tournament-discovery/04-data-model.md).
// Owner identity, organizer internals beyond the public ref, applicant/
// registration PII, moderation metadata and timestamps beyond event dates
// are never members here.

import type { LifecycleState, ParticipationFormat, TournamentStatus } from "./tournament";
import type { MoneyAmount } from "./money";
import type { OrganizerRef } from "./organizer";
import { TOURNAMENT_DIRECTORY_COLUMNS } from "./columns";

export interface PublicTournamentCard {
  slug: string;
  title: string;
  game_key: string;
  region_code: string;
  format: ParticipationFormat;
  starts_at: string;
  ends_at: string;
  timezone: string;
  entry_fee: MoneyAmount | null;
  prize_pool: MoneyAmount | null;
  organizer: OrganizerRef;
  lifecycle: LifecycleState;
  registration_url: string | null;
  registration_closes_at: string | null;
  /** Derived at read time from event instants (never stored authority). */
  status: TournamentStatus;
}

export interface PublicTournamentDetail extends PublicTournamentCard {
  description: string | null;
  contact_instructions: string | null;
  eligibility: {
    min_team_size: number | null;
    max_team_size: number | null;
    region_codes: string[];
    min_age: number | null;
    note: string | null;
  } | null;
}

// Compile-time guard: card exposes exactly the proposed columns + derived status.
type FrozenKey = (typeof TOURNAMENT_DIRECTORY_COLUMNS)[number] | "status";
type CardKey = keyof PublicTournamentCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

export class TournamentDirectoryValidationError extends Error {
  constructor() {
    super("Invalid tournament search input.");
    this.name = "TournamentDirectoryValidationError";
  }
}

export class TournamentDirectoryOperationError extends Error {
  constructor() {
    super("Could not load tournaments. Please retry.");
    this.name = "TournamentDirectoryOperationError";
  }
}

export class TournamentWriteDisabledError extends Error {
  constructor() {
    super(
      "Tournament publishing is disabled in this phase: the tournament schema, organizer permissions and moderation boundary are awaiting decisions.",
    );
    this.name = "TournamentWriteDisabledError";
  }
}
