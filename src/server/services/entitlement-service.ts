import type { SupabaseClient } from "@supabase/supabase-js";
import { hasEntitlement, listEntitlementsForOrg } from "@/server/repositories/entitlements";
import { listActiveTools } from "@/server/repositories/tools";
import { TOOLS } from "@/config/app/tools";

/**
 * Service: entitlement resolution logic
 * Pure business logic — no direct auth, no rendering.
 *
 * Availability rule (RCCF-SPONSOR-FINAL-02):
 * DB active state determines whether a tool is operationally active;
 * the tool registry's comingSoon flag determines whether it is
 * commercially available. All-Access (and per-tool resolution) must
 * never surface a Coming-Soon tool, even if the DB still marks it active.
 */

const COMMERCIALLY_AVAILABLE_SLUGS: ReadonlySet<string> = new Set(
  TOOLS.filter((t) => !t.comingSoon).map((t) => t.slug)
);

export interface EntitlementResolution {
  organizationId: string;
  hasAllAccess: boolean;
  entitledToolSlugs: string[];
  entitlements: Awaited<ReturnType<typeof listEntitlementsForOrg>>;
}

export async function resolveEntitlements(
  supabase: SupabaseClient,
  organizationId: string
): Promise<EntitlementResolution> {
  const [entitlements, tools] = await Promise.all([
    listEntitlementsForOrg(supabase, organizationId),
    listActiveTools(supabase),
  ]);

  const now = new Date();
  const hasAllAccess = entitlements.some(
    (e) => e.is_all_access && (!e.expires_at || new Date(e.expires_at) > now)
  );

  if (hasAllAccess) {
    return {
      organizationId,
      hasAllAccess: true,
      entitledToolSlugs: tools.map((t) => t.slug).filter((s) => COMMERCIALLY_AVAILABLE_SLUGS.has(s)),
      entitlements,
    };
  }

  const entitledIds = new Set(
    entitlements
      .filter((e): e is typeof e & { tool_id: string } => !e.is_all_access && (!e.expires_at || new Date(e.expires_at) > now) && typeof e.tool_id === "string")
      .map((e) => e.tool_id)
  );

  const toolMap = new Map(tools.map((t) => [t.id, t.slug]));
  const entitledToolSlugs = [...entitledIds].map((id) => toolMap.get(id)).filter((s): s is string => s !== undefined && COMMERCIALLY_AVAILABLE_SLUGS.has(s));

  return { organizationId, hasAllAccess: false, entitledToolSlugs, entitlements };
}

export async function canAccessTool(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<boolean> {
  return hasEntitlement(supabase, organizationId, toolSlug);
}
