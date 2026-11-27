// P8 brand public card/detail contracts for the PROPOSED masked RPC pair
// `search_brands` / `get_brand_by_slug` (no migration exists). Representative
// identity, verification evidence, contact PII and timestamps are never
// members here. `representative_verified` is frozen false: no verification
// pipeline exists, so the UI never renders a badge for it.

import type { TrustState } from "@/features/organizations/domain/trust";
import type {
  BrandIndustry,
  PartnershipType,
  SponsorshipInterest,
} from "./vocabulary";
import { BRAND_DIRECTORY_COLUMNS } from "./columns";

export interface BrandSocialLink {
  readonly label: string;
  readonly url: string;
}

export interface PublicBrandCard {
  slug: string;
  name: string;
  industry: BrandIndustry;
  region_code: string;
  game_interests: string[];
  partnership_types: PartnershipType[];
  sponsorship_interests: SponsorshipInterest[];
  trust_state: TrustState;
}

export interface PublicBrandDetail extends PublicBrandCard {
  description: string | null;
  website_url: string | null;
  social_links: BrandSocialLink[];
  /** Frozen false: no representative-verification pipeline exists in P8. */
  readonly representative_verified: false;
}

// Compile-time guard: the card exposes exactly the proposed columns.
type FrozenKey = (typeof BRAND_DIRECTORY_COLUMNS)[number];
type CardKey = keyof PublicBrandCard;
type Missing = Exclude<FrozenKey, CardKey>;
type Extra = Exclude<CardKey, FrozenKey>;
const _missingGuard: Missing = undefined as never;
const _extraGuard: Extra = undefined as never;
void _missingGuard;
void _extraGuard;

export class BrandDirectoryValidationError extends Error {
  constructor() {
    super("Invalid brand search input.");
    this.name = "BrandDirectoryValidationError";
  }
}

export class BrandDirectoryOperationError extends Error {
  constructor() {
    super("Could not load the brand directory. Please retry.");
    this.name = "BrandDirectoryOperationError";
  }
}

export class BrandWriteDisabledError extends Error {
  constructor() {
    super(
      "Brand representative verification and sponsorship writes are disabled in this phase: authorization and evidence-handling rules are awaiting decisions.",
    );
    this.name = "BrandWriteDisabledError";
  }
}
