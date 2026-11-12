// Route-boundary query parsing for /players (G1-6).
// Authoritative: 04 section 5 + 05 section 5 + 07 sections 1-4 + 11 section 3
// (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11).
//
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned input
// to DirectoryReader.searchDirectory — the sole public data path. Nothing
// here reimplements discovery predicates; per-game vocabularies stay enforced
// inside the reader (fail closed) and the RPCs.
//
// Fail-safe rule: every invalid parameter is dropped (recorded in `invalid`
// for a user-facing notice) and valid filters are preserved. Pagination is
// bounded: the URL carries only a 1-based `page`; limit/offset are derived
// from the frozen page size. No unbounded fetching is expressible.

import { z } from "zod";
import type { SearchDirectoryInput } from "@/features/player-profile/schemas/directory";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";

// Frozen RPC default limit (G1-4). One extra row is fetched internally to
// detect a next page without leaking total counts.
export const DIRECTORY_PAGE_SIZE = 24;

// SQL OFFSET ceiling is 1000 (G1-4). (42 - 1) * 24 = 984 stays inside it;
// page 43+ can never address new rows, so it is rejected at this boundary.
export const DIRECTORY_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const roleFieldSchema = z.string().min(1).max(32);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(DIRECTORY_MAX_PAGE);

export interface DirectoryFilters {
  game?: string | undefined;
  region?: string | undefined;
  role?: string | undefined;
  query?: string | undefined;
}

export interface ParsedDirectoryQuery {
  filters: DirectoryFilters;
  page: number;
  limit: number;
  offset: number;
  // Names of dropped parameters ("game" | "region" | "role" | "query" | "page").
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
export function parseDirectoryQuery(
  raw: Record<string, string | string[] | undefined>
): ParsedDirectoryQuery {
  const invalid: string[] = [];
  const filters: DirectoryFilters = {};

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

  const role = clean(raw["role"]);
  if (role !== undefined) {
    if (roleFieldSchema.safeParse(role).success) {
      filters.role = role;
    } else {
      invalid.push("role");
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
    limit: DIRECTORY_PAGE_SIZE,
    offset: (page - 1) * DIRECTORY_PAGE_SIZE,
    invalid,
  };
}

// Map the parsed route query to the DirectoryReader input contract. Field
// names match the reader; undefined fields are omitted (never forwarded).
export function toDirectoryInput(parsed: ParsedDirectoryQuery): SearchDirectoryInput {
  // +1 over-read detects a next page without total-count queries.
  const input: SearchDirectoryInput = {
    limit: DIRECTORY_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.role !== undefined) {
    input.role = parsed.filters.role;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

// Shareable directory URL preserving exactly the valid filters. Page 1 is
// omitted (canonical directory URL has no page param). The return type keeps
// Next.js typedRoutes satisfied (`/players` + query-string suffix).
export function buildDirectoryHref(
  filters: DirectoryFilters,
  page: number
): `/players` | `/players?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.role !== undefined) {
    params.set("role", filters.role);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/players" : `/players?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

// Directory metadata: static copy only, no projection data, no PII.
export function buildDirectoryMetadata(): RouteMetadata {
  return {
    title: "Player directory",
    description: "Search public MicroNest Esports player profiles by game, region, role or name.",
  };
}

// Profile metadata derived ONLY from the public projection card (07 section 4:
// generateMetadata from projection only). The card type cannot carry private
// fields (compile-time frozen 12), so no private value can leak here.
export function buildProfileMetadata(card: PublicPlayerCard): RouteMetadata {
  const title = `${card.display_name} (@${card.handle})`;
  if (card.bio !== null && card.bio.trim() !== "") {
    return { title, description: card.bio.trim().slice(0, 160) };
  }
  const bits = [card.ign, card.game_name];
  if (card.primary_role !== null) {
    bits.push(card.primary_role);
  }
  if (card.region_code !== null) {
    bits.push(card.region_code);
  }
  return {
    title,
    description: `Public player profile for ${card.display_name} (@${card.handle}): ${bits.join(" · ")}.`,
  };
}

// Generic not-found metadata. Identical for missing, private, suspended and
// inactive handles (404-equivalence, 08 T5/T8): no existence signal.
export function buildNotFoundMetadata(): RouteMetadata {
  return {
    title: "Player not found",
    description: "The requested player profile could not be found.",
  };
}

// Canonical base URL. Reads the documented public app URL only; when it is
// not configured no canonical is emitted (never invent a domain).
export function getAppBaseUrl(): string | undefined {
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

export function buildCanonicalUrl(path: string): string | undefined {
  const base = getAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
