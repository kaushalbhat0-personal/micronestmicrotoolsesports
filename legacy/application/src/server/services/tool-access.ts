import type { SupabaseClient } from "@supabase/supabase-js";
import { getToolFreePolicy } from "@/config/tools/policy";
import { hasOrganizationGrant } from "@/lib/auth/require-entitlement";
import { findToolBySlug } from "@/server/repositories/tools";
import { findUserGrant } from "@/server/repositories/user-entitlements";
import { isOrgMember } from "@/server/services/sponsorship-limits";
import { evaluateSponsorshipUserGrant } from "@/server/services/sponsorship-policy";

/**
 * Generic tool access-resolution skeleton (freemium platform, Phase A +
 * Tie-Breaker Free).
 *
 * Sits beside the existing system; the live page gate remains
 * `requireEntitlement` (which passes for any unexpired org grant, paid or
 * Free). Sponsorship semantics live in the policy module
 * (`sponsorship-policy.ts`, mirroring frozen `sponsorship-limits.ts`) —
 * this skeleton only decides *whether* a user-grant leg may run, plus the
 * org-scoped Free leg owned by each tool's policy module.
 *
 * Exact order (fail closed throughout):
 * 1. organization membership, else "none"
 * 2. organization entitlement / All Access (any unexpired grant passes the
 *    gate), except a Free-only org falls through to the Free leg — a Free
 *    grant never reads as paid
 * 3. policy lookup by canonical slug, else "none"
 * 4. org scope + Free enabled + unexpired source='free' org grant → "free"
 *    (never consults user grants; disabled Free never grants)
 * 5. userGrantable + Free enabled: valid paid user grant → "paid"
 * 6. valid Free user grant → "free"
 * 7. expired paid user grant → "free" (frozen Sponsorship semantics)
 * 8. otherwise "none"; unexpected errors → "none"
 *
 * Server identity only: `userId` must come from the authenticated session
 * (never client input). Returns a level, never data — quotas are enforced
 * downstream by each tool's policy module.
 */

export type ToolAccessLevel = "paid" | "free" | "none";

export interface ToolAccessInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly toolSlug: string;
}

export async function resolveToolAccessLevel(
  supabase: SupabaseClient,
  input: ToolAccessInput
): Promise<ToolAccessLevel> {
  try {
    // 1. Membership first — entitlement without membership is meaningless.
    if (!(await isOrgMember(supabase, input.organizationId, input.userId))) return "none";

    // 2. Organization entitlement / All Access (source-agnostic gate, same as
    // the live requireEntitlement check). A Free-only org is NOT paid: it
    // falls through to the Free leg instead of returning here.
    if (await hasOrganizationGrant(supabase, input.organizationId, input.toolSlug)) {
      if (!(await hasOnlyFreeOrgGrants(supabase, input.organizationId, input.toolSlug))) return "paid";
    }

    // 3. Policy lookup — unknown slugs fail closed, never inferred.
    const policy = getToolFreePolicy(input.toolSlug);
    if (!policy || !policy.freeEnabled) return "none";

    // 4. Org-scoped Free leg: an unexpired source='free' org grant satisfies
    // access without ever consulting user grants.
    if (policy.scope === "org") {
      if (await hasOrganizationFreeGrant(supabase, input.organizationId, input.toolSlug)) return "free";
      return "none";
    }

    // 4b. Org-scoped tools never consult user grants; disabled Free never grants.
    if (!policy.userGrantable) return "none";

    // 5-7. User-grant leg delegated to the Sponsorship policy module, which
    // owns the frozen expiry table (valid paid → paid, valid free → free,
    // expired paid → free, else none). Reached only for userGrantable +
    // freeEnabled policies, so org-scoped tools never consult user grants.
    const tool = await findToolBySlug(supabase, input.toolSlug);
    if (!tool) return "none";
    const grant = await findUserGrant(supabase, input.userId, tool.id);
    if (!grant) return "none";
    // 8. Expired free / unknown-source / otherwise (handled in the table).
    return evaluateSponsorshipUserGrant({ source: grant.source, expires_at: grant.expires_at });
  } catch {
    // 9. Fail closed — never crash callers into an ambiguous grant.
    return "none";
  }
}

function isUnexpiredGrant(expiresAt: string | null): boolean {
  return expiresAt === null || new Date(expiresAt) > new Date();
}

interface OrgEntitlementRow {
  readonly is_all_access: boolean;
  readonly tool_id: string | null;
  readonly source: string;
  readonly expires_at: string | null;
}

/** Unexpired org entitlements covering the tool (per-tool or All Access). */
async function listCoveringOrgGrants(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<OrgEntitlementRow[]> {
  const tool = await findToolBySlug(supabase, toolSlug);
  if (!tool) return [];
  const { data, error } = await supabase
    .from("tool_entitlements")
    .select("is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return ((data ?? []) as OrgEntitlementRow[]).filter(
    (e) => isUnexpiredGrant(e.expires_at) && (e.is_all_access || e.tool_id === tool.id)
  );
}

/**
 * True when the org's covering grants (per-tool or All Access, unexpired)
 * are all source='free' — i.e. the workspace has Free access but no paid
 * coverage. An empty covering set returns false (no grant at all).
 *
 * This is the demotion check that keeps a Free org grant from reading as
 * paid through the source-agnostic entitlement gate above.
 */
async function hasOnlyFreeOrgGrants(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<boolean> {
  try {
    const grants = await listCoveringOrgGrants(supabase, organizationId, toolSlug);
    return grants.length > 0 && grants.every((e) => e.source === "free");
  } catch {
    return false;
  }
}

/** Free-source org coverage for claimable org-scoped Free tiers. */
export async function hasOrganizationFreeGrant(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<boolean> {
  try {
    const grants = await listCoveringOrgGrants(supabase, organizationId, toolSlug);
    return grants.some((e) => e.source === "free");
  } catch {
    return false;
  }
}
