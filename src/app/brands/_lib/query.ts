// Route-boundary query parsing for /brands (P8).
// Pure module: no Supabase, no next/headers, no rendering. The route awaits
// `searchParams`, passes the raw record here, and forwards the returned input
// to BrandReader.searchBrands — the sole public data path (PROPOSED RPC pair,
// no migration exists). Sponsorship AVAILABILITY is intentionally not a
// filter: interests are declared intent, never confirmed supply, so an
// availability filter would fabricate listings. The `interest` filter selects
// declared interest only.

import { z } from "zod";
import type { SearchBrandsInput } from "@/features/brands/schemas/directory";
import type { PublicBrandDetail } from "@/features/brands/domain/brand";

export const BRANDS_PAGE_SIZE = 24;

export const BRANDS_MAX_PAGE = 42;

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const regionFieldSchema = z.string().min(1).max(48);

const industryFieldSchema = z.enum([
  "gaming-hardware",
  "peripherals",
  "apparel",
  "energy-drink",
  "food-beverage",
  "fintech",
  "telecom",
  "automotive",
  "media",
  "other",
]);

const interestFieldSchema = z.enum(["teams", "players", "events", "content-creators", "all"]);

const partnershipFieldSchema = z.enum([
  "sponsorship",
  "product-partnership",
  "content-collaboration",
  "event-partnership",
  "affiliate",
  "other",
]);

const queryFieldSchema = z.string().min(1).max(120);

const pageFieldSchema = z.coerce.number().int().min(1).max(BRANDS_MAX_PAGE);

export interface BrandFilters {
  gameInterest?: string | undefined;
  industry?: z.infer<typeof industryFieldSchema> | undefined;
  region?: string | undefined;
  interest?: z.infer<typeof interestFieldSchema> | undefined;
  partnership?: z.infer<typeof partnershipFieldSchema> | undefined;
  query?: string | undefined;
}

export interface ParsedBrandsQuery {
  filters: BrandFilters;
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

export function parseBrandsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedBrandsQuery {
  const invalid: string[] = [];
  const filters: BrandFilters = {};

  const gameInterest = clean(raw["game"])?.toLowerCase();
  if (gameInterest !== undefined) {
    if (gameFieldSchema.safeParse(gameInterest).success) {
      filters.gameInterest = gameInterest;
    } else {
      invalid.push("game");
    }
  }

  const industry = clean(raw["industry"])?.toLowerCase();
  if (industry !== undefined) {
    const parsed = industryFieldSchema.safeParse(industry);
    if (parsed.success) {
      filters.industry = parsed.data;
    } else {
      invalid.push("industry");
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

  const interest = clean(raw["interest"])?.toLowerCase();
  if (interest !== undefined) {
    const parsed = interestFieldSchema.safeParse(interest);
    if (parsed.success) {
      filters.interest = parsed.data;
    } else {
      invalid.push("interest");
    }
  }

  const partnership = clean(raw["partnership"])?.toLowerCase();
  if (partnership !== undefined) {
    const parsed = partnershipFieldSchema.safeParse(partnership);
    if (parsed.success) {
      filters.partnership = parsed.data;
    } else {
      invalid.push("partnership");
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
    limit: BRANDS_PAGE_SIZE,
    offset: (page - 1) * BRANDS_PAGE_SIZE,
    invalid,
  };
}

export function toBrandSearchInput(parsed: ParsedBrandsQuery): SearchBrandsInput {
  const input: SearchBrandsInput = {
    limit: BRANDS_PAGE_SIZE + 1,
    offset: parsed.offset,
  };
  if (parsed.filters.gameInterest !== undefined) {
    input.gameInterest = parsed.filters.gameInterest;
  }
  if (parsed.filters.industry !== undefined) {
    input.industry = parsed.filters.industry;
  }
  if (parsed.filters.region !== undefined) {
    input.region = parsed.filters.region;
  }
  if (parsed.filters.interest !== undefined) {
    input.interest = parsed.filters.interest;
  }
  if (parsed.filters.partnership !== undefined) {
    input.partnership = parsed.filters.partnership;
  }
  if (parsed.filters.query !== undefined) {
    input.query = parsed.filters.query;
  }
  return input;
}

export function buildBrandsHref(filters: BrandFilters, page: number): `/brands` | `/brands?${string}` {
  const params = new URLSearchParams();
  if (filters.gameInterest !== undefined) {
    params.set("game", filters.gameInterest);
  }
  if (filters.industry !== undefined) {
    params.set("industry", filters.industry);
  }
  if (filters.region !== undefined) {
    params.set("region", filters.region);
  }
  if (filters.interest !== undefined) {
    params.set("interest", filters.interest);
  }
  if (filters.partnership !== undefined) {
    params.set("partnership", filters.partnership);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const queryString = params.toString();
  return queryString === "" ? "/brands" : `/brands?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

export function buildBrandsMetadata(): RouteMetadata {
  return {
    title: "Brand directory",
    description:
      "Search public MicroNest Esports brand profiles by industry, game interest, region or name. Interests are declared intent, not confirmed offers.",
  };
}

export function buildBrandDetailMetadata(card: PublicBrandDetail): RouteMetadata {
  const title = `${card.name} (@${card.slug})`;
  if (card.description !== null && card.description.trim() !== "") {
    return { title, description: card.description.trim().slice(0, 160) };
  }
  return {
    title,
    description: `Public brand profile for ${card.name} (@${card.slug}): ${card.industry} · ${card.region_code}.`,
  };
}

export function buildBrandNotFoundMetadata(): RouteMetadata {
  return {
    title: "Brand not found",
    description: "The requested brand profile could not be found.",
  };
}

export function buildBrandUnavailableMetadata(): RouteMetadata {
  return {
    title: "Brand temporarily unavailable",
    description: "This brand listing is temporarily unavailable. Please try again later.",
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

export function buildBrandsCanonicalUrl(path: string): string | undefined {
  const base = getAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
