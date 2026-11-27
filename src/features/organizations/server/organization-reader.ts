// Public organization directory reader (P8).
// Reads exclusively through the PROPOSED masked RPC pair
// `search_organizations` / `get_organization_by_slug` — no migration exists,
// so these calls resolve to the generic unavailable state until the data-model
// proposal (08-database-and-security-contracts.md) is accepted, migrated, and
// verified. The contract below is the acceptance target, pinned by tests with
// a fake client: no base-table reads, no elevated client, no new RPCs invented
// at the route layer.
//
// Security posture (mirrors P1 teams / P3 tournaments readers):
// - Server-side only; call-site injects any client (anon included).
// - Identity-free: no user ID accepted anywhere in this module.
// - Zod-validated inputs; when the caller names a known game (bgmi), region
//   is checked against that game's vocabulary here so malformed filters are
//   rejected before any RPC call. Unknown games pass through (zero rows,
//   fail closed).
// - Strict output mapping to the proposed columns (+ description/website/
//   socials for detail). Extra keys — owner identity, representative data,
//   verification evidence, timestamps — are dropped, never forwarded.
// - External URLs re-validated https-only; a bad URL fails the row closed.
// - Errors are generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGameRegion } from "@/features/player-profile/schemas/game";
import { ORGANIZATION_DIRECTORY_COLUMNS } from "../domain/columns";
import { isOrgType } from "../domain/org-type";
import { isTrustState } from "../domain/trust";
import { isValidExternalUrl } from "../domain/links";
import {
  OrganizationDirectoryOperationError,
  OrganizationDirectoryValidationError,
  type OrganizationSocialLink,
  type PublicOrganizationCard,
  type PublicOrganizationDetail,
} from "../domain/organization";
import {
  getOrganizationBySlugInputSchema,
  searchOrganizationsInputSchema,
  type SearchOrganizationsInput,
} from "../schemas/directory";

interface OrganizationSearchRpcRow {
  slug: unknown;
  name: unknown;
  region_code: unknown;
  org_type: unknown;
  game_keys: unknown;
  trust_state: unknown;
  team_count: unknown;
}

interface OrganizationDetailRpcRow extends OrganizationSearchRpcRow {
  description: unknown;
  website_url: unknown;
  social_links: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function toTeamCount(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d{1,9}$/.test(value)) {
    return Number(value);
  }
  throw new OrganizationDirectoryOperationError();
}

function toGameKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new OrganizationDirectoryOperationError();
  }
  for (const entry of value) {
    if (typeof entry !== "string" || entry.length === 0 || entry.length > 24) {
      throw new OrganizationDirectoryOperationError();
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
  throw new OrganizationDirectoryOperationError();
}

function toSocialLinks(value: unknown): OrganizationSocialLink[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new OrganizationDirectoryOperationError();
  }
  if (value.length > 8) {
    throw new OrganizationDirectoryOperationError();
  }
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new OrganizationDirectoryOperationError();
    }
    const record = entry as Record<string, unknown>;
    const { label, url } = record;
    if (
      typeof label !== "string" ||
      label.trim().length === 0 ||
      label.trim().length > 40 ||
      !isValidExternalUrl(url)
    ) {
      throw new OrganizationDirectoryOperationError();
    }
    return { label: label.trim(), url: (url as string).trim() };
  });
}

function toPublicOrganizationCard(row: OrganizationSearchRpcRow): PublicOrganizationCard {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.name) ||
    !isNonEmptyString(row.region_code) ||
    !isOrgType(row.org_type) ||
    !isTrustState(row.trust_state)
  ) {
    throw new OrganizationDirectoryOperationError();
  }
  return {
    slug: row.slug,
    name: row.name,
    region_code: row.region_code,
    org_type: row.org_type,
    game_keys: toGameKeys(row.game_keys),
    trust_state: row.trust_state,
    team_count: toTeamCount(row.team_count),
  };
}

function toPublicOrganizationDetail(row: OrganizationDetailRpcRow): PublicOrganizationDetail {
  const card = toPublicOrganizationCard(row);
  if (typeof row.description !== "string" && row.description !== null) {
    throw new OrganizationDirectoryOperationError();
  }
  return {
    ...card,
    description: row.description,
    website_url: toWebsiteOrNull(row.website_url),
    social_links: toSocialLinks(row.social_links),
  };
}

function assertSearchKeySet(rows: OrganizationSearchRpcRow[]): void {
  const expected = [...ORGANIZATION_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new OrganizationDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: OrganizationDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== ORGANIZATION_DIRECTORY_COLUMNS.length + 3 ||
      !keys.includes("description") ||
      !keys.includes("website_url") ||
      !keys.includes("social_links")
    ) {
      throw new OrganizationDirectoryOperationError();
    }
    const searchKeys = keys.filter(
      (key) => key !== "description" && key !== "website_url" && key !== "social_links",
    );
    const expected = [...ORGANIZATION_DIRECTORY_COLUMNS];
    if (!expected.every((key, index) => searchKeys[index] === key)) {
      throw new OrganizationDirectoryOperationError();
    }
  }
}

function enforceKnownGameVocabulary(input: { game?: string | undefined; region?: string | undefined }): void {
  if (input.game === undefined) {
    return;
  }
  if (input.game === "bgmi") {
    if (input.region !== undefined && !validateGameRegion(input.game, input.region)) {
      throw new OrganizationDirectoryValidationError();
    }
  }
}

export async function searchOrganizations(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicOrganizationCard[]> {
  let parsed: SearchOrganizationsInput;
  try {
    parsed = searchOrganizationsInputSchema.parse(input);
  } catch {
    throw new OrganizationDirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_organizations", {
    p_game: parsed.game ?? null,
    p_region: parsed.region ?? null,
    p_org_type: parsed.orgType ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new OrganizationDirectoryOperationError();
  }
  const rows = ((data ?? []) as OrganizationSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicOrganizationCard(row));
}

export async function getOrganizationBySlug(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicOrganizationDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getOrganizationBySlugInputSchema.parse(normalized);
  } catch {
    throw new OrganizationDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_organization_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new OrganizationDirectoryOperationError();
  }
  const rows = ((data ?? []) as OrganizationDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new OrganizationDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicOrganizationDetail(rows[0] as OrganizationDetailRpcRow);
}
