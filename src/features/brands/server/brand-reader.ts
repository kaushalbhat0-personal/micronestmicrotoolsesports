// Public brand directory reader (P8).
// Reads exclusively through the PROPOSED masked RPC pair
// `search_brands` / `get_brand_by_slug` — no migration exists, so these calls
// resolve to the generic unavailable state until the data-model proposal is
// accepted, migrated, and verified. Acceptance target pinned by tests with a
// fake client: no base-table reads, no elevated client, no new RPCs invented
// at the route layer.
//
// Security posture (mirrors the organization reader):
// - Server-side only; call-site injects any client (anon included).
// - Identity-free: no user ID accepted anywhere in this module. A brand
//   profile never proves the viewer represents the brand.
// - Zod-validated inputs; known-game (bgmi) region vocabulary enforced
//   pre-RPC; unknown games pass through to zero rows (fail closed).
// - Strict output mapping to the proposed columns (+ description/website/
//   socials for detail, + frozen representative_verified false). Extra keys
//   — representative identity, verification evidence, contact PII — are
//   dropped, never forwarded.
// - External URLs re-validated https-only; a bad URL fails the row closed.
// - Errors are generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module. Representative verification stays
//   disabled: this reader can never confirm a representative.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGameRegion } from "@/features/player-profile/schemas/game";
import { isTrustState } from "@/features/organizations/domain/trust";
import { isValidExternalUrl } from "@/features/organizations/domain/links";
import { BRAND_DIRECTORY_COLUMNS } from "../domain/columns";
import {
  isBrandIndustry,
  isPartnershipType,
  isSponsorshipInterest,
} from "../domain/vocabulary";
import {
  BrandDirectoryOperationError,
  BrandDirectoryValidationError,
  type BrandSocialLink,
  type PublicBrandCard,
  type PublicBrandDetail,
} from "../domain/brand";
import {
  getBrandBySlugInputSchema,
  searchBrandsInputSchema,
  type SearchBrandsInput,
} from "../schemas/directory";

interface BrandSearchRpcRow {
  slug: unknown;
  name: unknown;
  industry: unknown;
  region_code: unknown;
  game_interests: unknown;
  partnership_types: unknown;
  sponsorship_interests: unknown;
  trust_state: unknown;
}

interface BrandDetailRpcRow extends BrandSearchRpcRow {
  description: unknown;
  website_url: unknown;
  social_links: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toStringArray(value: unknown, maxEntry: number): string[] {
  if (!Array.isArray(value)) {
    throw new BrandDirectoryOperationError();
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > maxEntry) {
      throw new BrandDirectoryOperationError();
    }
  }
  return [...(value as string[])];
}

function toWebsiteOrNull(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (isValidExternalUrl(value)) {
    return (value as string).trim();
  }
  throw new BrandDirectoryOperationError();
}

function toSocialLinks(value: unknown): BrandSocialLink[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BrandDirectoryOperationError();
  }
  if (value.length > 8) {
    throw new BrandDirectoryOperationError();
  }
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new BrandDirectoryOperationError();
    }
    const record = entry as Record<string, unknown>;
    const { label, url } = record;
    if (
      typeof label !== "string" ||
      label.trim().length === 0 ||
      label.trim().length > 40 ||
      !isValidExternalUrl(url)
    ) {
      throw new BrandDirectoryOperationError();
    }
    return { label: label.trim(), url: (url as string).trim() };
  });
}

function toPublicBrandCard(row: BrandSearchRpcRow): PublicBrandCard {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isBrandIndustry(row.industry) ||
    !isNonEmptyString(row.region_code) ||
    !isTrustState(row.trust_state)
  ) {
    throw new BrandDirectoryOperationError();
  }
  const gameInterests = toStringArray(row.game_interests, 24);
  const partnershipTypes = toStringArray(row.partnership_types, 32);
  for (const entry of partnershipTypes) {
    if (!isPartnershipType(entry)) {
      throw new BrandDirectoryOperationError();
    }
  }
  const sponsorshipInterests = toStringArray(row.sponsorship_interests, 32);
  for (const entry of sponsorshipInterests) {
    if (!isSponsorshipInterest(entry)) {
      throw new BrandDirectoryOperationError();
    }
  }
  return {
    slug: row.slug,
    name: row.name,
    industry: row.industry,
    region_code: row.region_code,
    game_interests: gameInterests,
    partnership_types: partnershipTypes as PublicBrandCard["partnership_types"],
    sponsorship_interests: sponsorshipInterests as PublicBrandCard["sponsorship_interests"],
    trust_state: row.trust_state,
  };
}

function toPublicBrandDetail(row: BrandDetailRpcRow): PublicBrandDetail {
  const card = toPublicBrandCard(row);
  if (typeof row.description !== "string" && row.description !== null) {
    throw new BrandDirectoryOperationError();
  }
  return {
    ...card,
    description: row.description,
    website_url: toWebsiteOrNull(row.website_url),
    social_links: toSocialLinks(row.social_links),
    representative_verified: false,
  };
}

function assertSearchKeySet(rows: BrandSearchRpcRow[]): void {
  const expected = [...BRAND_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new BrandDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: BrandDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== BRAND_DIRECTORY_COLUMNS.length + 3 ||
      !keys.includes("description") ||
      !keys.includes("website_url") ||
      !keys.includes("social_links")
    ) {
      throw new BrandDirectoryOperationError();
    }
    const searchKeys = keys.filter(
      (key) => key !== "description" && key !== "website_url" && key !== "social_links",
    );
    const expected = [...BRAND_DIRECTORY_COLUMNS];
    if (!expected.every((key, index) => searchKeys[index] === key)) {
      throw new BrandDirectoryOperationError();
    }
  }
}

function enforceKnownGameVocabulary(input: { gameInterest?: string | undefined; region?: string | undefined }): void {
  if (input.gameInterest === undefined) {
    return;
  }
  if (input.gameInterest === "bgmi") {
    if (input.region !== undefined && !validateGameRegion(input.gameInterest, input.region)) {
      throw new BrandDirectoryValidationError();
    }
  }
}

export async function searchBrands(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicBrandCard[]> {
  let parsed: SearchBrandsInput;
  try {
    parsed = searchBrandsInputSchema.parse(input);
  } catch {
    throw new BrandDirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_brands", {
    p_game_interest: parsed.gameInterest ?? null,
    p_industry: parsed.industry ?? null,
    p_region: parsed.region ?? null,
    p_interest: parsed.interest ?? null,
    p_partnership: parsed.partnership ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new BrandDirectoryOperationError();
  }
  const rows = ((data ?? []) as BrandSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicBrandCard(row));
}

export async function getBrandBySlug(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicBrandDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getBrandBySlugInputSchema.parse(normalized);
  } catch {
    throw new BrandDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_brand_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new BrandDirectoryOperationError();
  }
  const rows = ((data ?? []) as BrandDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new BrandDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicBrandDetail(rows[0] as BrandDetailRpcRow);
}
