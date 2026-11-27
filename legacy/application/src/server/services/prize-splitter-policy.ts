import type { SupabaseClient } from "@supabase/supabase-js";
import { findToolBySlug } from "@/server/repositories/tools";

/**
 * Prize Pool Splitter Free policy module.
 *
 * Owns only the Free grant issuance for the generic claim dispatch. Nothing
 * here meters usage — the tool is genuinely stateless (client-side
 * calculation, self-contained public shares, client-side CSV), so Free is
 * unlimited by construction: no quotas, ledgers, RPCs, history, templates,
 * or branding. Enforcement of paid-vs-Free lives in the existing
 * entitlement gate (`requireEntitlement`); this module only mints the
 * org-scoped Free grant that satisfies it.
 *
 * Never consults user grants (org scope only). Never creates orders,
 * payments, or billing records.
 */

export const PRIZE_SPLITTER_TOOL_SLUG = "prize-splitter";

/** Paid grant sources. Shared discriminator — never redefined elsewhere. */
export const PRIZE_SPLITTER_PAID_SOURCES: ReadonlySet<string> = new Set(["subscription", "manual", "promo"]);

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

interface OrgGrantRow {
  readonly id?: string;
  readonly is_all_access: boolean;
  readonly tool_id: string | null;
  readonly source: string;
  readonly expires_at: string | null;
}

/**
 * Idempotent Free issuance. Server-side callers only (service-role client):
 * RLS denies authenticated writes, so no user can self-grant.
 * - Unexpired per-tool grant (paid or Free) → return untouched (never downgrade).
 * - Unexpired paid coverage with no usable per-tool row (e.g. All Access) →
 *   return the paid row without minting a redundant Free grant.
 * - Otherwise → insert source='free', expires_at NULL (lifetime; Free is
 *   unlimited, so no quota enforces monetization downstream).
 * Never creates user-level grants, orders, or billing records.
 */
export async function ensureFreePrizeSplitterGrant(supabase: SupabaseClient, organizationId: string) {
  const tool = await findToolBySlug(supabase, PRIZE_SPLITTER_TOOL_SLUG);
  const toolId = tool?.id ?? null;
  if (!toolId) throw new Error("Prize Pool Splitter tool is not registered");
  const { data: existing, error } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId)
    .eq("is_all_access", false)
    .eq("tool_id", toolId)
    .maybeSingle();
  if (error) throw error;
  const row = existing as OrgGrantRow | null;
  if (row && isUnexpired(row.expires_at)) return row;
  const { data: covering, error: coveringError } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId);
  if (coveringError) throw coveringError;
  const paid = ((covering ?? []) as OrgGrantRow[]).find(
    (e) =>
      isUnexpired(e.expires_at) &&
      PRIZE_SPLITTER_PAID_SOURCES.has(e.source) &&
      (e.is_all_access || e.tool_id === toolId),
  );
  if (paid) return (row ?? paid) as OrgGrantRow;
  const { data, error: upsertError } = await supabase
    .from("tool_entitlements")
    .upsert(
      { organization_id: organizationId, tool_id: toolId, is_all_access: false, source: "free", expires_at: null },
      { onConflict: "organization_id,tool_id" },
    )
    .select("id, is_all_access, tool_id, source, expires_at")
    .single();
  if (upsertError) throw upsertError;
  return data as OrgGrantRow;
}
