import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementError, forbiddenError, validationError } from "@/lib/errors";
import { findToolBySlug } from "@/server/repositories/tools";
import { listPublishedPayoutTrackersSince } from "@/server/repositories/payout-trackers";
import { getOrganizationTimezone, isValidTimezoneIdentifier } from "@/server/services/organization-timezone";

/**
 * Prize Payout Tracker Free policy module.
 *
 * Owns every Payout-Tracker-only Free behavior the generic registry must not
 * know: org-scoped access levels (paid / free / none), idempotent Free
 * issuance, workspace-local monthly publish usage, recipient caps, the quota
 * error, and the consume_payout_tracker_publish SQLSTATE mapping.
 *
 * Nothing here generalizes: no universal quota, no cross-tool logic.
 * This module never consults user_tool_entitlements and never uses UTC months.
 */

export const PAYOUT_TRACKER_TOOL_SLUG = "payout-tracker";

/** 1 published tracker per workspace-local calendar month. Mirrors the RPC's `v_used >= 1` — change both together. */
export const FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH = 1;

/** Free history shows the latest 3 trackers. Older rows are retained, never deleted. */
export const FREE_PAYOUT_TRACKER_HISTORY_LIMIT = 3;

/** Free trackers hold at most 20 recipients; paid trackers at most 200. */
export const FREE_PAYOUT_TRACKER_RECIPIENTS_MAX = 20;
export const PAID_PAYOUT_TRACKER_RECIPIENTS_MAX = 200;

export type PayoutTrackerAccessLevel = "paid" | "free" | "none";

/** Paid grant sources. Exported so the RPC-adjacent checks share one discriminator — never redefined elsewhere. */
export const PAYOUT_TRACKER_PAID_SOURCES: ReadonlySet<string> = new Set(["subscription", "manual", "promo"]);

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

interface OrgGrantRow {
  readonly is_all_access: boolean;
  readonly tool_id: string | null;
  readonly source: string;
  readonly expires_at: string | null;
}

