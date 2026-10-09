import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, entitlementError, forbiddenError, validationError } from "@/lib/errors";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/user-sponsorship-service";
import { findUserGrant } from "@/server/repositories/user-entitlements";
import { listSponsorCampaignsByOrg } from "@/server/repositories/sponsor-campaigns";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { listScansByOrg, tryCreateScanWithLock, SCAN_ALREADY_RUNNING_CODE } from "@/server/repositories/scans";
import type { EntitlementSource, Scan } from "@/types/database";

/**
 * Central Sponsorship free-tier limit resolution (RCCF free-tier IMPLEMENT-03).
 *
 * Single source of truth for free vs paid vs none + all free quotas.
 * Quotas are GLOBAL per user across all member organizations.
 * No counter table in V1 — live counts over authoritative rows.
 *
 * Paid sources ('subscription' | 'manual' | 'promo') are NEVER reclassified
 * as free. The discriminator is the literal `source` value plus org-grant
 * presence — never a generic "has user grant" check.
 */

export const FREE_CAMPAIGN_ACTIVE_LIMIT = 1;
export const FREE_DRAFT_LIMIT = 1;
export const FREE_CHANNEL_CONNECTED_LIMIT = 1;
export const FREE_MONTHLY_CHECK_LIMIT = 10;
export const FREE_HISTORY_WINDOW_DAYS = 7;

export type SponsorshipAccessLevel = "free" | "paid" | "none";

export interface SponsorshipLimits {
  level: SponsorshipAccessLevel;
  campaignActiveLimit: number | null;
  draftLimit: number | null;
  channelConnectedLimit: number | null;
  monthlyCheckLimit: number | null;
  historyWindowDays: number | null;
  exportAllowed: boolean;
}

/** Paid grant sources. Exported so gates/billing share the single discriminator — never redefined elsewhere. */
export const PAID_SOURCES: ReadonlySet<EntitlementSource> = new Set(["subscription", "manual", "promo"]);

function isUnexpired(expiresAt: string | null, now: Date = new Date()): boolean {
  return expiresAt === null || new Date(expiresAt) > now;
}

export function freeLimits(): SponsorshipLimits {
  return {
    level: "free",
    campaignActiveLimit: FREE_CAMPAIGN_ACTIVE_LIMIT,
    draftLimit: FREE_DRAFT_LIMIT,
    channelConnectedLimit: FREE_CHANNEL_CONNECTED_LIMIT,
    monthlyCheckLimit: FREE_MONTHLY_CHECK_LIMIT,
    historyWindowDays: FREE_HISTORY_WINDOW_DAYS,
    exportAllowed: false,
  };
}

export function paidLimits(): SponsorshipLimits {
  return {
    level: "paid",
    campaignActiveLimit: null,
    draftLimit: null,
    channelConnectedLimit: null,
    monthlyCheckLimit: null,
    historyWindowDays: null,
    exportAllowed: true,
  };
}

async function sponsorshipToolId(supabase: SupabaseClient): Promise<string | null> {
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", SPONSORSHIP_TOOL_SLUG).single();
  return (tool as { id: string } | null)?.id ?? null;
}

async function hasUnexpiredOrgSponsorshipGrant(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
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
    const toolId = await sponsorshipToolId(supabase);
    if (!toolId) return false;
    const { data: entitlements } = await supabase
      .from("tool_entitlements")
      .select("is_all_access, tool_id, expires_at")
      .eq("organization_id", organizationId);
    if (!entitlements) return false;
    return (entitlements as Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>).some(
      (e) => {
        if (!isUnexpired(e.expires_at)) return false;
        if (e.is_all_access) return true;
        return e.tool_id === toolId;
      },
    );
  } catch {
    return false;
  }
}

