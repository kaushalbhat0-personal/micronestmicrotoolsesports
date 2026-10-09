import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementError, forbiddenError, validationError } from "@/lib/errors";
import { findToolBySlug } from "@/server/repositories/tools";
import { listLockedTieBreakerCompetitionsSince } from "@/server/repositories/tie-breaker-competitions";
import { getOrganizationTimezone, isValidTimezoneIdentifier } from "@/server/services/organization-timezone";

/**
 * Tie-Breaker Free policy module (RCCF-FREEMIUM-TIEBREAKER-IMPLEMENT-07).
 *
 * Owns every Tie-Breaker-only Free behavior the generic registry must not
 * know: org-scoped access levels (paid / free / none), idempotent Free
 * issuance, workspace-local monthly usage, the quota error, and the
 * consume_tie_breaker_lock SQLSTATE mapping.
 *
 * Nothing here generalizes: no universal quota, no cross-tool logic.
 * Sponsorship semantics (user grants, UTC month) are untouched — this module
 * never consults user_tool_entitlements and never uses UTC months.
 */

export const TIE_BREAKER_TOOL_SLUG = "tie-breaker";

/** 3 locked official records per workspace-local calendar month. Mirrors the RPC's `v_used >= 3` — change both together. */
export const FREE_TIE_BREAKER_LOCKS_PER_MONTH = 3;

/** Free history shows the latest 3 locked official records. Older rows are retained, never deleted. */
export const FREE_TIE_BREAKER_HISTORY_LIMIT = 3;

export type TieBreakerAccessLevel = "paid" | "free" | "none";

/** Paid grant sources. Exported so the RPC-adjacent checks share one discriminator — never redefined elsewhere. */
export const TIE_BREAKER_PAID_SOURCES: ReadonlySet<string> = new Set(["subscription", "manual", "promo"]);

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

interface OrgGrantRow {
  readonly is_all_access: boolean;
  readonly tool_id: string | null;
  readonly source: string;
  readonly expires_at: string | null;
}

async function tieBreakerToolId(supabase: SupabaseClient): Promise<string | null> {
  const tool = await findToolBySlug(supabase, TIE_BREAKER_TOOL_SLUG);
  return tool?.id ?? null;
}

