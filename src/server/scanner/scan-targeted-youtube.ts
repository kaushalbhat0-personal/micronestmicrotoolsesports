import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";
import type { ScanResult } from "./scan-types";
import * as scanRepo from "@/server/repositories/scans";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import { evaluateRule } from "@/features/sponsor-sentinel/services/evaluator";
import { normalizeText } from "@/features/sponsor-sentinel/services/normalization";
import { mapYouTubeVideoToCanonical } from "@/server/integrations/youtube/mappers";
import { YouTubeClient } from "@/server/integrations/youtube/client";
import { getValidAccessToken } from "@/server/credentials/token-service";
import { createYouTubeBudget } from "@/server/integrations/youtube/budget";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";

const TARGETED_SCANNER_VERSION = "websub-targeted-1";

/**
 * Targeted YouTube WebSub processing: 1 video → N requirements per eligible campaign.
 * Uses videos.list(id=videoId) (1 general quota), no search, no playlistItems.
 * Respects campaign timeframe, per-campaign lock, batch persistence, idempotency.
 */
export async function executeTargetedYouTubeScan(
  supabase: SupabaseClient,
  event: CanonicalWebhookEvent,
): Promise<{ attempted: number; succeeded: number; skipped: number; scanIds: string[] }> {
  const videoId = event.externalContentId;
  const channelId = event.externalChannelId;
  if (!videoId || !channelId) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };
  if (event.provider !== "youtube") return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };

  // Resolve organization via connected channel (tenant isolation)
  const { data: chRow } = await supabase
    .from("connected_channels")
    .select("organization_id, external_channel_id, external_handle, display_name, canonical_url")
    .eq("platform", "youtube")
    .eq("external_channel_id", channelId)
    .limit(1)
    .maybeSingle();
  const orgId = (chRow as { organization_id?: string } | null)?.organization_id ?? null;
  if (!orgId) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };

  // Fetch single video via videos.list (OAuth if available, else API key)
  let client: YouTubeClient | null = null;
  try {
    const tok = await getValidAccessToken(supabase, orgId, "youtube");
    if (tok.ok) client = new YouTubeClient({ accessToken: tok.accessToken });
    else client = YouTubeClient ? new YouTubeClient({ apiKey: process.env.YOUTUBE_API_KEY ?? "" }) : null;
    if (!client) {
      const { createYouTubeClient } = await import("@/server/integrations/youtube/client");
      client = createYouTubeClient();
    }
  } catch {
    const { createYouTubeClient } = await import("@/server/integrations/youtube/client");
    client = createYouTubeClient();
  }
  if (!client) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };

  // Budget check (1 general) — per-event, not per-campaign
  const budget = createYouTubeBudget();
  const chk = (budget as unknown as { tryConsume?: (c: number) => { allowed: boolean } }).tryConsume
    ? (budget as unknown as { tryConsume: (c: number) => { allowed: boolean } }).tryConsume(1)
    : budget.canConsume(1);
  if (!chk.allowed) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };
  if (!(budget as unknown as { tryConsume?: unknown }).tryConsume) budget.consume(1);

  let video: ReturnType<typeof mapYouTubeVideoToCanonical> | null = null;
  try {
    const res = await client.videosList({ id: videoId });
    const raw = res.items?.[0];
    if (!raw) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };
    // Ensure video belongs to claimed channel (tenant isolation)
    if (raw.snippet.channelId !== channelId) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };
    const handle = (chRow as { external_handle?: string })?.external_handle ?? channelId;
    video = mapYouTubeVideoToCanonical(
      {
        id: raw.id,
        snippet: {
          title: raw.snippet.title,
          description: raw.snippet.description,
          tags: raw.snippet.tags,
          categoryId: raw.snippet.categoryId,
          publishedAt: raw.snippet.publishedAt,
          channelId: raw.snippet.channelId,
          liveBroadcastContent: raw.snippet.liveBroadcastContent,
        },
        contentDetails: { duration: raw.contentDetails.duration },
        liveStreamingDetails: raw.liveStreamingDetails,
      },
      handle,
      new Date().toISOString(),
    );
  } catch {
    return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };
  }
  if (!video) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };

  // Find eligible active campaigns for org where video publishedAt within campaign window
  const allCampaigns = await campaignRepo.listSponsorCampaignsByOrg(supabase, orgId);
  const active = allCampaigns.filter((c) => c.status === "active");
  const pubMs = Date.parse(video.publishedAt ?? video.observedAt);
  const eligible: typeof active = [];
  for (const c of active) {
    const hasEntitlement = await hasSentinelEntitlement(supabase, orgId);
    if (!hasEntitlement) continue;
    const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, c.id);
    if (deliverables.length === 0) continue;
    const channels = await channelRepo.listConnectedChannelsByOrg(supabase, orgId);
    if (!channels.some((ch) => ch.connection_status === "connected")) continue;
    // Timeframe check
    const starts = Date.parse(c.starts_at);
    const ends = Date.parse(c.ends_at);
    if (!Number.isNaN(pubMs) && !Number.isNaN(starts) && !Number.isNaN(ends)) {
      if (pubMs < starts || pubMs > ends) continue;
    }
    eligible.push(c);
  }
  if (eligible.length === 0) return { attempted: 0, succeeded: 0, skipped: 0, scanIds: [] };

  let succeeded = 0;
  let skipped = 0;
  const scanIds: string[] = [];
  for (const campaign of eligible) {
    const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, campaign.id);
    if (deliverables.length === 0) continue;
    // Build 1 × N pending
    const pending: Array<{ evidenceInput: import("@/server/repositories/evidence").CreateEvidenceInput; outcome: { result: import("@/types/database").EvaluationResult; reason: string }; deliverable_id: string }> = [];
    for (const deliverable of deliverables) {
      const rule = deliverable.rule as import("@/features/sponsor-sentinel/schemas/rules").DeliverableRule;
      // Only content rules are meaningful for single video; VOD rules also work but single video is fine
      let outcome;
      try {
        outcome = evaluateRule(rule, "youtube" as Platform, { kind: "video", data: video } as never);
      } catch {
        continue;
      }
      const normalized = normalizeText(video.title);
      pending.push({
        evidenceInput: {
          organization_id: orgId,
          campaign_id: campaign.id,
          deliverable_id: deliverable.id,
          platform: "youtube" as Platform,
          external_channel_id: channelId,
          external_content_id: video.externalVideoId,
          evidence_type: "video",
          source: "youtube_videos_list" as never,
          source_id: video.externalVideoId,
          source_url: video.canonicalUrl,
          observed_at: video.observedAt,
          observed_value: video.title,
          normalized_value: normalized,
          raw_ref: { externalId: video.externalVideoId, url: video.externalVideoId, platform: "youtube" },
          scanner_version: TARGETED_SCANNER_VERSION,
          scan_id: "" as string, // filled after scan creation
        },
        outcome: { result: outcome.result as import("@/types/database").EvaluationResult, reason: outcome.reason },
        deliverable_id: deliverable.id,
      });
    }
    if (pending.length === 0) continue;
    // Acquire per-campaign lock via scan creation
    let scan: import("@/types/database").Scan;
    try {
      scan = await scanRepo.tryCreateScanWithLock(supabase, {
        organization_id: orgId,
        campaign_id: campaign.id,
        platform: "youtube" as Platform,
        status: "pending",
        scanner_version: TARGETED_SCANNER_VERSION,
      });
      scan = await scanRepo.updateScanStatus(supabase, scan.id, { status: "running" });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "CONFLICT" || String((e as Error).message ?? "").includes("already running")) {
        skipped++;
        continue;
      }
      skipped++;
      continue;
    }
    // Fill scan_id
    for (const p of pending) p.evidenceInput.scan_id = scan.id;
    // Batch persist
    try {
      const insertedEvidence = await evidenceRepo.createEvidenceBatch(
        supabase,
        pending.map((p) => p.evidenceInput),
      );
      // Map evidence ids to evaluations (order preserved)
      const evidenceByKey = new Map<string, import("@/types/database").Evidence>();
      const normalizeTs = (ts: string) => {
        const d = Date.parse(ts);
        return Number.isNaN(d) ? ts : new Date(d).toISOString();
      };
      for (const ev of insertedEvidence as unknown as import("@/types/database").Evidence[]) {
        evidenceByKey.set(`${ev.organization_id}|${ev.deliverable_id}|${ev.platform}|${ev.source}|${ev.source_id}|${normalizeTs(ev.observed_at)}`, ev);
      }
      const evaluationInputs: import("@/server/repositories/evaluations").CreateEvaluationInput[] = [];
      const useIndex = insertedEvidence.length === pending.length;
      if (useIndex) {
        for (let i = 0; i < pending.length; i++) {
          const p = pending[i] as (typeof pending)[number];
          const ev = (insertedEvidence as unknown as import("@/types/database").Evidence[])[i];
          if (!p || !ev) continue;
          evaluationInputs.push({
            organization_id: orgId,
            evidence_id: ev.id,
            deliverable_id: p.deliverable_id,
            result: p.outcome.result,
            reason: p.outcome.reason,
            scan_id: scan.id,
          });
        }
      } else {
        for (const p of pending) {
          const key = `${p.evidenceInput.organization_id}|${p.evidenceInput.deliverable_id}|${p.evidenceInput.platform}|${p.evidenceInput.source}|${p.evidenceInput.source_id}|${normalizeTs(p.evidenceInput.observed_at)}`;
          const ev = evidenceByKey.get(key);
          if (!ev) continue;
          evaluationInputs.push({
            organization_id: orgId,
            evidence_id: ev.id,
            deliverable_id: p.deliverable_id,
            result: p.outcome.result,
            reason: p.outcome.reason,
            scan_id: scan.id,
          });
        }
      }
      if (evaluationInputs.length > 0) {
        await evaluationRepo.createEvaluationsBatch(supabase, evaluationInputs);
      }
      await scanRepo.updateScanStatus(supabase, scan.id, { status: "success", completed_at: new Date().toISOString() });
      succeeded++;
      scanIds.push(scan.id);
    } catch {
      try {
        await scanRepo.updateScanStatus(supabase, scan.id, { status: "failed", completed_at: new Date().toISOString(), error_code: "targeted_failed", error_message: "targeted persist failed" });
      } catch {}
      skipped++;
    }
  }

  return { attempted: eligible.length, succeeded, skipped, scanIds };
}

async function hasSentinelEntitlement(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_tool_access", { org_id: organizationId, tool_slug: "sponsor-sentinel" });
    if (!error && typeof data === "boolean") return data;
  } catch {}
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", "sponsor-sentinel").single();
  if (!tool) return false;
  const { data: entitlements } = await supabase.from("tool_entitlements").select("is_all_access, tool_id, expires_at").eq("organization_id", organizationId);
  if (!entitlements) return false;
  const list = entitlements as Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>;
  return list.some((e) => {
    const notExpired = !e.expires_at || new Date(e.expires_at) > new Date();
    if (!notExpired) return false;
    if (e.is_all_access) return true;
    return e.tool_id === (tool as { id: string }).id;
  });
}
