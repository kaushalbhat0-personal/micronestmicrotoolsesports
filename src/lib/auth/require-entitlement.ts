import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { entitlementError } from "@/lib/errors";
import { requireOrganizationMember } from "./require-membership";
import { TOOLS } from "@/config/app/tools";

/**
 * Entitlement authorization — separate from membership.
 * Checks: does organization have access to toolSlug (per-tool OR all-access)?
 *
 * Uses DB helper has_tool_access() where possible, plus app-level resolution for richer errors.
 *
 * Availability rule (RCCF-SPONSOR-FINAL-02): the registry's comingSoon flag
 * is commercially authoritative. Unreleased tools are never granted, even
 * when the RPC/fallback path is used.
 */

const COMMERCIALLY_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(
  TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug)
);

export const requireEntitlement = cache(async (organizationId: string, toolSlug: string) => {
  // Ensure membership first — entitlement without membership is meaningless (deduped via cached member)
  const ctx = await requireOrganizationMember(organizationId);

  // Coming-Soon tools are never commercially available, regardless of DB/RPC state.
  // Customer-safe message: no tool slugs, no internal access-system wording.
  if (!COMMERCIALLY_AVAILABLE_SLUGS.has(toolSlug)) {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }

  const supabase = await createClient();

  // Prefer RPC if available, fallback to query
  const { data: hasAccess, error: rpcError } = await supabase.rpc("has_tool_access", {
    org_id: organizationId,
    tool_slug: toolSlug,
  });

  // If RPC exists and returns boolean, use it
  if (!rpcError && typeof hasAccess === "boolean") {
    if (!hasAccess) throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
    return { ...ctx, toolSlug, hasAccess: true as const };
  }

  // Fallback — manual entitlement resolution
  const { data: tool } = await supabase.from("tools").select("id, slug, is_active").eq("slug", toolSlug).single();

  if (!tool) throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  if (tool.is_active === false) throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");

  const { data: entitlements } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, expires_at")
    .eq("organization_id", organizationId)
    .or(`is_all_access.eq.true,tool_id.eq.${tool.id}`);

  const valid = (entitlements ?? []).some((e) => !e.expires_at || new Date(e.expires_at) > new Date());

  if (!valid) throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");

  return { ...ctx, toolSlug, hasAccess: true as const };
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

  return entitlements
    .filter((e) => !e.is_all_access && (!e.expires_at || new Date(e.expires_at) > new Date()))
    .map((e) => (e.tool as unknown as { slug: string } | null)?.slug)
    .filter((s): s is string => s !== undefined && COMMERCIALLY_AVAILABLE_SLUGS.has(s));
}
