// Public team directory contract (P1).
// Mirrors the D1 masked RPC pair `search_teams` / `get_team_by_slug` (local,
// UNAPPLIED — see supabase/migrations/20261112000002 + 000003 remediations):
// exactly the 9 public columns, in order. Owner identity (owner_user_id,
// created_by), organization_id, verification data, applicant data and
// timestamps are never members here — the same compile-time + runtime
// key-set discipline as the frozen G1 player projection.
//
// G1 is untouched: nothing here imports or widens the player projection.

import { TEAM_DIRECTORY_COLUMNS } from "./team-directory-columns";

export interface PublicTeamCard {
  id: string;
  slug: string;
  name: string;
  game_key: string;
  region_code: string;
  current_level: string;
  target_level: string;
  recruiting: boolean;
  member_count: number;
}

export interface PublicTeamDetail extends PublicTeamCard {
  description: string | null;
}

// Compile-time guard: the card exposes exactly the public columns (key-set
// equality is additionally asserted at runtime in the reader).
type FrozenKey = (typeof TEAM_DIRECTORY_COLUMNS)[number];
type CardKey = keyof PublicTeamCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
// Both resolve to never when the card matches the contract exactly.
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

// Domain errors: repositories throw these, never raw PostgREST detail to UI.
// Messages are generic by design (no existence oracle, no transport detail).
export class TeamDirectoryValidationError extends Error {
  constructor() {
    super("Invalid team search input.");
    this.name = "TeamDirectoryValidationError";
  }
}

export class TeamDirectoryOperationError extends Error {
  constructor() {
    super("Could not load the team directory. Please retry.");
    this.name = "TeamDirectoryOperationError";
  }
}
