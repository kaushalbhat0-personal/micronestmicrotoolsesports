// Route-boundary query parsing for /tools (P5).
// Pure module: no Supabase, no next/headers, no rendering — the tools
// catalogue is a static in-code registry, so there is no database outage
// state here at all. Filters only narrow the static list; every invalid
// parameter is dropped (recorded in `invalid`) and valid filters preserved.

import { z } from "zod";
import { TOOL_CATEGORIES, type ToolCategory } from "@/features/tools/catalog";
import type { ToolDefinition } from "@/features/tools/catalog";

const gameFieldSchema = z.string().regex(/^[a-z0-9-]{2,24}$/, "invalid game filter");

const categoryFieldSchema = z.enum(TOOL_CATEGORIES);

const queryFieldSchema = z.string().min(1).max(120);

export interface ToolsFilters {
  game?: string | undefined;
  category?: ToolCategory | undefined;
  query?: string | undefined;
}

export interface ParsedToolsQuery {
  filters: ToolsFilters;
  // Names of dropped parameters ("game" | "category" | "query").
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

export function parseToolsQuery(
  raw: Record<string, string | string[] | undefined>,
): ParsedToolsQuery {
  const invalid: string[] = [];
  const filters: ToolsFilters = {};

  const game = clean(raw["game"])?.toLowerCase();
  if (game !== undefined) {
    if (gameFieldSchema.safeParse(game).success) {
      filters.game = game;
    } else {
      invalid.push("game");
    }
  }

  const category = clean(raw["category"])?.toLowerCase();
  if (category !== undefined) {
    const parsed = categoryFieldSchema.safeParse(category);
    if (parsed.success) {
      filters.category = parsed.data;
    } else {
      invalid.push("category");
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

  return { filters, invalid };
}

export function buildToolsHref(filters: ToolsFilters): `/tools` | `/tools?${string}` {
  const params = new URLSearchParams();
  if (filters.game !== undefined) {
    params.set("game", filters.game);
  }
  if (filters.category !== undefined) {
    params.set("category", filters.category);
  }
  if (filters.query !== undefined) {
    params.set("query", filters.query);
  }
  const queryString = params.toString();
  return queryString === "" ? "/tools" : `/tools?${queryString}`;
}

export interface RouteMetadata {
  title: string;
  description: string;
}

export function buildToolsMetadata(): RouteMetadata {
  return {
    title: "Esports tools",
    description: "Free planning calculators for esports organizers and teams, starting with BGMI.",
  };
}

export function buildToolDetailMetadata(tool: ToolDefinition): RouteMetadata {
  return {
    title: `${tool.name} — ${tool.tagline}`.slice(0, 160),
    description: tool.description.slice(0, 160),
  };
}

export function buildToolNotFoundMetadata(): RouteMetadata {
  return {
    title: "Tool not found",
    description: "The requested tool could not be found.",
  };
}

export function getToolsAppBaseUrl(): string | undefined {
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

export function buildToolsCanonicalUrl(path: string): string | undefined {
  const base = getToolsAppBaseUrl();
  if (base === undefined) {
    return undefined;
  }
  return `${base}${path}`;
}
