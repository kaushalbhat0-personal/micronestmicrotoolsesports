// Public tournament directory reader (P3).
// Reads exclusively through the PROPOSED masked RPC pair
// `search_tournaments` / `get_tournament_by_slug` — no migration exists, so
// these calls resolve to the generic unavailable state until the data-model
// proposal (04-data-model.md) is accepted, migrated, and verified. The
// contract below is the acceptance target, pinned by tests with a fake
// client: no base-table reads, no elevated client, no new RPCs invented at
// the route layer.
//
// Security posture (mirrors P1 teams reader):
// - Server-side only; call-site injects any client (anon included).
// - Identity-free: no user ID accepted anywhere in this module.
// - Zod-validated inputs; known-game (bgmi) region vocabulary enforced
//   pre-RPC; unknown games pass through to zero rows (fail closed).
// - Strict output mapping to the proposed columns (+ description/contact/
//   eligibility for detail, + derived status). Extra keys — owner identity,
//   organizer internals, moderation metadata — are dropped, never forwarded.
// - External registration URLs are re-validated here (https-only); a bad
//   URL fails the row closed rather than rendering an attacker-controlled
//   link. Contact instructions are length-capped plain text.
// - Errors are generic domain errors (never raw PostgREST detail to UI).
// - No write path exists in this module.

import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGameRegion } from "@/features/player-profile/schemas/game";
import { parseInstantMs } from "../domain/dates";
import { isMoneyAmount } from "../domain/money";
import { isOrganizerRef } from "../domain/organizer";
import { isValidRegistrationUrl } from "../domain/registration";
import {
  deriveStatus,
  isLifecycleState,
  isParticipationFormat,
  type TournamentStatus,
} from "../domain/tournament";
import { TOURNAMENT_DIRECTORY_COLUMNS } from "../domain/columns";
import {
  TournamentDirectoryOperationError,
  TournamentDirectoryValidationError,
  type PublicTournamentCard,
  type PublicTournamentDetail,
} from "../domain/public-card";
import {
  getTournamentBySlugInputSchema,
  searchTournamentsInputSchema,
  type SearchTournamentsInput,
} from "../schemas/tournament";

interface TournamentSearchRpcRow {
  slug: unknown;
  title: unknown;
  game_key: unknown;
  region_code: unknown;
  format: unknown;
  starts_at: unknown;
  ends_at: unknown;
  timezone: unknown;
  entry_fee: unknown;
  prize_pool: unknown;
  organizer: unknown;
  lifecycle: unknown;
  registration_url: unknown;
  registration_closes_at: unknown;
}

interface TournamentDetailRpcRow extends TournamentSearchRpcRow {
  description: unknown;
  contact_instructions: unknown;
  eligibility: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && parseInstantMs(value) !== null;
}

function toMoneyOrNull(value: unknown): PublicTournamentCard["entry_fee"] {
  if (value === null) {
    return null;
  }
  if (isMoneyAmount(value)) {
    return { amountMinor: value.amountMinor, currency: value.currency };
  }
  throw new TournamentDirectoryOperationError();
}

function toUrlOrNull(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (isValidRegistrationUrl(value)) {
    return (value as string).trim();
  }
  throw new TournamentDirectoryOperationError();
}

function toInstantOrNull(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (isIsoInstant(value)) {
    return value;
  }
  throw new TournamentDirectoryOperationError();
}

function deriveCardStatus(row: { starts_at: string; ends_at: string }): TournamentStatus {
  const startsMs = parseInstantMs(row.starts_at) as number;
  const endsMs = parseInstantMs(row.ends_at) as number;
  return deriveStatus(startsMs, endsMs, Date.now());
}

function toPublicTournamentCard(row: TournamentSearchRpcRow): PublicTournamentCard {
  if (
    !isNonEmptyString(row.slug) ||
    !isNonEmptyString(row.title) ||
    !isNonEmptyString(row.game_key) ||
    !isNonEmptyString(row.region_code) ||
    !isParticipationFormat(row.format) ||
    !isIsoInstant(row.starts_at) ||
    !isIsoInstant(row.ends_at) ||
    !isNonEmptyString(row.timezone) ||
    !isLifecycleState(row.lifecycle) ||
    !isOrganizerRef(row.organizer)
  ) {
    throw new TournamentDirectoryOperationError();
  }
  const startsAt = row.starts_at;
  const endsAt = row.ends_at;
  if ((parseInstantMs(endsAt) as number) <= (parseInstantMs(startsAt) as number)) {
    throw new TournamentDirectoryOperationError();
  }
  return {
    slug: row.slug,
    title: row.title,
    game_key: row.game_key,
    region_code: row.region_code,
    format: row.format,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone: row.timezone,
    entry_fee: toMoneyOrNull(row.entry_fee),
    prize_pool: toMoneyOrNull(row.prize_pool),
    organizer: {
      kind: row.organizer.kind,
      name: row.organizer.name,
      slug: row.organizer.slug,
      verified: false,
    },
    lifecycle: row.lifecycle,
    registration_url: toUrlOrNull(row.registration_url),
    registration_closes_at: toInstantOrNull(row.registration_closes_at),
    status: deriveCardStatus({ starts_at: startsAt, ends_at: endsAt }),
  };
}