export async function isOrgMember(supabase: SupabaseClient, organizationId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve free | paid | none for a user in an organization.
 * 1. membership first (no membership → none)
 * 2. active All Access / org Sponsorship grant → paid
 * 3. active user grant with source != 'free' → paid
 * 4. active user grant with source == 'free' → free
 * 5. otherwise none
 */
export async function resolveSponsorshipAccessLevel(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string },
): Promise<SponsorshipAccessLevel> {
  if (!(await isOrgMember(supabase, input.organizationId, input.userId))) return "none";
  if (await hasUnexpiredOrgSponsorshipGrant(supabase, input.organizationId)) return "paid";
  try {
    const toolId = await sponsorshipToolId(supabase);
    if (!toolId) return "none";
    const grant = await findUserGrant(supabase, input.userId, toolId);
    if (!grant || !isUnexpired(grant.expires_at)) {
      // Revert-to-free: an EXPIRED paid user grant still proves the user was
      // a customer — they fall back to free quotas instead of losing access.
      // (Org-only expired buyers without a user row claim free explicitly via
      // the claim action.) Paid sources are still never treated as paid here.
      if (grant && PAID_SOURCES.has(grant.source as EntitlementSource)) return "free";
      return "none";
    }
    if ((grant.source as EntitlementSource) === "free") return "free";
    if (PAID_SOURCES.has(grant.source as EntitlementSource)) return "paid";
    return "none";
  } catch {
    return "none";
  }
}

/**
 * Central limits for a user in an organization.
 * Paid → unlimited. Free/none → free quotas (none is still denied at the
 * requireEntitlement gate; quotas alone never grant access).
 */
export async function resolveSponsorshipLimits(
  supabase: SupabaseClient,
  input: { userId: string; organizationId?: string },
): Promise<SponsorshipLimits> {
  if (input.organizationId) {
    const level = await resolveSponsorshipAccessLevel(supabase, {
      userId: input.userId,
      organizationId: input.organizationId,
    });
    if (level === "paid") return paidLimits();
    if (level === "free") return freeLimits();
    return { ...freeLimits(), level: "none" };
  }
  try {
    const toolId = await sponsorshipToolId(supabase);
    if (toolId) {
      const grant = await findUserGrant(supabase, input.userId, toolId);
      // Parity with the organization branch: an expired paid grant falls back
      // to free quotas instead of losing access. Paid sources are still never
      // treated as paid here.
      if (!grant || !isUnexpired(grant.expires_at)) {
        if (grant && PAID_SOURCES.has(grant.source as EntitlementSource)) return freeLimits();
        return { ...freeLimits(), level: "none" };
      }
      if ((grant.source as EntitlementSource) === "free") return freeLimits();
      if (PAID_SOURCES.has(grant.source as EntitlementSource)) return paidLimits();
    }
  } catch {
    // fall through to no-access limits
  }
  return { ...freeLimits(), level: "none" };
}

/** All organization ids where the user is currently a member. */
export async function listMemberOrganizationIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("organization_members").select("organization_id").eq("user_id", userId);
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ organization_id: string }>)
    .map((r) => r.organization_id)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  return [...new Set(ids)];
}

/** Start of the current UTC calendar month (no per-user reset state). */
export function currentMonthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export interface FreeUsage {
  orgIds: string[];
  activeCampaigns: number;
  drafts: number;
  connectedChannels: number;
  checksUsedThisMonth: number;
  checksRemainingThisMonth: number;
  monthStartIso: string;
}

/**
 * Live global usage for a free user. Counts authoritative rows across all
 * current member orgs. Scans in org-paid (All Access / org-grant) workspaces
 * are excluded from the free budget (recommended behavior); if the coverage
 * lookup fails we fall back to counting everything (conservative).
 */
