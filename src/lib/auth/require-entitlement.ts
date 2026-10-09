import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { entitlementError } from "@/lib/errors";
import { requireOrganizationMember } from "./require-membership";
import { TOOLS } from "@/config/app/tools";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/user-sponsorship-service";

/**
 * Entitlement authorization — separate from membership.
 * Checks: does organization have access to toolSlug (per-tool OR all-access)?
 *
 * Uses DB helper has_tool_access() where possible, plus app-level resolution for richer errors.
 *
 * Availability rule (RCCF-SPONSOR-FINAL-02): the registry's comingSoon flag
 * is commercially authoritative. Unreleased tools are never granted, even
 * when the RPC/fallback path is used.
 *
 * Multi-scope rule (RCCF-MULTI-SCOPE-IMPLEMENT-02): Sponsorship Tracking
 * ("sponsor-sentinel") may additionally be satisfied by a user-scoped grant
 * (user grant + membership in the current organization). Every other tool —
 * operational tools, All Access, coming-soon tools — uses organization
 * entitlement logic only and never consults user grants.
 */

const COMMERCIALLY_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(
  TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug)
);

const DENIAL_MESSAGE =
  "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.";

/** Organization-scoped grant check — RPC preferred, manual query fallback. Unchanged semantics. */
async function hasOrganizationGrant(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<boolean> {
  // Prefer RPC if available, fallback to query
  const { data: hasAccess, error: rpcError } = await supabase.rpc("has_tool_access", {
    org_id: organizationId,
    tool_slug: toolSlug,
  });

  // If RPC exists and returns boolean, use it
  if (!rpcError && typeof hasAccess === "boolean") {
    return hasAccess;
  }

  // Fallback — manual entitlement resolution
  const { data: tool } = await supabase.from("tools").select("id, slug, is_active").eq("slug", toolSlug).single();

  // Customer-safe message: no tool slugs, no internal access-system wording.
  if (!tool) return false;
  if ((tool as { is_active: boolean }).is_active === false) return false;

  const { data: entitlements } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, expires_at")
    .eq("organization_id", organizationId)
    .or(`is_all_access.eq.true,tool_id.eq.${(tool as { id: string }).id}`);

  return ((entitlements ?? []) as Array<{ expires_at: string | null }>).some(
    (e) => !e.expires_at || new Date(e.expires_at) > new Date()
  );
}

export const requireEntitlement = cache(async (organizationId: string, toolSlug: string) => {
  // Ensure membership first — entitlement without membership is meaningless (deduped via cached member)
  const ctx = await requireOrganizationMember(organizationId);

  // Coming-Soon tools are never commercially available, regardless of DB/RPC state.
  if (!COMMERCIALLY_AVAILABLE_SLUGS.has(toolSlug)) {
    throw entitlementError(DENIAL_MESSAGE);
  }

  const supabase = await createClient();

  if (await hasOrganizationGrant(supabase, organizationId, toolSlug)) {
    return { ...ctx, toolSlug, hasAccess: true as const };
  }

  // User-scoped Sponsorship fallback — explicitly fenced to sponsor-sentinel.
  // Membership was already verified above; the grant alone never grants data.
  // The single access-level resolver is authoritative here (paid, free, and
  // expired-paid-logically-free all pass; quotas are enforced downstream).
  // Operational tools never reach this branch.
  if (toolSlug === SPONSORSHIP_TOOL_SLUG) {
    const { resolveSponsorshipAccessLevel } = await import("@/server/services/sponsorship-limits");
    const level = await resolveSponsorshipAccessLevel(supabase, { userId: ctx.user.id, organizationId });
    if (level === "paid" || level === "free") {
      return { ...ctx, toolSlug, hasAccess: true as const };
    }
  }

  throw entitlementError(DENIAL_MESSAGE);
});

/** Get entitlements for an org — for UI (tool cards, billing) */
export async function getOrganizationEntitlements(organizationId: string) {
  await requireOrganizationMember(organizationId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tool_entitlements")
    .select("id, organization_id, tool_id, is_all_access, source, expires_at, tool:tools(id, slug, name)")
    .eq("organization_id", organizationId);

  if (error) throw error;
  return data;
}

/** Helper: resolve accessible tool slugs for org */
export async function getAccessibleToolSlugs(organizationId: string): Promise<string[]> {
  const entitlements = await getOrganizationEntitlements(organizationId);

  const hasAllAccess = entitlements.some((e) => e.is_all_access && (!e.expires_at || new Date(e.expires_at) > new Date()));
  if (hasAllAccess) {
    const supabase = await createClient();
    const { data: tools } = await supabase.from("tools").select("slug").eq("is_active", true);
    return (tools ?? []).map((t) => t.slug).filter((s): s is string => typeof s === "string" && COMMERCIALLY_AVAILABLE_SLUGS.has(s));
  }

  const slugs = entitlements
    .filter((e) => !e.is_all_access && (!e.expires_at || new Date(e.expires_at) > new Date()))
    .map((e) => (e.tool as unknown as { slug: string } | null)?.slug)
    .filter((s): s is string => s !== undefined && COMMERCIALLY_AVAILABLE_SLUGS.has(s));

  // User-scoped Sponsorship (RCCF-MULTI-SCOPE-IMPLEMENT-02): a member with a
  // valid user grant sees Sponsorship Tracking in every member organization.
  // Membership was verified inside getOrganizationEntitlements; the grant
  // alone never grants data. Sponsor-sentinel only — never operational tools.
  // Uses the single access-level resolver so expired-paid-logically-free
  // members are included exactly like the requireEntitlement gate.
  if (!slugs.includes(SPONSORSHIP_TOOL_SLUG)) {
    const supabase = await createClient();
    const { user } = await requireOrganizationMember(organizationId);
    const { resolveSponsorshipAccessLevel } = await import("@/server/services/sponsorship-limits");
    const level = await resolveSponsorshipAccessLevel(supabase, { userId: user.id, organizationId });
    if (level === "paid" || level === "free") slugs.push(SPONSORSHIP_TOOL_SLUG);
  }

  return slugs;
}
