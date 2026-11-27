import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PAID_SOURCES,
  resolveSponsorshipAccessLevel,
  resolveSponsorshipLimits,
  resolveOrgCheckPrincipal,
  reserveFreeCheckOrThrow,
  type OrgCheckPrincipal,
  type SponsorshipLimits,
} from "./sponsorship-limits";
import {
  SPONSORSHIP_TOOL_SLUG,
  ensureFreeSponsorshipGrant,
} from "./user-sponsorship-service";
import { hasSponsorshipAccessForOrg } from "./sponsorship-access";
import type { EntitlementSource, Scan } from "@/types/database";

/**
 * Sponsorship Free policy module (freemium platform, Phase 3).
 *
 * Owns every Sponsorship-only behavior the generic registry must not know:
 * 1 active campaign, 1 draft, 1 connected channel, 10 checks/month UTC,
 * 7-day history, owner-principal resolution, free-check reservation,
 * campaign/channel guards, and expired-paid → Free semantics.
 *
 * Nothing here generalizes: no universal quota, no cross-tool logic.
 * The delegating wrappers below are the migration seam — legacy names keep
 * working while the generic layer dispatches through this module.
 */

export type SponsorshipPolicyLevel = "paid" | "free" | "none";

export interface SponsorshipPolicyGrant {
  readonly source: string;
  readonly expires_at: string | null;
}

function isUnexpiredPolicyGrant(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

/**
 * Pure user-grant evaluation with the frozen Sponsorship decision table.
 * Mirrors `resolveSponsorshipAccessLevel` (sponsorship-limits.ts) step for
 * step; parity is proven by test, never assumed.
 */
export function evaluateSponsorshipUserGrant(grant: SponsorshipPolicyGrant | null): SponsorshipPolicyLevel {
  if (!grant) return "none";
  if (isUnexpiredPolicyGrant(grant.expires_at)) {
    if (grant.source === "free") return "free";
    if (PAID_SOURCES.has(grant.source as EntitlementSource)) return "paid";
    return "none";
  }
  if (PAID_SOURCES.has(grant.source as EntitlementSource)) return "free";
  return "none";
}

/** Thin delegator: full access-level resolution (membership + org + grant). */
export function resolveSponsorshipPolicyLevel(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string }
): Promise<SponsorshipPolicyLevel> {
  return resolveSponsorshipAccessLevel(supabase, input);
}

/** Thin delegator: limits for a user in an organization. */
export function resolveSponsorshipPolicyLimits(
  supabase: SupabaseClient,
  input: { userId: string; organizationId?: string | undefined }
): Promise<SponsorshipLimits> {
  // exactOptionalPropertyTypes: omit the key rather than passing undefined.
  return input.organizationId === undefined
    ? resolveSponsorshipLimits(supabase, { userId: input.userId })
    : resolveSponsorshipLimits(supabase, { userId: input.userId, organizationId: input.organizationId });
}

/** Thin delegator: server-derived background principal for an organization. */
export function resolveSponsorshipPolicyPrincipal(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgCheckPrincipal> {
  return resolveOrgCheckPrincipal(supabase, organizationId);
}

/** Thin delegator: database-authoritative free-check reservation. */
export function reserveSponsorshipPolicyCheck(
  supabase: SupabaseClient,
  input: {
    userId: string;
    organizationId: string;
    campaignId: string;
    platform: "twitch" | "youtube" | "kick";
    scannerVersion: string;
  }
): Promise<{ scan: Scan; freePath: boolean }> {
  return reserveFreeCheckOrThrow(supabase, input);
}

/** Thin delegator: organization coverage for background paths. */
export function hasSponsorshipPolicyAccessForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  userId?: string | undefined
): Promise<boolean> {
  return hasSponsorshipAccessForOrg(supabase, organizationId, userId);
}

/** Thin delegator: idempotent lifetime Free issuance (never downgrades paid). */
export function ensureSponsorshipPolicyFreeGrant(supabase: SupabaseClient, userId: string) {
  return ensureFreeSponsorshipGrant(supabase, userId);
}

export { SPONSORSHIP_TOOL_SLUG };