export async function getFreeUsage(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<FreeUsage> {
  const orgIds = await listMemberOrganizationIds(supabase, userId);
  const monthStartIso = currentMonthStartIso(now);
  let activeCampaigns = 0;
  let drafts = 0;
  let connectedChannels = 0;
  let checksUsedThisMonth = 0;

  // Resolve org-paid coverage once per org (best effort).
  const orgPaid = new Map<string, boolean>();
  for (const orgId of orgIds) {
    try {
      orgPaid.set(orgId, await hasUnexpiredOrgSponsorshipGrant(supabase, orgId));
    } catch {
      orgPaid.set(orgId, false);
    }
  }

  for (const orgId of orgIds) {
    const [campaigns, channels, scans] = await Promise.all([
      listSponsorCampaignsByOrg(supabase, orgId).catch(() => []),
      listConnectedChannelsByOrg(supabase, orgId).catch(() => []),
      orgPaid.get(orgId) ? Promise.resolve([]) : listScansByOrg(supabase, orgId).catch(() => []),
    ]);
    for (const c of campaigns) {
      if (c.status === "active") activeCampaigns += 1;
      else if (c.status === "draft") drafts += 1;
    }
    for (const ch of channels) {
      if (ch.connection_status === "connected") connectedChannels += 1;
    }
    for (const s of scans) {
      const startedAt = s.started_at ?? s.created_at;
      if (typeof startedAt === "string" && startedAt >= monthStartIso) checksUsedThisMonth += 1;
    }
  }

  return {
    orgIds,
    activeCampaigns,
    drafts,
    connectedChannels,
    checksUsedThisMonth,
    checksRemainingThisMonth: Math.max(0, FREE_MONTHLY_CHECK_LIMIT - checksUsedThisMonth),
    monthStartIso,
  };
}

/** Deterministic free-covered channel: oldest connected created_at, then id. */
export async function getFreeCoveredChannelId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const orgIds = await listMemberOrganizationIds(supabase, userId);
  const connected: Array<{ id: string; created_at: string }> = [];
  for (const orgId of orgIds) {
    const channels = await listConnectedChannelsByOrg(supabase, orgId).catch(() => []);
    for (const ch of channels) {
      const row = ch as unknown as { id: string; created_at?: string; connection_status: string };
      if (row.connection_status !== "connected" || typeof row.id !== "string") continue;
      connected.push({ id: row.id, created_at: typeof row.created_at === "string" ? row.created_at : "" });
    }
  }
  if (connected.length === 0) return null;
  connected.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  return connected[0]?.id ?? null;
}

/** Deterministic free-covered campaign: oldest active created_at, then id. */
export async function getFreeCoveredCampaignId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const orgIds = await listMemberOrganizationIds(supabase, userId);
  const actives: Array<{ id: string; created_at: string }> = [];
  for (const orgId of orgIds) {
    const campaigns = await listSponsorCampaignsByOrg(supabase, orgId).catch(() => []);
    for (const c of campaigns) {
      if (c.status !== "active") continue;
      actives.push({ id: c.id, created_at: c.created_at });
    }
  }
  if (actives.length === 0) return null;
  actives.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1));
  return actives[0]?.id ?? null;
}

export function historyCutoffIso(windowDays: number, now: Date = new Date()): string {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();
}

// ── Quota guards (paid → no-op; free → count + throw customer-safe errors) ──

export type FreeQuotaKind = "campaign" | "channel" | "checks" | "covered";

/** Quota errors carry a machine-readable kind so cron/webhooks can skip quietly. */
export function freeQuotaError(kind: FreeQuotaKind, message: string) {
  return validationError(message, { freeQuota: kind });
}

export function isFreeQuotaError(e: unknown): FreeQuotaKind | null {
  const details = (e as { details?: unknown })?.details as { freeQuota?: unknown } | undefined;
  const kind = details?.freeQuota;
  return kind === "campaign" || kind === "channel" || kind === "checks" || kind === "covered" ? kind : null;
}

export async function assertFreeCampaignCreateAllowed(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string },
): Promise<void> {
  const limits = await resolveSponsorshipLimits(supabase, input);
  if (limits.level === "paid") return;
  if (limits.level === "none") {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }
  const usage = await getFreeUsage(supabase, input.userId);
  if (usage.drafts >= (limits.draftLimit ?? FREE_DRAFT_LIMIT)) {
    throw freeQuotaError("campaign", "You already have a free draft. Activate, delete, or upgrade to manage more.");
  }
}

