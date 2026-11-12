// Route-boundary query parsing for /organizations (P8).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned input
// to OrganizationReader.searchOrganizations — the sole public data path
// (PROPOSED RPC pair, no migration exists): no base-table reads, no elevated
// database client, no new RPCs. Recruitment availability is intentionally NOT
// a filter: no grounded recruitment data exists in this phase, so inventing
// the filter would fabricate supply.
//
// Fail-safe: invalid parameters are dropped (recorded in `invalid`) and valid
// filters preserved. Pagination is bounded: the URL carries only a 1-based
// `page`; limit/offset derive from the frozen page size inside the proposed
// SQL clamps (1..60 / 0..1000). No unbounded fetching is expressible.

import { z } from "zod";
import type { SearchOrganizationsInput } from "@/features/organizations/schemas/directory";
import type { PublicOrganizationDetail } from "@/features/organizations/domain/organization";

export const ORGANIZATIONS_PAGE_SIZE = 24;

export const ORGANIZATIONS_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const orgTypeFieldSchema = z.enum([
  "professional",
  "semi-professional",
  "amateur",
  "community",
  "collegiate",
  "academy",
]);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(ORGANIZATIONS_MAX_PAGE);

export interface OrganizationFilters {
  game?: string | undefined;
  region?: string | undefined;
  orgType?:
    | "professional"
    | "semi-professional"
    | "amateur"
    | "community"
    | "collegiate"
    | "academy"
    | undefined;
  query?: string | undefined;
}

export interface ParsedOrganizationsQuery {
  filters: OrganizationFilters;
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

export function parseOrganizationsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedOrganizationsQuery {
  const invalid: string[] = [];
  const filters: OrganizationFilters = {};

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

  const orgType = clean(raw["type"])?.toLowerCase();
  if (orgType !== undefined) {
    const parsed = orgTypeFieldSchema.safeParse(orgType);
    if (parsed.success) {
      filters.orgType = parsed.data;
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
    limit: ORGANIZATIONS_PAGE_SIZE,
    offset: (page - 1) * ORGANIZATIONS_PAGE_SIZE,
    invalid,
  };
}

export function toOrganizationSearchInput(parsed: ParsedOrganizationsQuery): SearchOrganizationsInput {
  const input: SearchOrganizationsInput = {
    limit: ORGANIZATIONS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.game !== undefined) {
    input.game = parsed.filters.game;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.orgType !== undefined) {
    input.orgType = parsed.filters.orgType;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

export function buildOrganizationsHref(
  filters: OrganizationFilters,
  page: number,
): `/organizations` | `/organizations?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.orgType !== undefined) {
    params.set("type", filters.orgType);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/organizations" : `/organizations?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

export function buildOrganizationsMetadata(): RouteMetadata {
  return {
    title: "Organization directory",
    description:
      "Search public MicroNest Esports organizations by game, region, type or name. Teams stay independently discoverable.",
  };
}

export function buildOrganizationDetailMetadata(card: PublicOrganizationDetail): RouteMetadata {
  const title = `${card.name} (@${card.slug})`;
  if (card.description !== null && card.description.trim() !== "") {
    return { title, description: card.description.trim().slice(0, 160) };
  }
  return {
    title,
    description: `Public organization profile for ${card.name} (@${card.slug}): ${card.org_type} · ${card.region_code}.`,
  };
}

export function buildOrganizationNotFoundMetadata(): RouteMetadata {
  return {
    title: "Organization not found",
    description: "The requested organization profile could not be found.",
  };
}

export function buildOrganizationsUnavailableMetadata(): RouteMetadata {
  return {
    title: "Organization temporarily unavailable",
    description: "This organization listing is temporarily unavailable. Please try again later.",
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

export function buildOrganizationsCanonicalUrl(path: string): string | undefined {
  const base = getAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
