import type { SupabaseClient } from "@supabase/supabase-js";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/user-sponsorship-service";
import { PAID_SOURCES } from "@/server/services/sponsorship-limits";
import { findUserGrant } from "@/server/repositories/user-entitlements";
import type { EntitlementSource } from "@/types/database";

/**
 * Service: organization-level Sponsorship coverage for background paths.
 *
 * Browser paths authorize via requireEntitlement (authenticated user +
 * membership + org-grant-or-own-user-grant). Background jobs (scan cron,
 * webhook pipeline, post-response scan scheduling) run with no browser user,
 * so they resolve coverage from organization context instead:
 *
 *   1. Legacy organization grant (per-tool sponsor-sentinel, all-access,
 *      or purchase-provisioned rows) — dual-read transition.
 *   2. Any OWNER's user-level Sponsorship grant — the Phase-3 model:
 *      an org whose owner is commercially entitled is covered for
 *      background processing. Valid grants cover at paid/free level; an
 *      expired paid grant still covers at free level (logical expiry → free
 *      fallback — quotas are enforced downstream, never unlimited here).
 *   3. Optionally, a specific CALLER's user-level grant (browser-invoked
 *      service functions re-verifying after the action gate), with the same
 *      expired-paid → free coverage.
 *
 * This never grants DATA access by itself: every caller still scopes all
 * data reads/writes by organization_id under RLS, exactly as before.
 * It answers only "is this org covered for Sponsorship processing".
 *
 * Operational tools and All Access never consult this service.
 */
export async function hasSponsorshipAccessForOrg(
  supabase: SupabaseClient,
  organizationId: string,
  userId?: string
): Promise<boolean> {
  // 1. Organization grant (legacy grandfathered rows, all-access, purchases).
  if (await hasOrganizationSponsorshipGrant(supabase, organizationId)) return true;

  try {
    // 2. Owner user-grant (Phase-3 model), including expired-paid → free.
    if (await hasOwnerUserSponsorshipGrant(supabase, organizationId)) return true;

    // 3. Caller user-grant (browser service re-checks; membership was
    // already enforced by the action gate — this is coverage only).
    // Expired paid grants cover at free level (quotas enforced downstream).
    if (userId && (await hasCallerSponsorshipCoverage(supabase, userId))) return true;
  } catch {
    // Missing user-grant table (Phase-2 migration not applied) and other
    // user-leg failures fail closed to false — never crash background jobs.
    return false;
  }

  return false;
}

/**
 * Caller coverage with the single level rule: any grant row (valid paid,
 * valid free, or expired paid) covers at its level. No grant, or an
 * expired/unknown-source row that is not paid, covers nothing. Uses the raw
 * grant (not the unexpired-only helper) so expired-paid callers keep free
 * coverage instead of losing background processing.
 */
async function hasCallerSponsorshipCoverage(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", SPONSORSHIP_TOOL_SLUG).single();
  if (!tool) return false;
  const grant = await findUserGrant(supabase, userId, (tool as { id: string }).id);
  if (!grant) return false;
  if (grant.expires_at === null || new Date(grant.expires_at) > new Date()) return true;
  return PAID_SOURCES.has(grant.source as EntitlementSource);
}

async function hasOrganizationSponsorshipGrant(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  // Prefer RPC if available (same semantics as browser hasOrganizationGrant).
  // IMPORTANT: an RPC `false` must NOT short-circuit — it only means "no
  // org row", and the owner/caller user-grant legs still apply below.
  try {
    const { data, error } = await supabase.rpc("has_tool_access", {
      org_id: organizationId,
      tool_slug: SPONSORSHIP_TOOL_SLUG,
    });
    if (!error && data === true) return true;
  } catch {
    // fall through to direct query
  }

  try {
    const { data: tool } = await supabase.from("tools").select("id").eq("slug", SPONSORSHIP_TOOL_SLUG).single();
    if (!tool) return false;
    const { data: entitlements } = await supabase
      .from("tool_entitlements")
      .select("is_all_access, tool_id, expires_at")
      .eq("organization_id", organizationId);
    if (!entitlements) return false;
    const toolId = (tool as { id: string }).id;
    return (entitlements as Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>).some(
      (e) => {
        if (e.expires_at !== null && new Date(e.expires_at) <= new Date()) return false;
        if (e.is_all_access) return true;
        return e.tool_id === toolId;
      }
    );
  } catch {
    return false;
  }
}

/**
 * Any owner (organizations.owner_id or role='owner' member) holding a
 * Sponsorship grant covers the org for background processing. Valid grants
 * cover at their level; an expired paid grant still covers at free level
 * (logical expiry → free fallback — downstream quota asserts apply free
 * limits). Ordinary members are never consulted.
 */
async function hasOwnerUserSponsorshipGrant(
  supabase: SupabaseClient,
  organizationId: string
): Promise<boolean> {
  const { data: org } = await supabase.from("organizations").select("owner_id").eq("id", organizationId).single();
  const { data: ownerMembers } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner");

  const ownerIds = new Set<string>();
  const directOwner = (org as { owner_id: string } | null)?.owner_id;
  if (typeof directOwner === "string" && directOwner.length > 0) ownerIds.add(directOwner);
  for (const m of (ownerMembers as Array<{ user_id: string }> | null) ?? []) {
    if (typeof m?.user_id === "string" && m.user_id.length > 0) ownerIds.add(m.user_id);
  }
  if (ownerIds.size === 0) return false;

  const { data: tool } = await supabase.from("tools").select("id").eq("slug", SPONSORSHIP_TOOL_SLUG).single();
  if (!tool) return false;

  const { data: grants, error } = await supabase
    .from("user_tool_entitlements")
    .select("source, expires_at")
    .in("user_id", [...ownerIds])
    .eq("tool_id", (tool as { id: string }).id);
  if (error || !grants) return false;

  const now = new Date();
  return (grants as Array<{ source: string; expires_at: string | null }>).some((g) => {
    if (g.expires_at === null || new Date(g.expires_at) > now) return true;
    // Expired paid owner grants still cover at free level (quotas enforced
    // downstream by the scan/campaign/channel guards).
    return PAID_SOURCES.has(g.source as EntitlementSource);
  });
}
