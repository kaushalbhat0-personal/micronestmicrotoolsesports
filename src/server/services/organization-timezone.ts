import type { SupabaseClient } from "@supabase/supabase-js";
import { internalError, notFoundError, validationError } from "@/lib/errors";

/**
 * Canonical organization/workspace timezone resolver
 * (RCCF-FREEMIUM-PLATFORM-IMPLEMENT-06 prerequisite).
 *
 * Single authoritative source for `organizations.timezone` (IANA identifier).
 * Future features (e.g. Tie-Breaker Free monthly metering) MUST use this
 * resolver — never `supabase.from("organizations").select("timezone")`
 * scattered at call sites.
 *
 * Authority model:
 * - `organizations.timezone`: authoritative workspace configuration
 *   (TEXT NOT NULL DEFAULT 'Asia/Kolkata', CHECK via pg_timezone_names).
 * - `APP_TIMEZONE` (src/lib/utils/format.ts): display-formatting default only.
 *   This resolver NEVER falls back to APP_TIMEZONE — a missing/invalid
 *   organization timezone is a data-integrity failure, not a display choice.
 * - Sponsorship monthly quotas remain UTC-based and MUST NOT use this
 *   resolver (frozen semantics in sponsorship-limits.ts / consume_free_check).
 *
 * Server-only: lives under src/server/, takes a server Supabase client and a
 * server-derived organization ID. Never accepts timezone from request
 * body/query/header, never touches the browser.
 */

/** Database default for new/backfilled organizations (mirrors the migration). */
export const ORGANIZATION_TIMEZONE_DEFAULT = "Asia/Kolkata" as const;

/**
 * Server-side IANA timezone validation without a static list.
 *
 * Two layers (both must pass):
 * 1. Shape: `Area/Location` (e.g. "Asia/Kolkata") or exactly "UTC". This
 *    rejects offsets ("+05:30"), abbreviations ("IST"), and POSIX-style
 *    strings — which the ICU runtime would otherwise accept even though
 *    they are not canonical workspace identifiers.
 * 2. Runtime IANA database: `Intl.DateTimeFormat` throws RangeError for
 *    unknown zones (same identifier set Postgres validates via
 *    pg_timezone_names).
 */
const IANA_ZONE_SHAPE = /^[A-Za-z_][A-Za-z0-9_+-]*\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/;

export function isValidTimezoneIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  if (value !== "UTC" && !IANA_ZONE_SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse-or-throw for server-side writes. The database CHECK remains
 * authoritative; this is the second defensive layer before writes.
 */
export function parseTimezoneIdentifier(value: unknown): string {
  if (!isValidTimezoneIdentifier(value)) {
    throw validationError("Invalid timezone identifier. Use an IANA name such as Asia/Kolkata.");
  }
  return value;
}

/**
 * Read the canonical timezone for an organization.
 *
 * - `organizationId` must come from trusted server context
 *   (requireOrganizationContext / membership-checked path), never client input.
 * - Fail closed: unknown organization → NOT_FOUND; missing/invalid stored
 *   value → INTERNAL (never silent APP_TIMEZONE fallback).
 */
export async function getOrganizationTimezone(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  if (typeof organizationId !== "string" || organizationId.length === 0) {
    throw validationError("Missing organization");
  }
  const { data, error } = await supabase
    .from("organizations")
    .select("timezone")
    .eq("id", organizationId)
    .single();
  if (error || !data) {
    throw notFoundError("Organization not found");
  }
  const timezone = (data as { timezone?: unknown }).timezone;
  if (!isValidTimezoneIdentifier(timezone)) {
    throw internalError("Organization timezone is not configured correctly");
  }
  return timezone;
}