async function payoutTrackerToolId(supabase: SupabaseClient): Promise<string | null> {
  const tool = await findToolBySlug(supabase, PAYOUT_TRACKER_TOOL_SLUG);
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
 * Caller must establish membership first — this resolver decides the level,
 * never authorization.
 */
export async function resolvePayoutTrackerAccessLevel(
  supabase: SupabaseClient,
  input: { organizationId: string },
): Promise<PayoutTrackerAccessLevel> {
  try {
    const toolId = await payoutTrackerToolId(supabase);
    if (!toolId) return "none";
    const grants = await listOrgGrants(supabase, input.organizationId);
    const covers = (e: OrgGrantRow) => e.is_all_access || e.tool_id === toolId;
    if (grants.some((e) => covers(e) && PAYOUT_TRACKER_PAID_SOURCES.has(e.source))) return "paid";
    if (grants.some((e) => covers(e) && e.source === "free")) return "free";
    return "none";
  } catch {
    return "none";
  }
}

/** True when the org holds an unexpired paid Payout Tracker / All Access grant. */
export async function hasPaidPayoutTrackerGrant(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  return (await resolvePayoutTrackerAccessLevel(supabase, { organizationId })) === "paid";
}

/** Recipient cap for an access level (paid 200, free/none 20). */
export function recipientsMaxForLevel(level: PayoutTrackerAccessLevel): number {
  return level === "paid" ? PAID_PAYOUT_TRACKER_RECIPIENTS_MAX : FREE_PAYOUT_TRACKER_RECIPIENTS_MAX;
}

/**
 * Idempotent Free issuance. Server-side callers only (service-role client):
 * RLS denies authenticated writes, so no user can self-grant.
 */
export async function ensureFreePayoutTrackerGrant(supabase: SupabaseClient, organizationId: string) {
  const toolId = await payoutTrackerToolId(supabase);
  if (!toolId) throw new Error("Prize Payout Tracker tool is not registered");
  const { data: existing, error } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, tool_id, source, expires_at")
    .eq("organization_id", organizationId)
    .eq("is_all_access", false)
    .eq("tool_id", toolId)
    .maybeSingle();
  if (error) throw error;
  const row = existing as (OrgGrantRow & { id?: string }) | null;
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

/** Pure workspace-month key: "YYYY-MM" in the organization's IANA timezone. DST-safe. */
export function getPayoutWorkspaceMonthKey(date: Date, timezone: string): string {
  if (!isValidTimezoneIdentifier(timezone)) {
    throw validationError("Workspace timezone is not configured correctly.");
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).format(date);
}

/** Customer-facing month name in the workspace timezone ("November"). */
export function getPayoutWorkspaceMonthLabel(date: Date, timezone: string): string {
  if (!isValidTimezoneIdentifier(timezone)) {
    throw validationError("Workspace timezone is not configured correctly.");
  }
  return new Intl.DateTimeFormat("en", { timeZone: timezone, month: "long" }).format(date);
}

export interface PayoutTrackerFreeUsage {
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly monthKey: string;
  readonly monthLabel: string;
}

/**
 * Server-derived Free usage for display. Counts published trackers whose
 * publish timestamp falls in the current workspace-local month. Advisory
 * only — the publish RPC recounts atomically.
 */
export async function getPayoutTrackerFreeUsage(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date = new Date(),
): Promise<PayoutTrackerFreeUsage> {
  const timezone = await getOrganizationTimezone(supabase, organizationId);
  const monthKey = getPayoutWorkspaceMonthKey(now, timezone);
  const monthLabel = getPayoutWorkspaceMonthLabel(now, timezone);
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 2 * 86400000).toISOString();
  const rows = await listPublishedPayoutTrackersSince(supabase, organizationId, windowStart);
  const used = rows.filter((r) => r.published_at !== null && getPayoutWorkspaceMonthKey(new Date(r.published_at), timezone) === monthKey).length;
  return {
    used,
    limit: FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH,
    remaining: Math.max(0, FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH - used),
    monthKey,
    monthLabel,
  };
}

// ── Quota error + RPC mapping ──

export const PAYOUT_TRACKER_QUOTA_MESSAGE =
  "You've used your free published tracker for this month. Upgrade to publish more payout trackers.";

export type PayoutTrackerQuotaKind = "publishes";

export function payoutTrackerQuotaError() {
  return validationError(PAYOUT_TRACKER_QUOTA_MESSAGE, { payoutTrackerQuota: "publishes" satisfies PayoutTrackerQuotaKind });
}

export function isPayoutTrackerQuotaError(e: unknown): boolean {
  const details = (e as { details?: unknown })?.details as { payoutTrackerQuota?: unknown } | undefined;
  return details?.payoutTrackerQuota === "publishes";
}

const PAYOUT_TRACKER_DENIAL_MESSAGE =
  "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.";

/**
 * Defense-in-depth service-layer gate (F5). Service functions that resolve
 * an access level must reject "none" themselves so a future caller that
 * accidentally skips the action-layer requireEntitlement still fails closed.
 * Paid/free semantics are unchanged; this never grants anything.
 */
export function assertPayoutTrackerCovered(level: PayoutTrackerAccessLevel): void {
  if (level === "none") throw entitlementError(PAYOUT_TRACKER_DENIAL_MESSAGE);
}

/** Map consume_payout_tracker_publish SQLSTATEs onto the existing domain errors. */
export function mapConsumePayoutPublishError(error: unknown): Error {
  const code = (error as { code?: unknown })?.code;
  const rawMessage = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  const message = typeof rawMessage === "string" ? rawMessage : String(error ?? "");
  if (code === "PTPQ1" || message.includes("quota_exceeded")) return payoutTrackerQuotaError();
  if (code === "PTPN1" || message.includes("no_access")) {
    if (message.includes("not a member")) return forbiddenError("You don't have access to this workspace.");
    return entitlementError(PAYOUT_TRACKER_DENIAL_MESSAGE);
  }
  if (code === "PTPD1" || message.includes("invalid:")) {
    if (message.includes("recipient")) return validationError("Add at least one recipient before publishing.");
    return validationError("This tracker cannot be published right now.");
  }
  if (error instanceof Error) return error;
  return new Error(message || "Publish failed");
}

/** Map create_payout_recipient SQLSTATEs onto the existing domain errors. */
export function mapCreatePayoutRecipientError(error: unknown, level: PayoutTrackerAccessLevel): Error {
  const code = (error as { code?: unknown })?.code;
  const rawMessage = error instanceof Error ? error.message : (error as { message?: unknown })?.message;
  const message = typeof rawMessage === "string" ? rawMessage : String(error ?? "");
  if (message.includes("recipient_limit")) {
    return validationError(
      level === "paid"
        ? "A tracker holds at most 200 recipients."
        : "Free trackers hold at most 20 recipients. Upgrade for up to 200.",
    );
  }
  if (code === "PTPN1" || message.includes("no_access")) {
    if (message.includes("not a member")) return forbiddenError("You don't have access to this workspace.");
    return entitlementError(PAYOUT_TRACKER_DENIAL_MESSAGE);
  }
  if (code === "PTPD1" || message.includes("invalid:")) {
    return validationError("This recipient cannot be added right now.");
  }
  if (error instanceof Error) return error;
  return new Error(message || "Add recipient failed");
}
