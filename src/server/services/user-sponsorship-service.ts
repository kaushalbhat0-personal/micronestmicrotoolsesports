import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntitlementSource } from "@/types/database";
import {
  createUserGrant,
  deleteUserGrant,
  findUserGrant,
  listUserGrants,
} from "@/server/repositories/user-entitlements";

/**
 * Service: user-scoped Sponsorship access.
 *
 * Explicit fence: the ONLY tool that may be satisfied by a user-scoped grant
 * is Sponsorship Tracking ("sponsor-sentinel"). There is no generic scope
 * flag and no "grant any tool to user" API — operational tools (Draft & Ban,
 * Tie-Breaker Resolver, Prize Pool Splitter) and All Access never consult
 * user grants. Future sponsorship tools opt in here explicitly, by name.
 *
 * A user grant means "this user may use Sponsorship Tracking in organizations
 * where they are a member". It never grants data access by itself — every
 * sponsorship route/service still requires organization context + membership,
 * and RLS remains organization-scoped.
 */

export const SPONSORSHIP_TOOL_SLUG = "sponsor-sentinel";

/** Tools whose access may be satisfied by a user-scoped grant. Sponsorship only. */
const USER_GRANTABLE_TOOL_SLUGS: ReadonlySet<string> = new Set([SPONSORSHIP_TOOL_SLUG]);

export function isUserGrantableTool(toolSlug: string): boolean {
  return USER_GRANTABLE_TOOL_SLUGS.has(toolSlug);
}

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

/**
 * Narrow detector for "Phase-2 migration not applied" — the
 * user_tool_entitlements table/relation is unavailable.
 * Only this known condition fails closed to "no grant". All other
 * database failures rethrow so they are never silently swallowed.
 */
function isMissingUserGrantTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; message?: unknown; details?: unknown };
  const haystack = [err.message, err.details].filter((v): v is string => typeof v === "string").join(" ");
  // The table name must be present — a missing-table error for any OTHER
  // relation must rethrow, never fail closed silently.
  if (!/user_tool_entitlements/i.test(haystack)) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  return /does not exist|could not find the table|schema cache|relation .* does not exist/i.test(haystack);
}

async function sponsorshipToolId(supabase: SupabaseClient): Promise<string | null> {
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", SPONSORSHIP_TOOL_SLUG).single();
  return (tool as { id: string } | null)?.id ?? null;
}

/** Valid user Sponsorship grant? Lifetime (NULL expiry) counts as valid. */
export async function hasUserSponsorshipAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const toolId = await sponsorshipToolId(supabase);
    if (!toolId) return false;
    const grant = await findUserGrant(supabase, userId, toolId);
    if (!grant) return false;
    return isUnexpired(grant.expires_at);
  } catch (e) {
    // Phase-2 migration not yet applied → fail closed, never leak DB internals.
    if (isMissingUserGrantTableError(e)) return false;
    throw e;
  }
}

export async function getUserSponsorshipGrant(supabase: SupabaseClient, userId: string) {
  try {
    const toolId = await sponsorshipToolId(supabase);
    if (!toolId) return null;
    const grant = await findUserGrant(supabase, userId, toolId);
    if (!grant || !isUnexpired(grant.expires_at)) return null;
    return grant;
  } catch (e) {
    // Phase-2 migration not yet applied → fail closed, never leak DB internals.
    if (isMissingUserGrantTableError(e)) return null;
    throw e;
  }
}

/** All user grants for UI/admin display (sponsorship scope only in practice). */
export async function listUserSponsorshipGrants(supabase: SupabaseClient, userId: string) {
  return listUserGrants(supabase, userId);
}

/**
 * Issue a Sponsorship user grant. Server-side callers only (service-role
 * client): RLS denies authenticated writes, so no user can self-grant.
 * Hardcoded to Sponsorship Tracking — there is intentionally no tool parameter.
 */
export async function grantUserSponsorshipAccess(
  supabase: SupabaseClient,
  input: { userId: string; source: EntitlementSource; expiresAt: string | null }
) {
  const toolId = await sponsorshipToolId(supabase);
  if (!toolId) throw new Error("Sponsorship Tracking tool is not registered");
  return createUserGrant(supabase, {
    user_id: input.userId,
    tool_id: toolId,
    source: input.source,
    expires_at: input.expiresAt,
  });
}

/** Revoke the user's Sponsorship grant. Server-side callers only. */
export async function revokeUserSponsorshipAccess(supabase: SupabaseClient, userId: string): Promise<void> {
  const toolId = await sponsorshipToolId(supabase);
  if (!toolId) return;
  await deleteUserGrant(supabase, userId, toolId);
}