function toEligibilityOrNull(value: unknown): PublicTournamentDetail["eligibility"] {
  if (value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TournamentDirectoryOperationError();
  }
  const record = value as Record<string, unknown>;
  const { min_team_size, max_team_size, region_codes, min_age, note } = record;
  if (
    (min_team_size !== null && (typeof min_team_size !== "number" || !Number.isInteger(min_team_size))) ||
    (max_team_size !== null && (typeof max_team_size !== "number" || !Number.isInteger(max_team_size))) ||
    !Array.isArray(region_codes) ||
    !region_codes.every((entry) => typeof entry === "string") ||
    (min_age !== null && typeof min_age !== "number") ||
    (note !== null && typeof note !== "string")
  ) {
    throw new TournamentDirectoryOperationError();
  }
  return {
    min_team_size: min_team_size as number | null,
    max_team_size: max_team_size as number | null,
    region_codes: region_codes as string[],
    min_age: min_age as number | null,
    note: note as string | null,
  };
}

function toPublicTournamentDetail(row: TournamentDetailRpcRow): PublicTournamentDetail {
  const card = toPublicTournamentCard(row);
  if (
    (typeof row.description !== "string" && row.description !== null) ||
    (typeof row.contact_instructions !== "string" && row.contact_instructions !== null)
  ) {
    throw new TournamentDirectoryOperationError();
  }
  if (
    typeof row.contact_instructions === "string" &&
    row.contact_instructions.length > 500
  ) {
    throw new TournamentDirectoryOperationError();
  }
  return { ...card, description: row.description, contact_instructions: row.contact_instructions, eligibility: toEligibilityOrNull(row.eligibility) };
}

function assertSearchKeySet(rows: TournamentSearchRpcRow[]): void {
  const expected = [...TOURNAMENT_DIRECTORY_COLUMNS];
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (keys.length !== expected.length || !expected.every((key, index) => keys[index] === key)) {
      throw new TournamentDirectoryOperationError();
    }
  }
}

function assertDetailKeySet(rows: TournamentDetailRpcRow[]): void {
  for (const row of rows) {
    const keys = Object.keys(row as unknown as Record<string, unknown>);
    if (
      keys.length !== TOURNAMENT_DIRECTORY_COLUMNS.length + 3 ||
      !keys.includes("description") ||
      !keys.includes("contact_instructions") ||
      !keys.includes("eligibility")
    ) {
      throw new TournamentDirectoryOperationError();
    }
    const searchKeys = keys.filter(
      (key) => key !== "description" && key !== "contact_instructions" && key !== "eligibility",
    );
    const expected = [...TOURNAMENT_DIRECTORY_COLUMNS];
    if (!expected.every((key, index) => searchKeys[index] === key)) {
      throw new TournamentDirectoryOperationError();
    }
  }
}

function enforceKnownGameVocabulary(input: { game?: string | undefined; region?: string | undefined }): void {
  if (input.game === undefined) {
    return;
  }
  if (input.game === "bgmi") {
    if (input.region !== undefined && !validateGameRegion(input.game, input.region)) {
      throw new TournamentDirectoryValidationError();
    }
  }
}

export async function searchTournaments(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicTournamentCard[]> {
  let parsed: SearchTournamentsInput;
  try {
    parsed = searchTournamentsInputSchema.parse(input);
  } catch {
    throw new TournamentDirectoryValidationError();
  }
  enforceKnownGameVocabulary(parsed);

  const { data, error } = await client.rpc("search_tournaments", {
    p_game: parsed.game ?? null,
    p_region: parsed.region ?? null,
    p_status: parsed.status ?? null,
    p_query: parsed.query ?? null,
    p_limit: parsed.limit,
    p_offset: parsed.offset,
  });
  if (error) {
    throw new TournamentDirectoryOperationError();
  }
  const rows = ((data ?? []) as TournamentSearchRpcRow[]).slice();
  assertSearchKeySet(rows);
  return rows.map((row) => toPublicTournamentCard(row));
}

export async function getTournamentBySlug(
  client: SupabaseClient,
  input: unknown,
): Promise<PublicTournamentDetail | null> {
  const normalized: unknown = typeof input === "string" ? { slug: input } : input;
  let parsed: { slug: string };
  try {
    parsed = getTournamentBySlugInputSchema.parse(normalized);
  } catch {
    throw new TournamentDirectoryValidationError();
  }

  const { data, error } = await client.rpc("get_tournament_by_slug", {
    p_slug: parsed.slug,
  });
  if (error) {
    throw new TournamentDirectoryOperationError();
  }
  const rows = ((data ?? []) as TournamentDetailRpcRow[]).slice();
  if (rows.length === 0) {
    return null;
  }
  if (rows.length !== 1) {
    throw new TournamentDirectoryOperationError();
  }
  assertDetailKeySet(rows);
  return toPublicTournamentDetail(rows[0] as TournamentDetailRpcRow);
}
