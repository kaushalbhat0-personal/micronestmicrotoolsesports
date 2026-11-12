import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";
import { classifyWebhookEvent, type SentinelEventCategory } from "./classifier";
import { executeScan } from "@/server/scanner/scan-orchestrator";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";

export type SentinelWebhookResult =
  | { status: "IGNORED"; reason: string; category: SentinelEventCategory }
  | { status: "NO_CAMPAIGN"; reason: string; category: SentinelEventCategory }
  | { status: "NO_ACTION"; reason: string; category: SentinelEventCategory }
  | { status: "SCAN_REQUESTED"; category: SentinelEventCategory; campaignIds: string[] }
  | { status: "SCAN_COMPLETED"; category: SentinelEventCategory; campaignIds: string[]; scanIds: string[] }
  | { status: "SCAN_FAILED"; category: SentinelEventCategory; campaignIds: string[]; error: string }
  | { status: "UNSUPPORTED"; category: SentinelEventCategory; reason: string }
  | { status: "DUPLICATE"; category: SentinelEventCategory };

/**
 * Provider-neutral Sentinel webhook handler (09).
 * Resolves affected campaigns via ConnectedChannel → SponsorCampaign,
 * then requests scoped scans via existing scanner (no provider fetch duplication).
 * Sequential bounded execution, failure isolation, scan storm protection via
 * per-campaign throttling (last scan within 60s skipped) and duplicate webhook handling upstream.
 */
export async function handleSentinelWebhookEvent(
  supabase: SupabaseClient,
  event: CanonicalWebhookEvent,
): Promise<SentinelWebhookResult> {
  const category = classifyWebhookEvent(event);
  if (category === "UNSUPPORTED") return { status: "UNSUPPORTED", category, reason: "event type not supported for Sentinel" };
  if (category === "IGNORED") return { status: "IGNORED", category, reason: "ignored" };

  // Targeted YouTube WebSub: single video → campaigns → 1×N evaluation, no full historical scan
  if (event.provider === "youtube" && category === "CONTENT_PUBLISHED" && event.externalContentId && event.externalChannelId) {
    try {
      const { executeTargetedYouTubeScan } = await import("@/server/scanner/scan-targeted-youtube");
      const targeted = await executeTargetedYouTubeScan(supabase, event);
      if (targeted.succeeded > 0) {
        return { status: "SCAN_COMPLETED", category, campaignIds: [], scanIds: targeted.scanIds };
      }
      if (targeted.attempted === 0) return { status: "NO_CAMPAIGN", category, reason: "no eligible campaign for video timeframe/channel" };
      return { status: "NO_ACTION", category, reason: "targeted skipped (already running or no eligible campaign)" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Fall through to full scan on targeted failure
      console.warn(JSON.stringify({ event: "targeted_youtube_fallback", error: msg.slice(0, 200) }));
    }
  }

  const organizationId = await resolveOrganizationIdForEvent(supabase, event);
  if (!organizationId) return { status: "IGNORED", category, reason: "no organization for channel" };

  const campaigns = await resolveAffectedCampaigns(supabase, organizationId, event);
  if (campaigns.length === 0) return { status: "NO_CAMPAIGN", category, reason: "no active campaign for channel" };

  // Filter by policy: which categories trigger scans where relevant deliverables exist
  const withPolicy = await filterByScanPolicy(supabase, campaigns, category);
  if (withPolicy.length === 0) return { status: "NO_ACTION", category, reason: `no deliverables require ${category}` };

  // Avoid scan storms: per-campaign last scan within 60s → skip
  const toScan: typeof withPolicy = [];
  for (const c of withPolicy) {
    const lastScan = await getLastScanForCampaign(supabase, c.id);
    if (lastScan) {
      const ageMs = Date.now() - Date.parse(lastScan.started_at);
      if (ageMs < 60_000) continue; // throttle 60s
    }
    toScan.push(c);
  }
  if (toScan.length === 0) return { status: "NO_ACTION", category, reason: "scan throttled (recent scan)" };

  // Free-tier gate: skip campaigns that are not quota-eligible (over-quota
  // campaign/channel or exhausted monthly budget). No scan row, no provider
  // call. Paid coverage proceeds unaffected. This pre-filter is a cost-saving
  // optimization; the database RPC at insert time remains authoritative.
  // Fail closed: if the principal cannot be established, do not scan.
  const quotaEligible: typeof toScan = [];
  let freeQuotaUserId: string | null = null;
  try {
    const { resolveOrgCheckPrincipal, assertFreeScanEligible } = await import("@/server/services/sponsorship-limits");
    const principal = await resolveOrgCheckPrincipal(supabase, organizationId);
    if (principal.level === "none") {
      return { status: "NO_ACTION", category, reason: "no sponsorship coverage for workspace" };
    }
    if (principal.level === "paid") {
      // Paid coverage: unmetered direct path. Entered ONLY on an explicit
      // paid level — never inferred from a missing userId.
      quotaEligible.push(...toScan);
    } else if (principal.level === "free") {
      // Free coverage: the quota owner is required. A free principal without
      // a userId must fail closed — never fall into paid/unmetered.
      if (!principal.userId) {
        return { status: "NO_ACTION", category, reason: "free quota owner unavailable" };
      }
      freeQuotaUserId = principal.userId;
      for (const campaign of toScan) {
        try {
          await assertFreeScanEligible(supabase, { userId: principal.userId, organizationId, campaignId: campaign.id });
          quotaEligible.push(campaign);
        } catch {
          continue;
        }
      }
    } else {
      return { status: "NO_ACTION", category, reason: "coverage check unavailable" };
    }
  } catch (e) {
    // Fail closed: an unresolvable principal must not admit unscanned-gated
    // provider traffic. (Principal resolution catches its own DB errors, so
    // this only triggers on catastrophic failure, where scanning is unsafe.)
    console.warn(JSON.stringify({ event: "sentinel_webhook_principal_unavailable", organizationId, category, error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200) }));
    return { status: "NO_ACTION", category, reason: "coverage check unavailable" };
  }
  if (quotaEligible.length === 0) return { status: "NO_ACTION", category, reason: "free quota exhausted" };

  const campaignIds = quotaEligible.map((c) => c.id);
  const scanIds: string[] = [];
  let anyFailed = false;
  let lastError = "";
  // Sequential bounded execution
  for (const campaign of quotaEligible) {
    try {
      // Thread the server-derived principal so the database RPC performs the
      // authoritative insert-time reservation (paid: absent, direct path).
      const res = await executeScan({
        supabase,
        input: freeQuotaUserId
          ? { organizationId, campaignId: campaign.id, userId: freeQuotaUserId }
          : { organizationId, campaignId: campaign.id },
      });
      const sid = (res.scan as { id?: string })?.id;
      if (sid) scanIds.push(sid);
      console.warn(JSON.stringify({ event: "sentinel_webhook_scan", organizationId, campaignId: campaign.id, channelId: event.externalChannelId, provider: event.provider, eventType: event.eventType, category, scanId: sid }));
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "CONFLICT" || String((e as Error).message ?? "").includes("already running")) {
        console.warn(JSON.stringify({ event: "sentinel_webhook_scan_skipped_already_running", organizationId, campaignId: campaign.id, category }));
        continue; // webhook already persisted, active Check will discover it
      }
      // Free-quota race between pre-check and insert — skip quietly.
      try {
        const { isFreeQuotaError } = await import("@/server/services/sponsorship-limits");
        if (isFreeQuotaError(e)) {
          console.warn(JSON.stringify({ event: "sentinel_webhook_scan_skipped_free_quota", organizationId, campaignId: campaign.id, category }));
          continue;
        }
      } catch {
        // fall through to failure handling below
      }
      anyFailed = true;
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(JSON.stringify({ event: "sentinel_webhook_scan_failed", organizationId, campaignId: campaign.id, category, error: lastError.slice(0, 200) }));
      // isolate failure, continue to next campaign
    }
  }

  if (anyFailed && scanIds.length === 0) return { status: "SCAN_FAILED", category, campaignIds, error: lastError };
  if (anyFailed) return { status: "SCAN_COMPLETED", category, campaignIds, scanIds }; // partial
  return { status: "SCAN_COMPLETED", category, campaignIds, scanIds };
}

