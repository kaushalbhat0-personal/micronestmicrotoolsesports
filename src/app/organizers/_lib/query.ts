// Route-boundary query parsing for /organizers (P9).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned
// input to OrganizerReader.searchOrganizers — the sole public organizer
// data path (PROPOSED RPC pair, local migration only): no base-table reads,
// no elevated database client, no new RPCs, no invented rows.
//
// Fail-safe: invalid parameters are dropped (recorded in `invalid`) and
// valid filters preserved. Pagination is bounded: the URL carries only a
// 1-based `page`; limit/offset derive from the frozen page size inside the
// proposed SQL clamps (1..60 / 0..1000). No unbounded fetching is expressible.

import { z } from "zod";
import type { SearchOrganizersInput } from "@/features/organizers/schemas/directory";
import type { PublicOrganizerDetail } from "@/features/organizers/domain/organizer";

export const ORGANIZERS_PAGE_SIZE = 24;

export const ORGANIZERS_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const organizerTypeFieldSchema = z.enum(["independent", "organization", "professional"]);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(ORGANIZERS_MAX_PAGE);

export interface OrganizerFilters {
  game?: string | undefined;
  region?: string | undefined;
  organizerType?: "independent" | "organization" | "professional" | undefined;
  query?: string | undefined;
}

export interface ParsedOrganizersQuery {
  filters: OrganizerFilters;
  page: number;
  limit: number;
  offset: number;
  invalid: string[];
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function clean(value: string | string[] | undefined): string | undefined {
  const first = firstValue(value);
  if (first === undefined) {
    return undefined;
  }
  const trimmed = first.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function parseOrganizersQuery(
  raw: Record<string, string | string[] | undefined>
): ParsedOrganizersQuery {
  const invalid: string[] = [];
  const filters: OrganizerFilters = {};

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

  const organizerType = clean(raw["type"])?.toLowerCase();
  if (organizerType !== undefined) {
    const parsed = organizerTypeFieldSchema.safeParse(organizerType);
    if (parsed.success) {
      filters.organizerType = parsed.data;
    } else {
      invalid.push("type");
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
    limit: ORGANIZERS_PAGE_SIZE,
    offset: (page - 1) * ORGANIZERS_PAGE_SIZE,
    invalid,
  };
}

export function toOrganizerSearchInput(parsed: ParsedOrganizersQuery): SearchOrganizersInput {
  const input: SearchOrganizersInput = {
    limit: ORGANIZERS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.organizerType !== undefined) {
    input.organizerType = parsed.filters.organizerType;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

export function buildOrganizersHref(
  filters: OrganizerFilters,
  page: number
): `/organizers` | `/organizers?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.organizerType !== undefined) {
    params.set("type", filters.organizerType);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/organizers" : `/organizers?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

export function buildOrganizersMetadata(): RouteMetadata {
  return {
    title: "Tournament organizer directory",
    description:
      "Discover public MicroNest Esports tournament organizers by game, region, type or name.",
  };
}

export function buildOrganizerDetailMetadata(card: PublicOrganizerDetail): RouteMetadata {
  const title = `${card.name} (@${card.slug})`;
  if (card.description !== null && card.description.trim() !== "") {
    return { title, description: card.description.trim().slice(0, 160) };
  }
  return {
    title,
    description: `Public tournament organizer profile for ${card.name} (@${card.slug}): ${card.organizer_type} · ${card.region_code}.`,
  };
}

export function buildOrganizerNotFoundMetadata(): RouteMetadata {
  return {
    title: "Organizer not found",
    description: "The requested organizer profile could not be found.",
  };
}

export function buildOrganizersUnavailableMetadata(): RouteMetadata {
  return {
    title: "Organizer temporarily unavailable",
    description: "This organizer listing is temporarily unavailable. Please try again later.",
  };
}

function getAppBaseUrl(): string | undefined {
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

export function buildOrganizersCanonicalUrl(path: string): string | undefined {
  const base = getAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
