// P9 organizer public card/detail contracts for the PROPOSED masked RPC
// pair `search_organizers` / `get_organizer_by_slug` (local migration only,
// not applied remotely). Owner identity, membership rows, verification
// evidence, applicant data and timestamps are never members here.
//
// Design notes:
// - One row per organizer; `game_keys` is an array (game-agnostic, BGMI
//   first). Unknown keys pass through display-only; filtering fails closed.
// - No logo/media member: no safe organizer media contract exists. UI renders
//   an initial-letter mark.
// - `published_tournament_count` is a derived count only. Tournament
//   identities live at /tournaments; the profile links there.
// - An organizer is NOT an organization: `organization` type rows carry an
//   explicit `organization_slug` link only when an approved linkage exists
//   (null otherwise — never inferred).

import type { OrganizerType } from "./organizer-type";
import type { OrganizerTrustState } from "./trust";
import type { OrganizerSocialLink } from "./links";
import { ORGANIZER_DIRECTORY_COLUMNS } from "./columns";

export interface PublicOrganizerCard {
  slug: string;
  name: string;
  region_code: string;
  organizer_type: OrganizerType;
  game_keys: string[];
  trust_state: OrganizerTrustState;
  published_tournament_count: number;
  is_public: boolean;
}

export interface PublicOrganizerDetail extends PublicOrganizerCard {
  description: string | null;
  website_url: string | null;
  social_links: OrganizerSocialLink[];
  /** Explicit organization linkage, when an approved linkage exists. Null otherwise. */
  organization_slug: string | null;
}

// Compile-time guard: the card exposes exactly the proposed columns.
type FrozenKey = (typeof ORGANIZER_DIRECTORY_COLUMNS)[number];
type CardKey = keyof PublicOrganizerCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

export class OrganizerDirectoryValidationError extends Error {
  constructor() {
    super("Invalid organizer search input.");
    this.name = "OrganizerDirectoryValidationError";
  }
}

export class OrganizerDirectoryOperationError extends Error {
  constructor() {
    super("Could not load the organizer directory. Please retry.");
    this.name = "OrganizerDirectoryOperationError";
  }
}

export class OrganizerWriteDisabledError extends Error {
  constructor() {
    super(
      "Organizer publishing is disabled in this phase: organizer ownership, verification and tournament moderation boundaries are awaiting decisions."
    );
    this.name = "OrganizerWriteDisabledError";
  }
}