export async function assertFreeCampaignActivateAllowed(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string; campaignId: string },
): Promise<void> {
  const limits = await resolveSponsorshipLimits(supabase, input);
  if (limits.level === "paid") return;
  if (limits.level === "none") {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }
  const covered = await getFreeCoveredCampaignId(supabase, input.userId);
  const usage = await getFreeUsage(supabase, input.userId);
  if (usage.activeCampaigns >= (limits.campaignActiveLimit ?? FREE_CAMPAIGN_ACTIVE_LIMIT) && covered !== input.campaignId) {
    throw freeQuotaError("campaign", "You're using your free campaign. Complete, archive, or delete it to start a new one — or upgrade for unlimited campaigns.");
  }
}

export async function assertFreeChannelConnectAllowed(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string },
): Promise<void> {
  const limits = await resolveSponsorshipLimits(supabase, input);
  if (limits.level === "paid") return;
  if (limits.level === "none") {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }
  const usage = await getFreeUsage(supabase, input.userId);
  if (usage.connectedChannels >= (limits.channelConnectedLimit ?? FREE_CHANNEL_CONNECTED_LIMIT)) {
    throw freeQuotaError("channel", "You're using your free channel slot. Disconnect it to connect a different channel — or upgrade for unlimited channels.");
  }
}

/** True when the free user still has budget (no throw). */
export async function hasFreeChecksRemaining(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const usage = await getFreeUsage(supabase, userId);
  return usage.checksRemainingThisMonth > 0;
}

export async function assertFreeCheckAllowed(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string },
): Promise<void> {
  const limits = await resolveSponsorshipLimits(supabase, input);
  if (limits.level === "paid") return;
  if (limits.level === "none") {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }
  const usage = await getFreeUsage(supabase, input.userId);
  if (usage.checksRemainingThisMonth <= 0) {
    throw freeQuotaError("checks", "You've used all 10 free checks this month. Checks reset on the 1st (UTC). Upgrade for unlimited checks.");
  }
}

export function assertExportAllowed(limits: SponsorshipLimits): void {
  if (limits.exportAllowed) return;
  throw forbiddenError("Export is available on Sponsorship Tracking. Upgrade to download and share proof reports.");
}

// ── Background scan principal + eligibility ──
//
// Browser paths know the caller userId. Cron/webhooks/reconciler run with no
// browser user, so they resolve a principal from organization context:
// org grant → paid; else oldest owner with a valid paid grant → paid; else
// oldest owner with a valid free grant → free (that owner is the quota owner);
// else oldest owner with an expired paid grant → free (logical expiry → free
// fallback, same decision table as resolveSponsorshipAccessLevel);
// else none.

export interface OrgCheckPrincipal {
  level: "paid" | "free" | "none";
  /** Quota owner for free/month-budget accounting. Null when paid/none. */
  userId: string | null;
}

async function listOwnerIds(supabase: SupabaseClient, organizationId: string): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const { data: org } = await supabase.from("organizations").select("owner_id").eq("id", organizationId).single();
    const direct = (org as { owner_id?: unknown } | null)?.owner_id;
    if (typeof direct === "string" && direct.length > 0) ids.add(direct);
  } catch {
    // ignore — fall through to members
  }
  try {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("role", "owner");
    for (const m of ((members ?? []) as Array<{ user_id?: unknown }>)) {
      if (typeof m?.user_id === "string" && m.user_id.length > 0) ids.add(m.user_id);
    }
  } catch {
    // ignore
  }
  return [...ids];
}

