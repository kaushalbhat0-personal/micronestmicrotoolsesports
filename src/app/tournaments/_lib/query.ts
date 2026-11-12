// Route-boundary query parsing for /tournaments (P3).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned
// input to TournamentReader.searchTournaments — the sole public tournament
// data path (PROPOSED RPC pair, no migration exists; reads resolve to the
// route unavailable state, never fake rows).
//
// Fail-safe rule: every invalid parameter is dropped (recorded in `invalid`
// for a user-facing notice) and valid filters are preserved. Pagination is
// bounded: the URL carries only a 1-based `page`; limit/offset derive from
// the frozen page size inside the proposed SQL clamps (limit 1..60, offset
// 0..1000). No unbounded fetching is expressible.

import { z } from "zod";
import type { SearchTournamentsInput } from "@/features/tournaments/schemas/tournament";
import type { PublicTournamentDetail } from "@/features/tournaments/domain/public-card";

// Frozen route page size (inside the proposed 1..60 limit). One extra row
// is fetched internally to detect a next page without leaking total counts.
export const TOURNAMENTS_PAGE_SIZE = 24;

// Proposed OFFSET ceiling is 1000 (P1/P2 parity). (42 - 1) * 24 = 984 stays
// inside it; page 43+ can never address new rows, so it is rejected here.
export const TOURNAMENTS_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const statusFieldSchema = z.enum(["upcoming", "ongoing", "completed"]);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(TOURNAMENTS_MAX_PAGE);

export interface TournamentFilters {
  game?: string | undefined;
  region?: string | undefined;
  status?: "upcoming" | "ongoing" | "completed" | undefined;
  query?: string | undefined;
}

export interface ParsedTournamentsQuery {
  filters: TournamentFilters;
  page: number;
  limit: number;
  offset: number;
  // Names of dropped parameters ("game" | "region" | "status" | "query" | "page").
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
export function parseTournamentsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedTournamentsQuery {
  const invalid: string[] = [];
  const filters: TournamentFilters = {};

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

  const status = clean(raw["status"])?.toLowerCase();
  if (status !== undefined) {
    const parsed = statusFieldSchema.safeParse(status);
    if (parsed.success) {
      filters.status = parsed.data;
    } else {
      invalid.push("status");
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
    limit: TOURNAMENTS_PAGE_SIZE,
    offset: (page - 1) * TOURNAMENTS_PAGE_SIZE,
    invalid,
  };
}

// Map the parsed route query to the reader input contract. Undefined fields
// are omitted (never forwarded).
export function toTournamentSearchInput(parsed: ParsedTournamentsQuery): SearchTournamentsInput {
  // +1 over-read detects a next page without total-count queries.
  const input: SearchTournamentsInput = {
    limit: TOURNAMENTS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.status !== undefined) {
    input.status = parsed.filters.status;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

// Shareable directory URL preserving exactly the valid filters. Page 1 is
// omitted (canonical directory URL has no page param).
export function buildTournamentsHref(
  filters: TournamentFilters,
  page: number,
): `/tournaments` | `/tournaments?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.status !== undefined) {
    params.set("status", filters.status);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/tournaments" : `/tournaments?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

// Directory metadata: static copy only, no projection data, no PII.
export function buildTournamentsMetadata(): RouteMetadata {
  return {
    title: "Tournament directory",
    description: "Discover MicroNest Esports tournaments by game, region, status or name.",
  };
}

// Detail metadata derived ONLY from the public tournament card
// (generateMetadata from projection only — no private value can leak here).
export function buildTournamentDetailMetadata(card: PublicTournamentDetail): RouteMetadata {
  const title = `${card.title} (@${card.slug})`;
  if (card.description !== null && card.description.trim() !== "") {
    return { title, description: card.description.trim().slice(0, 160) };
  }
  const bits = [card.game_key, card.region_code, card.status];
  return {
    title,
    description: `Tournament listing for ${card.title} (@${card.slug}): ${bits.join(" · ")}.`,
  };
}

// Generic not-found metadata. Identical for missing and unpublished slugs
// (404-equivalence): no existence signal.
export function buildTournamentNotFoundMetadata(): RouteMetadata {
  return {
    title: "Tournament not found",
    description: "The requested tournament could not be found.",
  };
}

// Intentional unavailable metadata (P3 correction). Used when a VALID slug
// cannot be resolved because the database is unreachable (including the
// proposed-RPC missing case): distinct from not-found so outages are never
// mistaken for missing slugs, and no internal database detail is exposed.
export function buildTournamentUnavailableMetadata(): RouteMetadata {
  return {
    title: "Tournament temporarily unavailable",
    description: "This tournament listing is temporarily unavailable. Please try again later.",
  };
}

// Canonical base URL. Reads the documented public app URL only; when it is
// not configured no canonical is emitted (never invent a domain).
export function getTournamentsAppBaseUrl(): string | undefined {
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

export function buildTournamentsCanonicalUrl(path: string): string | undefined {
  const base = getTournamentsAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