async function resolveOrganizationIdForEvent(supabase: SupabaseClient, event: CanonicalWebhookEvent): Promise<string | null> {
  if (!event.externalChannelId) return null;
  const { data } = await supabase.from("connected_channels").select("organization_id").eq("platform", event.provider).eq("external_channel_id", event.externalChannelId).limit(1).maybeSingle();
  const row = data as { organization_id?: string } | null;
  return row?.organization_id ?? null;
}

async function resolveAffectedCampaigns(supabase: SupabaseClient, organizationId: string, _event: CanonicalWebhookEvent) {
  // All active campaigns for org with at least one connected channel and at least one deliverable and entitlement
  const all = await campaignRepo.listSponsorCampaignsByOrg(supabase, organizationId);
  const active = all.filter((c) => c.status === "active");
  const eligible: typeof active = [];
  for (const c of active) {
    const hasEntitlement = await hasSentinelEntitlement(supabase, organizationId);
    if (!hasEntitlement) continue;
    const channels = await channelRepo.listConnectedChannelsByOrg(supabase, organizationId);
    if (channels.length === 0) continue;
    // At least one connected channel must be in connected state
    const connected = channels.some((ch) => ch.connection_status === "connected");
    if (!connected) continue;
    const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, c.id);
    if (deliverables.length === 0) continue;
    // Campaign is affected if its org matches event's org (channel already resolved); we don't filter per-channel campaign link because schema has no direct link
    eligible.push(c);
  }
  return eligible;
}

async function hasSentinelEntitlement(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  // Phase 3: shared org-coverage check — legacy org grant OR owner user grant.
  // No browser session is assumed here; data stays org-scoped under RLS.
  const { hasSponsorshipAccessForOrg } = await import("@/server/services/sponsorship-access");
  return hasSponsorshipAccessForOrg(supabase, organizationId);
}

async function filterByScanPolicy(supabase: SupabaseClient, campaigns: Array<{ id: string }>, category: SentinelEventCategory): Promise<Array<{ id: string }>> {
  // For MVP, all categories trigger scan if any deliverable exists that could be affected.
  // For STREAM_METADATA_CHANGED, only if deliverables depend on title/category/tags.
  if (category === "STREAM_METADATA_CHANGED") {
    const filtered: typeof campaigns = [];
    for (const c of campaigns) {
      const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, c.id);
      const needsMeta = deliverables.some((d) => {
        const rule = d.rule as { type: string };
        return ["required_title_contains", "required_hashtag", "required_category", "required_twitch_tag", "required_tags"].includes(rule.type);
      });
      if (needsMeta) filtered.push(c);
    }
    return filtered;
  }
  return campaigns;
}

async function getLastScanForCampaign(supabase: SupabaseClient, campaignId: string) {
  const { data } = await supabase.from("scans").select("id, started_at").eq("campaign_id", campaignId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data as { id: string; started_at: string } | null;
}