export async function resolveOrgCheckPrincipal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrgCheckPrincipal> {
  if (await hasUnexpiredOrgSponsorshipGrant(supabase, organizationId)) return { level: "paid", userId: null };
  const toolId = await sponsorshipToolId(supabase).catch(() => null);
  if (!toolId) return { level: "none", userId: null };
  const ownerIds = await listOwnerIds(supabase, organizationId);
  if (ownerIds.length === 0) return { level: "none", userId: null };
  let freeOwner: string | null = null;
  let expiredPaidOwner: string | null = null;
  for (const ownerId of ownerIds) {
    let ownerGrant: { source: string; expires_at: string | null } | null = null;
    try {
      const row = await findUserGrant(supabase, ownerId, toolId);
      if (row) ownerGrant = { source: row.source, expires_at: row.expires_at };
    } catch {
      continue;
    }
    if (!ownerGrant) continue;
    if (isUnexpired(ownerGrant.expires_at)) {
      if (PAID_SOURCES.has(ownerGrant.source as EntitlementSource)) return { level: "paid", userId: null };
      if (ownerGrant.source === "free" && !freeOwner) freeOwner = ownerId;
    } else if (!expiredPaidOwner && PAID_SOURCES.has(ownerGrant.source as EntitlementSource)) {
      // Expired paid owner: may serve as the Free quota principal (logical
      // expiry → free fallback). Preferred only when no valid free owner exists.
      expiredPaidOwner = ownerId;
    }
  }
  if (freeOwner) return { level: "free", userId: freeOwner };
  if (expiredPaidOwner) return { level: "free", userId: expiredPaidOwner };
  return { level: "none", userId: null };
}

/**
 * Free scan eligibility for one campaign: the campaign must be the user's
 * deterministic covered campaign AND the covered channel must live in this
 * org (scans against excluded over-quota channels never execute) AND monthly
 * budget must remain. Paid → { coveredChannelId: null } (unrestricted).
 * Throws freeQuotaError (kind 'covered' | 'checks') — no row, no provider call.
 */
export async function assertFreeScanEligible(
  supabase: SupabaseClient,
  input: { userId: string; organizationId: string; campaignId: string },
): Promise<{ coveredChannelId: string | null }> {
  const limits = await resolveSponsorshipLimits(supabase, input);
  if (limits.level === "paid") return { coveredChannelId: null };
  if (limits.level === "none") {
    throw entitlementError("This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.");
  }
  const coveredCampaign = await getFreeCoveredCampaignId(supabase, input.userId);
  if (coveredCampaign !== input.campaignId) {
    throw freeQuotaError(
      "covered",
      "This campaign isn't covered by Free Sponsorship Tracking. Upgrade for unlimited campaigns and checks.",
    );
  }
  const coveredChannel = await getFreeCoveredChannelId(supabase, input.userId);
  if (!coveredChannel) {
    throw freeQuotaError(
      "covered",
      "Connect your free channel before checking. Upgrade for unlimited channels.",
    );
  }
  const channels = await listConnectedChannelsByOrg(supabase, input.organizationId).catch(() => []);
  const inOrg = channels.some(
    (c) => (c as unknown as { id: string }).id === coveredChannel && c.connection_status === "connected",
  );
  if (!inOrg) {
    throw freeQuotaError(
      "covered",
      "Your free channel lives in another workspace. Upgrade for unlimited channels and checks.",
    );
  }
  await assertFreeCheckAllowed(supabase, input);
  return { coveredChannelId: coveredChannel };
}

// ── In-process per-user-month mutex for the check-consumption edge ──
//
// Serializes check-then-insert sequences within this server instance so two
// concurrent starts with one remaining check yield exactly one scan row.
// Cross-instance races remain bounded by the immediate pre-insert recount;
// a DB advisory-lock RPC is the documented P1 follow-up if measured abuse
// appears. No counter table in V1.

const checkSlotChains = new Map<string, Promise<void>>();

function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
}

export async function withFreeCheckSlot<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const key = `${userId}:${monthKey()}`;
  const prev = checkSlotChains.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  checkSlotChains.set(key, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (checkSlotChains.get(key) === current) checkSlotChains.delete(key);
  }
}

