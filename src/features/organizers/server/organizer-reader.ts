// Public organizer directory reader (P9).
// Reads exclusively through the PROPOSED masked RPC pair
// `search_organizers` / `get_organizer_by_slug` — the migration is
// local-only (not applied remotely), so these calls resolve to the generic
// unavailable state until the data-model proposal is accepted and applied.
// The contract below is the acceptance target, pinned by tests with a fake
// client: no base-table reads, no elevated client, no new RPCs invented at
// the route layer.
//
// Security posture (mirrors P1/P3/P8 readers):
// - Server-side only; call-site injects any client (anon included).
// - Identity-free: no user ID accepted anywhere in this module.
// - Zod-validated inputs; known-game (bgmi) region vocabulary enforced
//   pre-RPC; unknown games pass through to zero rows (fail closed).
// - Strict output mapping to the proposed columns (+ description/website/
//   socials/organization_slug for detail). Extra keys — owner identity,
//   membership, verification evidence, timestamps — are dropped, never forwarded.
// - External URLs re-validated https-only; a bad URL fails the row closed.
// - Errors are generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGameRegion } from "@/features/player-profile/schemas/game";
import { ORGANIZER_DIRECTORY_COLUMNS } from "../domain/columns";
import { isOrganizerType } from "../domain/organizer-type";
import { isOrganizerTrustState } from "../domain/trust";
import {
  isValidOrganizerUrl,
  isOrganizerSocialLink,
  type OrganizerSocialLink,
} from "../domain/links";
import {
  OrganizerDirectoryOperationError,
  OrganizerDirectoryValidationError,
  type PublicOrganizerCard,
  type PublicOrganizerDetail,
} from "../domain/organizer";
import {
  getOrganizerBySlugInputSchema,
  searchOrganizersInputSchema,
  type SearchOrganizersInput,
} from "../schemas/directory";

interface OrganizerSearchRpcRow {
  slug: unknown;
  name: unknown;
  region_code: unknown;
  organizer_type: unknown;
  game_keys: unknown;
  trust_state: unknown;
  published_tournament_count: unknown;
  is_public: unknown;
}

interface OrganizerDetailRpcRow extends OrganizerSearchRpcRow {
  description: unknown;
  website_url: unknown;
  social_links: unknown;
  organization_slug: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toPublishedCount(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,9}$/.test(value)) {
    return Number(value);
  }
  throw new OrganizerDirectoryOperationError();
}

function toGameKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new OrganizerDirectoryOperationError();
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > 24) {
      throw new OrganizerDirectoryOperationError();
    }
  }
  return [...(value as string[])];
}

function toWebsiteOrNull(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (isValidOrganizerUrl(value)) {
    return (value as string).trim();
  }
  throw new OrganizerDirectoryOperationError();
}

function toSocialLinks(value: unknown): OrganizerSocialLink[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new OrganizerDirectoryOperationError();
  }
  if (value.length > 8) {
    throw new OrganizerDirectoryOperationError();
  }
  return value.map((entry) => {
    if (!isOrganizerSocialLink(entry)) {
      throw new OrganizerDirectoryOperationError();
    }
    const link = entry as OrganizerSocialLink;
    return { label: link.label.trim(), url: link.url.trim() };
  });
}

function toOrganizationSlugOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim().length >= 2 && value.trim().length <= 80) {
    return value.trim().toLowerCase();
  }
  throw new OrganizerDirectoryOperationError();
}

function toPublicOrganizerCard(row: OrganizerSearchRpcRow): PublicOrganizerCard {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.region_code) ||
    !isOrganizerType(row.organizer_type) ||
    !isOrganizerTrustState(row.trust_state) ||
    typeof row.is_public !== "boolean"
  ) {
    throw new OrganizerDirectoryOperationError();
  }
  return {
    slug: row.slug,
    name: row.name,
    region_code: row.region_code,
    organizer_type: row.organizer_type,
    game_keys: toGameKeys(row.game_keys),
    trust_state: row.trust_state,
    published_tournament_count: toPublishedCount(row.published_tournament_count),
    is_public: row.is_public,
  };
}

function toPublicOrganizerDetail(row: OrganizerDetailRpcRow): PublicOrganizerDetail {
  const card = toPublicOrganizerCard(row);
  if (typeof row.description !== "string" && row.description !== null) {
    throw new OrganizerDirectoryOperationError();
  }
  return {
    ...card,
    description: row.description,
    website_url: toWebsiteOrNull(row.website_url),
    social_links: toSocialLinks(row.social_links),
    organization_slug: toOrganizationSlugOrNull(row.organization_slug),
  };
}

function assertSearchKeySet(rows: OrganizerSearchRpcRow[]): void {
  const expected = [...ORGANIZER_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new OrganizerDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: OrganizerDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== ORGANIZER_DIRECTORY_COLUMNS.length + 4 ||
      !keys.includes("description") ||
      !keys.includes("website_url") ||
      !keys.includes("social_links") ||
      !keys.includes("organization_slug")
    ) {
      throw new OrganizerDirectoryOperationError();
    }
    const searchKeys = keys.filter(
      (key) =>
        key !== "description" &&
        key !== "website_url" &&
        key !== "social_links" &&
        key !== "organization_slug"
    );
    const expected = [...ORGANIZER_DIRECTORY_COLUMNS];
    if (!expected.every((key, index) => searchKeys[index] === key)) {
      throw new OrganizerDirectoryOperationError();
    }
  }
}

function enforceKnownGameVocabulary(input: {
  game?: string | undefined;
  region?: string | undefined;
}): void {
  if (input.game === undefined) {
    return;
  }
  if (input.game === "bgmi") {
    if (input.region !== undefined && !validateGameRegion(input.game, input.region)) {
      throw new OrganizerDirectoryValidationError();
    }
  }
}

export async function searchOrganizers(
  client: SupabaseClient,
  input: unknown
): Promise<PublicOrganizerCard[]> {
  let parsed: SearchOrganizersInput;
  try {
    parsed = searchOrganizersInputSchema.parse(input);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_organizers", {
    p_game: parsed.game ?? null,
    p_region: parsed.region ?? null,
    p_organizer_type: parsed.organizerType ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = ((data ?? []) as OrganizerSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicOrganizerCard(row));
}

export async function getOrganizerBySlug(
  client: SupabaseClient,
  input: unknown
): Promise<PublicOrganizerDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getOrganizerBySlugInputSchema.parse(normalized);
  } catch {
    throw new OrganizerDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_organizer_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new OrganizerDirectoryOperationError();
  }
  const rows = ((data ?? []) as OrganizerDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new OrganizerDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicOrganizerDetail(rows[0] as OrganizerDetailRpcRow);
}
