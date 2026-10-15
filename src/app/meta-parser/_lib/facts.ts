import type { BadgeVariant } from "@/components/ui/badge";
import {
  META_PARSER_READ_DEFAULT_LIMIT,
  isGenericPatchVersion,
} from "@/features/meta-parser/repositories/reads";

/**
 * Shared public-Facts URL/query/presentation helpers.
 *
 * Pure functions only — no data access, no Supabase, no writer imports.
 * Server Components use these to translate URL search params into
 * `repositories/reads.ts` arguments and back into shareable links.
 * Pagination mirrors the reader: fixed default page size, offset pages.
 */

export const FACTS_PAGE_SIZE = META_PARSER_READ_DEFAULT_LIMIT;

/**
 * URL-shape guard for `[version]` segments. Generic transport guard only
 * (safe chars + at least one digit); the read repository remains the
 * source of truth. Supports 7.41, 14.10, EP09, Y10S1.1, 2026-03-12, etc.
 */
export function isVersionParam(value: string): boolean {
  return isGenericPatchVersion(value);
}

export interface FactsQuery {
  readonly entityType: string | null;
  readonly changeType: string | null;
  readonly entity: string | null;
  readonly page: number;
  readonly limit: number;
  readonly offset: number;
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parse patch-page search params. Invalid page numbers fall back to page 1;
 * filter values pass through untouched so the read repository (closed enums,
 * server-side normalization) stays the single validator.
 */
export function parseFactsQuery(searchParams: {
  [key: string]: string | string[] | undefined;
}): FactsQuery {
  const rawPage = Number(firstParam(searchParams["page"]) ?? "");
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = FACTS_PAGE_SIZE;
  return {
    entityType: firstParam(searchParams["entity_type"]),
    changeType: firstParam(searchParams["change_type"]),
    entity: firstParam(searchParams["entity"]),
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export interface FactsLinkQuery {
  readonly entityType?: string | null;
  readonly changeType?: string | null;
  readonly entity?: string | null;
  readonly page?: number | null;
}

/** Build a filter-preserving patch URL (page omitted for page 1 canonical shape). */
export function factsHref(basePath: string, query: FactsLinkQuery): string {
  const params = new URLSearchParams();
  if (query.entityType) params.set("entity_type", query.entityType);
  if (query.changeType) params.set("change_type", query.changeType);
  if (query.entity) params.set("entity", query.entity);
  if (query.page !== null && query.page !== undefined && query.page > 1) {
    params.set("page", String(query.page));
  }
  const suffix = params.toString();
  return suffix === "" ? basePath : `${basePath}?${suffix}`;
}

/** Human-readable range label, e.g. "1–50 of 1,726". Total is the header exact count. */
export function factsRangeLabel(offset: number, shown: number, total: number): string {
  if (total === 0) return "0 changes";
  const from = offset + 1;
  const to = offset + shown;
  return `${from.toLocaleString("en-US")}–${to.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
}

/** Single presentation map for change-type enum → label. No second classification. */
export const CHANGE_TYPE_LABELS: Readonly<Record<string, string>> = {
  buff: "Buff",
  nerf: "Nerf",
  adjustment: "Adjustment",
  rework: "Rework",
  new: "New",
  bugfix: "Bug fix",
  neutral: "Neutral",
};

export function changeTypeLabel(changeType: string): string {
  return CHANGE_TYPE_LABELS[changeType] ?? changeType;
}

/** Single presentation map for known entity types; unknown types fall back to Title Case. */
export const ENTITY_TYPE_LABELS: Readonly<Record<string, string>> = {
  hero: "Hero",
  champion: "Champion",
  agent: "Agent",
  operator: "Operator",
  weapon: "Weapon",
  item: "Item",
  map: "Map",
  legend: "Legend",
  ability: "Ability",
  character: "Character",
  system: "System",
};

/** Humanize any adapter-defined entity type (champion → Champion). Never blank. */
export function entityTypeLabel(entityType: string): string {
  const known = ENTITY_TYPE_LABELS[entityType];
  if (known !== undefined) return known;
  const words = entityType
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length > 0 ? words.join(" ") : entityType;
}

/** Badge styling per change type. The text label is always rendered alongside — never color-only. */
export function changeTypeBadgeVariant(changeType: string): BadgeVariant {
  switch (changeType) {
    case "buff":
      return "success";
    case "nerf":
      return "destructive";
    case "rework":
      return "default";
    case "new":
      return "info";
    case "bugfix":
      return "warning";
    case "adjustment":
      return "secondary";
    default:
      return "outline";
  }
}

/** Known change types stay closed (shared vocabulary); entity types are open. */
export const CHANGE_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "buff", label: "Buff" },
  { value: "nerf", label: "Nerf" },
  { value: "adjustment", label: "Adjustment" },
  { value: "rework", label: "Rework" },
  { value: "new", label: "New" },
  { value: "bugfix", label: "Bug fix" },
  { value: "neutral", label: "Neutral" },
];
