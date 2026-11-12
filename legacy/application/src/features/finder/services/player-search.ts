import { z } from "zod";
import { COMPETITIVE_LEVELS } from "../domain/levels";
import { BGMI_ROLES } from "../domain/roles";
import type { PublicPlayerFilters } from "../repositories/finder";

/**
 * Finder — /find/players query parser.
 *
 * Pure function: URLSearchParams-shaped input in, validated filters out.
 * Unknown values fall back to undefined (filter ignored), never to an
 * error page — discovery must not break on hand-edited URLs.
 */

const levelSchema = z.enum(COMPETITIVE_LEVELS).optional();
const roleSchema = z.enum(BGMI_ROLES).optional();

export interface RawPlayerSearchParams {
  q?: string | string[] | undefined;
  current_level?: string | string[] | undefined;
  target_level?: string | string[] | undefined;
  role?: string | string[] | undefined;
  region?: string | string[] | undefined;
  open_to_tryout?: string | string[] | undefined;
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

export function parsePlayerSearchParams(raw: RawPlayerSearchParams): PublicPlayerFilters {
  const query = cleanText(first(raw.q), 40);
  const currentLevel = levelSchema.safeParse(first(raw.current_level)).data;
  const targetLevel = levelSchema.safeParse(first(raw.target_level)).data;
  const role = roleSchema.safeParse(first(raw.role)).data;
  const region = cleanText(first(raw.region), 40);
  const openToTryout = first(raw.open_to_tryout) === "1";

  return {
    game: "bgmi",
    query,
    currentLevel,
    targetLevel,
    role,
    region,
    openToTryout: openToTryout ? true : undefined,
    limit: 60,
  };
}

/** Active (non-default) filters, for the "clear all" affordance and count. */
export function activeFilterCount(filters: PublicPlayerFilters): number {
  let count = 0;
  if (filters.query) count += 1;
  if (filters.currentLevel) count += 1;
  if (filters.targetLevel) count += 1;
  if (filters.role) count += 1;
  if (filters.region) count += 1;
  if (filters.openToTryout) count += 1;
  return count;
}