async function listOrgGrants(supabase: SupabaseClient, organizationId: string): Promise<OrgGrantRow[]> {
  const { data, error } = await supabase
    .from("tool_entitlements")
    .select("is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return ((data ?? []) as OrgGrantRow[]).filter((e) => isUnexpired(e.expires_at));
}

/**
 * Resolve paid | free | none for an organization.
 * Caller must establish membership first (page gates, claim dispatch, and
 * the lock RPC all verify membership independently — this resolver decides
 * the level, never authorization).
 * 1. unexpired paid-source grant (per-tool or All Access) → paid
 * 2. unexpired source='free' grant (per-tool or All Access) → free
 * 3. otherwise none (expired paid without a Free grant must claim Free)
 */
export async function resolveTieBreakerAccessLevel(
  supabase: SupabaseClient,
  input: { organizationId: string },
): Promise<TieBreakerAccessLevel> {
  try {
    const toolId = await tieBreakerToolId(supabase);
    if (!toolId) return "none";
    const grants = await listOrgGrants(supabase, input.organizationId);
    const covers = (e: OrgGrantRow) => e.is_all_access || e.tool_id === toolId;
    if (grants.some((e) => covers(e) && TIE_BREAKER_PAID_SOURCES.has(e.source))) return "paid";
    if (grants.some((e) => covers(e) && e.source === "free")) return "free";
    return "none";
  } catch {
    return "none";
  }
}

/** True when the org holds an unexpired paid Tie-Breaker / All Access grant. */
export async function hasPaidTieBreakerGrant(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  return (await resolveTieBreakerAccessLevel(supabase, { organizationId })) === "paid";
}

/**
 * Idempotent Free issuance. Server-side callers only (service-role client):
 * RLS denies authenticated writes, so no user can self-grant.
 * - Unexpired paid grant → return untouched (never downgrade).
 * - Unexpired Free grant → return untouched (idempotent retry).
 * - Otherwise → insert source='free', expires_at NULL (lifetime; the monthly
 *   quota enforces monetization, not expiry).
 */
export async function ensureFreeTieBreakerGrant(supabase: SupabaseClient, organizationId: string) {
  const toolId = await tieBreakerToolId(supabase);
  if (!toolId) throw new Error("Tie-Breaker Resolver tool is not registered");
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

// ── Workspace-local month (display/usage only; the RPC is authoritative) ──

/**
 * Pure workspace-month key: "YYYY-MM" in the organization's IANA timezone.
 * DST-safe (no fixed offsets). Used for usage display and tests; quota
 * enforcement uses the equivalent timestamptz math inside the RPC.
 */
export function getWorkspaceMonthKey(date: Date, timezone: string): string {
  if (!isValidTimezoneIdentifier(timezone)) {
    throw validationError("Workspace timezone is not configured correctly.");
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).format(date);
}

/** Customer-facing month name in the workspace timezone ("November"). */
export function getWorkspaceMonthLabel(date: Date, timezone: string): string {
  if (!isValidTimezoneIdentifier(timezone)) {
    throw validationError("Workspace timezone is not configured correctly.");
  }
  return new Intl.DateTimeFormat("en", { timeZone: timezone, month: "long" }).format(date);
}

export interface TieBreakerFreeUsage {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly monthKey: string;
  readonly monthLabel: string;
}

/**
 * Server-derived Free usage for display (usage lines, review page).
 * Counts locked official records whose lock timestamp falls in the current
 * workspace-local month. Advisory only — the lock RPC recounts atomically.
 */
export async function getTieBreakerFreeUsage(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date = new Date(),
): Promise<TieBreakerFreeUsage> {
  const timezone = await getOrganizationTimezone(supabase, organizationId);
  const monthKey = getWorkspaceMonthKey(now, timezone);
  const monthLabel = getWorkspaceMonthLabel(now, timezone);
  // Pad the scan window: the widest IANA offset is ±14h, so locked rows up
  // to 2 days before the UTC month start may still belong to this workspace
  // month. Filtering below is exact; the window is only a prefilter.
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 2 * 86400000).toISOString();
  const rows = await listLockedTieBreakerCompetitionsSince(supabase, organizationId, windowStart);
  const used = rows.filter((r) => r.locked_at !== null && getWorkspaceMonthKey(new Date(r.locked_at), timezone) === monthKey).length;
  return {
    used,
    limit: FREE_TIE_BREAKER_LOCKS_PER_MONTH,
    remaining: Math.max(0, FREE_TIE_BREAKER_LOCKS_PER_MONTH - used),
    monthKey,
    monthLabel,
  };
}

// ── Quota error + RPC mapping ──

export const TIE_BREAKER_QUOTA_MESSAGE =
  "You've used all 3 free Tie-Breaker records for this month. Upgrade to keep settling competitions.";

export type TieBreakerQuotaKind = "locks";

export function tieBreakerQuotaError() {
  return validationError(TIE_BREAKER_QUOTA_MESSAGE, { tieBreakerQuota: "locks" satisfies TieBreakerQuotaKind });
}

export function isTieBreakerQuotaError(e: unknown): boolean {
  const details = (e as { details?: unknown })?.details as { tieBreakerQuota?: unknown } | undefined;
  return details?.tieBreakerQuota === "locks";
}

const TIE_BREAKER_DENIAL_MESSAGE =
  "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.";

/** Map consume_tie_breaker_lock SQLSTATEs onto the existing domain errors. */
export function mapConsumeTieBreakerLockError(error: unknown): Error {
  const code = (error as { code?: unknown })?.code;
  const rawMessage = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  const message = typeof rawMessage === "string" ? rawMessage : String(error ?? "");
  if (code === "TBF01" || message.includes("quota_exceeded")) return tieBreakerQuotaError();
  if (code === "TBN01" || message.includes("no_access")) {
    if (message.includes("not a member")) return forbiddenError("You don't have access to this workspace.");
    return entitlementError(TIE_BREAKER_DENIAL_MESSAGE);
  }
  if (code === "TBD01" || message.includes("invalid:")) {
    if (message.includes("active")) return validationError("This competition cannot be locked right now.");
    return validationError("Something went wrong. Please try again.");
  }
  if (error instanceof Error) return error;
  return new Error(message || "Lock failed");
}
