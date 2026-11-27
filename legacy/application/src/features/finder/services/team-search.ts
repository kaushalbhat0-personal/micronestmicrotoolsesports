import { z } from "zod";
import { COMPETITIVE_LEVELS } from "../domain/levels";
import type { PublicTeamFilters } from "../repositories/finder";

/**
 * Finder — /find/teams query parser (Phase C).
 *
 * Pure function: URLSearchParams-shaped input in, validated filters out.
 * Unknown values fall back to undefined (filter ignored), never to an
 * error page — discovery must not break on hand-edited URLs.
 */

const levelSchema = z.enum(COMPETITIVE_LEVELS).optional();

export interface RawTeamSearchParams {
  q?: string | string[] | undefined;
  region?: string | string[] | undefined;
  current_level?: string | string[] | undefined;
  target_level?: string | string[] | undefined;
  recruiting?: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function cleanText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseTeamSearchParams(raw: RawTeamSearchParams): PublicTeamFilters {
  const query = cleanText(first(raw.q), 60);
  const region = cleanText(first(raw.region), 40);
  const currentLevel = levelSchema.safeParse(first(raw.current_level)).data;
  const targetLevel = levelSchema.safeParse(first(raw.target_level)).data;
  // Default: show recruiting teams first-time (cold-start honest). An
  // explicit recruiting=0 clears the filter; any other value keeps it.
  const recruitingParam = first(raw.recruiting);
  const recruitingOnly = recruitingParam === "0" ? undefined : true;

  return {
    game: "bgmi",
    query,
    region,
    currentLevel,
    targetLevel,
    recruitingOnly,
    limit: 60,
  };
}

/** Active (non-default) filters, for the "clear all" affordance and count. */
export function activeTeamFilterCount(filters: PublicTeamFilters): number {
  let count = 0;
  if (filters.query) count += 1;
  if (filters.region) count += 1;
  if (filters.currentLevel) count += 1;
  if (filters.targetLevel) count += 1;
  // recruitingOnly is the default view, not an "active" user filter.
  return count;
}
