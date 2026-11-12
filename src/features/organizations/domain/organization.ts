// P8 organization public card/detail contracts for the PROPOSED masked RPC
// pair `search_organizations` / `get_organization_by_slug` (no migration
// exists). Owner identity, representative PII, verification evidence,
// applicant data and timestamps are never members here.
//
// Design notes:
// - One row per organization; `game_keys` is an array (game-agnostic, BGMI
//   first). Unknown keys pass through display-only; filtering fails closed.
// - No logo/media member: no accepted media contract exists. UI renders an
//   initial-letter mark.
// - No recruitment-opportunity members: display-only recruitment arrives with
//   the ownership decision. The profile states this explicitly.
// - `team_count` is a derived count only. No team identities are embedded:
//   teams stay independently discoverable at /teams and are never silently
//   attached to an organization in this phase.

import type { OrgType } from "./org-type";
import type { TrustState } from "./trust";
import { ORGANIZATION_DIRECTORY_COLUMNS } from "./columns";

export interface OrganizationSocialLink {
  readonly label: string;
  readonly url: string;
}

export interface PublicOrganizationCard {
  slug: string;
  name: string;
  region_code: string;
  org_type: OrgType;
  game_keys: string[];
  trust_state: TrustState;
  team_count: number;
}

export interface PublicOrganizationDetail extends PublicOrganizationCard {
  description: string | null;
  website_url: string | null;
  social_links: OrganizationSocialLink[];
}

// Compile-time guard: the card exposes exactly the proposed columns.
type FrozenKey = (typeof ORGANIZATION_DIRECTORY_COLUMNS)[number];
type CardKey = keyof PublicOrganizationCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

export class OrganizationDirectoryValidationError extends Error {
  constructor() {
    super("Invalid organization search input.");
    this.name = "OrganizationDirectoryValidationError";
  }
}

export class OrganizationDirectoryOperationError extends Error {
  constructor() {
    super("Could not load the organization directory. Please retry.");
    this.name = "OrganizationDirectoryOperationError";
  }
}

export class OrganizationWriteDisabledError extends Error {
  constructor() {
    super(
      "Organization ownership and verification writes are disabled in this phase: authorization and evidence-handling rules are awaiting decisions.",
    );
    this.name = "OrganizationWriteDisabledError";
  }
}
