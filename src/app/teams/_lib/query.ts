// Route-boundary query parsing for /teams (P1).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned input
// to TeamDirectoryReader.searchTeams — the sole public team data path.
//
// Fail-safe rule: every invalid parameter is dropped (recorded in `invalid`
// for a user-facing notice) and valid filters are preserved. Pagination is
// bounded: the URL carries only a 1-based `page`; limit/offset are derived
// from the frozen page size, inside the remediated SQL clamps (limit 1..60,
// offset 0..1000). No unbounded fetching is expressible.
//
// Integration boundary: the D1 RPC pair is UNAPPLIED, so reads currently
// resolve to the route error state (never fake rows). See
// docs/product-development/P1-teams-discovery/03-domain-data-integration.md.

import { z } from "zod";
import type { SearchTeamsInput } from "@/features/teams/schemas/directory";
import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";

// Frozen route page size (inside the SQL 1..60 limit). One extra row is
// fetched internally to detect a next page without leaking total counts.
export const TEAMS_PAGE_SIZE = 24;

// SQL OFFSET ceiling is 1000 (D1.5.1 §H). (42 - 1) * 24 = 984 stays inside
// it; page 43+ can never address new rows, so it is rejected at this
// boundary — the same derivation as the player directory.
export const TEAMS_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(TEAMS_MAX_PAGE);

export interface TeamsFilters {
  game?: string | undefined;
  region?: string | undefined;
  query?: string | undefined;
}

export interface ParsedTeamsQuery {
  filters: TeamsFilters;
  page: number;
  limit: number;
  offset: number;
  // Names of dropped parameters ("game" | "region" | "query" | "page").
  invalid: string[];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

// Empty strings (e.g. "All ..." form options submitting `game=`) mean absent,
// not invalid.
function clean(value: string | string[] | undefined): string | undefined {
  const first = firstValue(value);
  if (first === undefined) {
    return undefined;
  }
  const trimmed = first.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Parse raw route search params. Never throws: invalid fields are dropped and
// named in `invalid` so the route can show a safe notice.
export function parseTeamsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedTeamsQuery {
  const invalid: string[] = [];
  const filters: TeamsFilters = {};

  const game = clean(raw["game"])?.toLowerCase();
  if (game !== undefined) {
    if (gameFieldSchema.safeParse(game).success) {
      filters.game = game;
    } else {
      invalid.push("game");
    }
  }

  const region = clean(raw["region"]);
  if (region !== undefined) {
    if (regionFieldSchema.safeParse(region).success) {
      filters.region = region;
    } else {
      invalid.push("region");
    }
  }

  const query = clean(raw["query"]);
  if (query !== undefined) {
    if (queryFieldSchema.safeParse(query).success) {
      filters.query = query;
    } else {
      invalid.push("query");
    }
  }

  const pageRaw = clean(raw["page"]);
  let page = 1;
  if (pageRaw !== undefined) {
    const parsed = pageFieldSchema.safeParse(pageRaw);
    if (parsed.success) {
      page = parsed.data;
    } else {
      invalid.push("page");
    }
  }

  return {
    filters,
    page,
    limit: TEAMS_PAGE_SIZE,
    offset: (page - 1) * TEAMS_PAGE_SIZE,
    invalid,
  };
}

// Map the parsed route query to the reader input contract. Field names match
// the reader; undefined fields are omitted (never forwarded). The D1 RPC has
// no recruiting/role filter, so none is invented here — recruiting status is
// display-only in P1 (see the integration notes).
export function toTeamSearchInput(parsed: ParsedTeamsQuery): SearchTeamsInput {
  // +1 over-read detects a next page without total-count queries.
  const input: SearchTeamsInput = {
    limit: TEAMS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

// Shareable directory URL preserving exactly the valid filters. Page 1 is
// omitted (canonical directory URL has no page param).
export function buildTeamsHref(filters: TeamsFilters, page: number): `/teams` | `/teams?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/teams" : `/teams?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

// Directory metadata: static copy only, no projection data, no PII.
export function buildTeamsMetadata(): RouteMetadata {
  return {
    title: "Team directory",
    description: "Search public MicroNest Esports teams by game, region or name.",
  };
}

// Detail metadata derived ONLY from the public team card (generateMetadata
// from projection only). The card type cannot carry private fields, so no
// private value can leak here.
export function buildTeamDetailMetadata(card: PublicTeamDetail): RouteMetadata {
  const title = `${card.name} (@${card.slug})`;
  if (card.description !== null && card.description.trim() !== "") {
    return { title, description: card.description.trim().slice(0, 160) };
  }
  const bits = [card.game_key, card.region_code, card.current_level];
  return {
    title,
    description: `Public team profile for ${card.name} (@${card.slug}): ${bits.join(" · ")}.`,
  };
}

// Generic not-found metadata. Identical for missing and private slugs
// (404-equivalence): no existence signal.
export function buildTeamNotFoundMetadata(): RouteMetadata {
  return {
    title: "Team not found",
    description: "The requested team could not be found.",
  };
}

// Canonical base URL. Reads the documented public app URL only; when it is
// not configured no canonical is emitted (never invent a domain).
export function getTeamsAppBaseUrl(): string | undefined {
  const raw = process.env["NEXT_PUBLIC_APP_URL"]?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export function buildTeamsCanonicalUrl(path: string): string | undefined {
  const base = getTeamsAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