/** Test-only reset for the in-process slot chains. */
export function __resetFreeCheckSlotsForTests(): void {
  checkSlotChains.clear();
}

// ── Database-authoritative free check reservation ──
//
// Single choke point for ALL free scan paths (manual, cron, webhook,
// targeted). Paid resolves to the existing direct-insert path (no metering,
// no RPC). Free resolves to the consume_free_check RPC, which performs
// membership + entitlement + coverage + budget + duplicate rule + pending
// insert atomically in one transaction. The in-process slot below is a
// best-effort fast path only (reduces lock contention on hot months) —
// correctness comes from the RPC transaction, never from this mutex.

/** Keep in sync with require-entitlement.ts DENIAL_MESSAGE (single copy would create a lib↔server import). */
const SPONSORSHIP_DENIAL_MESSAGE =
  "This tool isn't active for your workspace yet. Check your plan or open Billing to activate access.";

export interface FreeCheckReservation {
  scan: Scan;
  /** True when the row was created through the metered free path. */
  freePath: boolean;
}

/** Map consume_free_check SQLSTATEs onto the existing domain errors. */
export function mapConsumeFreeCheckError(error: unknown): Error {
  const code = (error as { code?: unknown })?.code;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (code === "SFQ01" || message.includes("quota_exceeded:budget")) {
    return freeQuotaError("checks", "You've used all 10 free checks this month. Checks reset on the 1st (UTC). Upgrade for unlimited checks.");
  }
  if (code === "SFQ02" || message.includes("quota_exceeded:covered")) {
    return freeQuotaError(
      "covered",
      "This campaign isn't covered by Free Sponsorship Tracking. Upgrade for unlimited campaigns and checks.",
    );
  }
  if (
    code === "SFD01" ||
    code === "CONFLICT" ||
    message.includes("already_running") ||
    message.includes("already running")
  ) {
    return new AppError({
      code: SCAN_ALREADY_RUNNING_CODE,
      status: 409,
      message: "A check is already running for this campaign. Please wait a moment and try again.",
    });
  }
  if (code === "SFN01" || message.includes("no_access")) {
    return freeQuotaError("covered", SPONSORSHIP_DENIAL_MESSAGE);
  }
  if (error instanceof Error) return error;
  return new Error(message || "Check reservation failed");
}

export async function reserveFreeCheckOrThrow(
  supabase: SupabaseClient,
  input: {
    userId: string;
    organizationId: string;
    campaignId: string;
    platform: "twitch" | "youtube" | "kick";
    scannerVersion: string;
  },
): Promise<FreeCheckReservation> {
  const limits = await resolveSponsorshipLimits(supabase, { userId: input.userId, organizationId: input.organizationId });
  if (limits.level === "paid") {
    // Paid path: existing behavior preserved byte-for-byte (stale expiry +
    // duplicate guard inside tryCreateScanWithLock). No metering, no RPC.
    const scan = await tryCreateScanWithLock(supabase, {
      organization_id: input.organizationId,
      campaign_id: input.campaignId,
      platform: input.platform,
      status: "pending",
      scanner_version: input.scannerVersion,
    });
    return { scan, freePath: false };
  }
  if (limits.level === "none") {
    throw freeQuotaError("covered", SPONSORSHIP_DENIAL_MESSAGE);
  }
  // Free path: the RPC is authoritative. The mutex only reduces lock
  // contention; two instances racing still serialize correctly in Postgres.
  return withFreeCheckSlot(input.userId, async () => {
    const { data, error } = await supabase.rpc("consume_free_check", {
      p_user_id: input.userId,
      p_organization_id: input.organizationId,
      p_campaign_id: input.campaignId,
      p_platform: input.platform,
      p_scanner_version: input.scannerVersion,
    });
    if (error) throw mapConsumeFreeCheckError(error);
    if (!data) throw new Error("Check reservation returned no scan row");
    return { scan: data as Scan, freePath: true };
  });
}
