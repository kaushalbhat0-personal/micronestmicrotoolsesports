import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateRule } from "@/features/sponsor-sentinel/services/evaluator";
import { getCapabilities } from "@/features/sponsor-sentinel/services/capabilities";
import { normalizeText } from "@/features/sponsor-sentinel/services/normalization";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { CanonicalLiveStream, CanonicalVideo } from "@/features/sponsor-sentinel/types/observations";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";
import type { ScanStage, ScanInput, ScanResult } from "./scan-types";
import { budgetExceededError, providerError } from "./scan-errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";
import * as evidenceRepo from "@/server/repositories/evidence";
import * as evaluationRepo from "@/server/repositories/evaluations";
import * as scanRepo from "@/server/repositories/scans";
import { createProviderRegistry, type ProviderRegistryOptions } from "@/server/integrations/registry";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";

const SCANNER_VERSION = "sentinel-mock-1";

export interface ScannerDeps {
  supabase: SupabaseClient;
  input: ScanInput;
  budgets?: Partial<Record<Platform, ProviderBudget>>;
  providers?: Partial<Record<Platform, LiveStateProvider & VideoEvidenceProvider>>;
  providerRegistryOptions?: ProviderRegistryOptions;
}

export async function executeScan(deps: ScannerDeps): Promise<ScanResult> {
  const { supabase, input, budgets, providers: injectedProviders, providerRegistryOptions } = deps;
  // Org-aware registry: prefers organization credentials, fallback to env
  let registry: Record<Platform, LiveStateProvider & VideoEvidenceProvider>;
  if (!injectedProviders || (!injectedProviders.twitch && !injectedProviders.youtube && !injectedProviders.kick)) {
    try {
      const { createProviderRegistryForOrg } = await import("@/server/integrations/registry");
      registry = await createProviderRegistryForOrg(supabase, input.organizationId, providerRegistryOptions as never);
    } catch {
      registry = createProviderRegistry(providerRegistryOptions);
    }
  } else {
    registry = createProviderRegistry(providerRegistryOptions);
  }
  const providers: Record<Platform, LiveStateProvider & VideoEvidenceProvider> = {
    twitch: injectedProviders?.twitch ?? registry.twitch,
    youtube: injectedProviders?.youtube ?? registry.youtube,
    kick: injectedProviders?.kick ?? registry.kick,
  };
  const organizationId = input.organizationId;
  const campaignId = input.campaignId;
  const scannerVersion = input.scannerVersion ?? SCANNER_VERSION;

  const stageErrors: { stage: ScanStage; platform?: Platform; message: string }[] = [];

  // ─ DISCOVER: load campaign + deliverables + channels, verify tenant
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);
  if (campaign.organization_id !== organizationId) throw new Error("organization mismatch for campaign");

  const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, campaignId);
  const allChannels = await channelRepo.listConnectedChannelsByOrg(supabase, organizationId);
  const channels = input.platformFilter ? allChannels.filter((c) => c.platform === input.platformFilter) : allChannels;

  if (channels.length === 0) {
    stageErrors.push({ stage: "DISCOVER", message: "no channels" });
  }

  // Create scan per platform (one scan row per run; if multiple platforms we create one per platform? For simplicity create one scan for first platform or twitch)
  // We'll create one scan row covering the run, using first channel platform or input filter
  const scanPlatform: Platform = (input.platformFilter ?? (channels[0]?.platform as Platform | undefined) ?? "twitch");
  let scan = await scanRepo.createScan(supabase, {
    organization_id: organizationId,
    campaign_id: campaignId,
    platform: scanPlatform,
    status: "pending",
    scanner_version: scannerVersion,
  });
  // pending -> running
  scan = await scanRepo.updateScanStatus(supabase, scan.id, { status: "running" });

  let evidenceCount = 0;
  let evaluationCount = 0;
  let successPlatforms = 0;
  let failedPlatforms = 0;

  // ─ For each channel: FETCH → NORMALIZE → EVALUATE → PERSIST
  for (const channel of channels) {
    const platform = channel.platform as Platform;
    const caps = getCapabilities(platform);

    // Budget check before fetch
    const budget = budgets?.[platform];
    if (budget) {
      const check = budget.canConsume(1);
      if (!check.allowed) {
        stageErrors.push({ stage: "FETCH", platform, message: budgetExceededError(check.reason ?? "budget exceeded").message });
        failedPlatforms++;
        continue;
      }
    }

    let fetchedLive: CanonicalLiveStream | null = null;
    let fetchedVideos: readonly CanonicalVideo[] = [];
    let fetchError: string | null = null;

    // FETCH
    try {
      const provider = providers[platform];
      // Live
      try {
        fetchedLive = await provider.getLiveState({
          platform,
          externalChannelId: channel.external_channel_id,
          externalHandle: channel.external_handle,
          displayName: channel.display_name,
          canonicalUrl: channel.canonical_url,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("budget")) throw budgetExceededError(msg);
        throw providerError(msg, e);
      }
      // Budget consume for live
      if (budget) budget.consume(1);

      // Videos if needed (check if any deliverable needs video)
      const needsVideo = deliverables.some((d) => {
        const rule = d.rule as { type: string };
        return rule.type === "minimum_duration" || rule.type === "required_vod_exists" || platform === "twitch" || platform === "youtube";
      });
      // Also Kick has no vod, but we still call to get empty
      if (needsVideo || caps.vodExistence) {
        // Check budget again before videos
        if (budget) {
          const cc = budget.canConsume(1);
          if (!cc.allowed) throw budgetExceededError(cc.reason ?? "budget exceeded");
        }
        fetchedVideos = await provider.listVideos(
          {
            platform,
            externalChannelId: channel.external_channel_id,
            externalHandle: channel.external_handle,
            displayName: channel.display_name,
            canonicalUrl: channel.canonical_url,
          },
          { from: campaign.starts_at, to: campaign.ends_at },
        );
        if (budget) budget.consume(1);
      }
      successPlatforms++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fetchError = msg;
      stageErrors.push({ stage: "FETCH", platform, message: msg });
      failedPlatforms++;
      continue;
    }

    // NORMALIZE is already canonical from mock; validate shape
    // EVALUATE + PERSIST per deliverable
    for (const deliverable of deliverables) {
      const rule = deliverable.rule as import("@/features/sponsor-sentinel/schemas/rules").DeliverableRule;
      // Discovery: determine required observation type
      const needsVideo = rule.type === "minimum_duration" || rule.type === "required_vod_exists";
      let observation: { kind: "live"; data: CanonicalLiveStream | null } | { kind: "video"; data: CanonicalVideo | null } | { kind: "none" };
      let source: string;
      let sourceId: string;
      let observedAt: string;
      let titleForEvidence: string;

      if (needsVideo) {
        const vid = fetchedVideos[0] ?? null;
        observation = vid ? { kind: "video", data: vid } : { kind: "none" };
        source = platform === "twitch" ? "get_videos" : platform === "youtube" ? "youtube_videos_list" : "get_videos";
        sourceId = vid?.externalVideoId ?? "none";
        observedAt = vid?.observedAt ?? new Date().toISOString();
        titleForEvidence = vid?.title ?? "";
      } else {
        // live or either: prefer live, fallback to video if live null
        const live = fetchedLive;
        const fallbackVideo = fetchedVideos[0] ?? null;
        const chosenLive = live ?? null;
        if (chosenLive) {
          observation = { kind: "live", data: chosenLive };
          source = platform === "twitch" ? "get_streams" : platform === "youtube" ? "youtube_videos_list" : "kick_livestreams";
          sourceId = chosenLive.externalStreamId;
          observedAt = chosenLive.observedAt;
          titleForEvidence = chosenLive.title;
        } else if (fallbackVideo) {
          observation = { kind: "video", data: fallbackVideo };
          source = platform === "youtube" ? "youtube_videos_list" : "get_videos";
          sourceId = fallbackVideo.externalVideoId;
          observedAt = fallbackVideo.observedAt;
          titleForEvidence = fallbackVideo.title;
        } else {
          observation = { kind: "none" };
          source = "get_streams";
          sourceId = "none";
          observedAt = new Date().toISOString();
          titleForEvidence = "";
        }
      }

      // EVALUATE (uses existing evaluator, never maps budget error to FAIL)
      // If fetchError existed we already continued, so this path is only when fetch succeeded
      let outcome;
      try {
        outcome = evaluateRule(rule, platform, observation as never);
      } catch (e) {
        stageErrors.push({ stage: "EVALUATE", platform, message: e instanceof Error ? e.message : String(e) });
        continue;
      }

      // PERSIST EVIDENCE (append-only, idempotent via unique index)
      // Only persist if we have an observation (not PENDING with no data? but spec says persist usable observation)
      // For PENDING we still may want evidence with empty? For now persist only when observation not none
      if (observation.kind !== "none" && observation.data !== null) {
        const evidenceType = observation.kind === "live" ? "live_stream" : "video";
        const externalContentId = observation.kind === "live" ? (observation.data as CanonicalLiveStream).externalStreamId : (observation.data as CanonicalVideo).externalVideoId;
        const normalized = normalizeText(titleForEvidence);
        try {
          const ev = await evidenceRepo.createEvidence(supabase, {
            organization_id: organizationId,
            campaign_id: campaignId,
            deliverable_id: deliverable.id,
            platform,
            external_channel_id: channel.external_channel_id,
            external_content_id: externalContentId,
            evidence_type: evidenceType,
            source: source as never,
            source_id: sourceId,
            source_url: observation.kind === "live" ? (observation.data as CanonicalLiveStream).canonicalUrl : (observation.data as CanonicalVideo).canonicalUrl,
            observed_at: observedAt,
            observed_value: titleForEvidence,
            normalized_value: normalized,
            raw_ref: { externalId: externalContentId, url: sourceId, platform },
            scanner_version: scannerVersion,
            scan_id: scan.id,
          });
          evidenceCount++;

          // PERSIST RESULT (evaluation)
          await evaluationRepo.createEvaluation(supabase, {
            organization_id: organizationId,
            evidence_id: ev.id,
            deliverable_id: deliverable.id,
            result: outcome.result,
            reason: outcome.reason,
            evaluator_version: "1",
            scan_id: scan.id,
          });
          evaluationCount++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Idempotency: duplicate key -> swallow, count as already persisted
          if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("violates unique constraint")) {
            // duplicate evidence -> idempotent, not an error
            continue;
          }
          stageErrors.push({ stage: "PERSIST_EVIDENCE", platform, message: msg });
        }
      } else {
        // No observation to persist evidence; still persist evaluation with synthetic? For PENDING we need evaluation but no evidence?
        // For this proof, we create evaluation without evidence? Instead skip.
        // To still produce evaluation for PENDING, we could create no evidence but evaluation requires evidence_id FK -> cannot.
        // So we skip evaluation persistence when no evidence; stage will be PENDING implied by missing evidence.
      }

      // Handle fetchError that we skipped above? Already continued.
      void fetchError; // unused
    }
  }

  // Finalize scan status
  let finalStatus: "success" | "partial" | "failed" = "success";
  if (failedPlatforms > 0 && successPlatforms > 0) finalStatus = "partial";
  else if (failedPlatforms > 0 && successPlatforms === 0) finalStatus = "failed";
  else if (stageErrors.length > 0 && evidenceCount === 0) finalStatus = "failed";

  const completed = await scanRepo.updateScanStatus(supabase, scan.id, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    error_code: stageErrors.length ? (stageErrors[0]?.message.slice(0, 100) ?? null) : null,
    error_message: stageErrors.length ? stageErrors.map((e) => `${e.stage}:${e.platform ?? "-"}:${e.message}`).join("; ").slice(0, 500) : null,
  });

  return {
    scan: completed,
    evidenceCount,
    evaluationCount,
    stageErrors,
  };
}
