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

  // Authoritative platform: prefer explicit filter, else first channel, else twitch fallback.
  // If execution later yields evidence on a single distinct platform, we correct the scan row to that platform
  // (prevents youtube/twitch mismatch when org has multiple channels but proof is twitch).
  const initialScanPlatform: Platform = (input.platformFilter ?? (channels[0]?.platform as Platform | undefined) ?? "twitch");
  let scan = await scanRepo.createScan(supabase, {
    organization_id: organizationId,
    campaign_id: campaignId,
    platform: initialScanPlatform,
    status: "pending",
    scanner_version: scannerVersion,
  });
  // pending -> running
  scan = await scanRepo.updateScanStatus(supabase, scan.id, { status: "running" });
  // Track distinct evidence platforms for post-run correction
  const evidencePlatforms = new Set<Platform>();

  let evidenceCount = 0;
  let evaluationCount = 0;
  let successPlatforms = 0;
  let failedPlatforms = 0;

  // Batch collection: evaluate → build rows in memory → batch insert (free-infra optimization)
  type PendingItem = {
    evidenceInput: import("@/server/repositories/evidence").CreateEvidenceInput;
    outcome: { result: import("@/types/database").EvaluationResult; reason: string };
    deliverable_id: string;
  };
  const pending: PendingItem[] = [];

  // ─ For each channel: FETCH → NORMALIZE → EVALUATE → COLLECT
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
    // EVALUATE + PERSIST per deliverable — Cartesian: every candidate × every deliverable (bounded: YouTube ≤25, Twitch ≤20, Kick live-only)
    for (const deliverable of deliverables) {
      const rule = deliverable.rule as import("@/features/sponsor-sentinel/schemas/rules").DeliverableRule;
      const needsVideo = rule.type === "minimum_duration" || rule.type === "required_vod_exists";

      if (needsVideo) {
        // Preserve existing single-video semantics for duration/VOD existence
        let observation: { kind: "video"; data: CanonicalVideo | null } | { kind: "none" } = { kind: "none" };
        let source: string = "get_streams";
        let sourceId: string = "none";
        let observedAt: string = new Date().toISOString();
        let titleForEvidence: string = "";
        const vid = fetchedVideos[0] ?? null;
        observation = vid ? { kind: "video", data: vid } : { kind: "none" };
        source = platform === "twitch" ? "get_videos" : platform === "youtube" ? "youtube_videos_list" : "get_videos";
        sourceId = vid?.externalVideoId ?? "none";
        observedAt = vid?.observedAt ?? new Date().toISOString();
        titleForEvidence = vid?.title ?? "";

        let outcome;
        try {
          outcome = evaluateRule(rule, platform, observation as never);
        } catch (e) {
          stageErrors.push({ stage: "EVALUATE", platform, message: e instanceof Error ? e.message : String(e) });
          continue;
        }
        if (observation.kind !== "none" && observation.data !== null) {
          const evidenceType = "video";
          const externalContentId = (observation.data as CanonicalVideo).externalVideoId;
          const normalized = normalizeText(titleForEvidence);
          pending.push({
            evidenceInput: {
              organization_id: organizationId,
              campaign_id: campaignId,
              deliverable_id: deliverable.id,
              platform,
              external_channel_id: channel.external_channel_id,
              external_content_id: externalContentId,
              evidence_type: evidenceType,
              source: source as never,
              source_id: sourceId,
              source_url: (observation.data as CanonicalVideo).canonicalUrl,
              observed_at: observedAt,
              observed_value: titleForEvidence,
              normalized_value: normalized,
              raw_ref: { externalId: externalContentId, url: sourceId, platform },
              scanner_version: scannerVersion,
              scan_id: scan.id,
            },
            outcome: { result: outcome.result as import("@/types/database").EvaluationResult, reason: outcome.reason },
            deliverable_id: deliverable.id,
          });
        }
        void fetchError;
        continue;
      }

      // Content rules — Cartesian product: every candidate × this deliverable
      const candidates: Array<{ kind: "live"; data: CanonicalLiveStream } | { kind: "video"; data: CanonicalVideo }> = [];
      if (fetchedLive) candidates.push({ kind: "live", data: fetchedLive });
      for (const v of fetchedVideos) candidates.push({ kind: "video", data: v });

      if (candidates.length === 0) {
        // No observable content — prior behavior persisted nothing (PENDING via missing evidence)
        continue;
      }

      let hasPass = false;
      for (const cand of candidates) {
        const obsKind = cand.kind;
        const obsData = cand.data as CanonicalLiveStream | CanonicalVideo;
        let candSource: string;
        let candSourceId: string;
        let candObservedAt: string;
        let candTitle: string;
        if (obsKind === "live") {
          candSource = platform === "twitch" ? "get_streams" : platform === "youtube" ? "youtube_videos_list" : "kick_livestreams";
          candSourceId = (obsData as CanonicalLiveStream).externalStreamId;
          candObservedAt = (obsData as CanonicalLiveStream).observedAt;
          candTitle = (obsData as CanonicalLiveStream).title;
        } else {
          candSource = platform === "youtube" ? "youtube_videos_list" : "get_videos";
          candSourceId = (obsData as CanonicalVideo).externalVideoId;
          candObservedAt = (obsData as CanonicalVideo).observedAt;
          candTitle = (obsData as CanonicalVideo).title;
        }

        let candOutcome;
        try {
          const candObs = obsKind === "live" ? ({ kind: "live", data: obsData } as const) : ({ kind: "video", data: obsData } as const);
          candOutcome = evaluateRule(rule, platform, candObs as never);
        } catch (e) {
          stageErrors.push({ stage: "EVALUATE", platform, message: e instanceof Error ? e.message : String(e) });
          continue;
        }

        if (candOutcome.result !== "PASS") continue;
        hasPass = true;
        // Collect evidence/evaluation for batch insert
        const evidenceType = obsKind === "live" ? "live_stream" : "video";
        const externalContentId = obsKind === "live" ? (obsData as CanonicalLiveStream).externalStreamId : (obsData as CanonicalVideo).externalVideoId;
        const normalized = normalizeText(candTitle);
        pending.push({
          evidenceInput: {
            organization_id: organizationId,
            campaign_id: campaignId,
            deliverable_id: deliverable.id,
            platform,
            external_channel_id: channel.external_channel_id,
            external_content_id: externalContentId,
            evidence_type: evidenceType,
            source: candSource as never,
            source_id: candSourceId,
            source_url: obsKind === "live" ? (obsData as CanonicalLiveStream).canonicalUrl : (obsData as CanonicalVideo).canonicalUrl,
            observed_at: candObservedAt,
            observed_value: candTitle,
            normalized_value: normalized,
            raw_ref: { externalId: externalContentId, url: candSourceId, platform },
            scanner_version: scannerVersion,
            scan_id: scan.id,
          },
          outcome: { result: candOutcome.result as import("@/types/database").EvaluationResult, reason: candOutcome.reason },
          deliverable_id: deliverable.id,
        });
      }
      if (hasPass) {
        void fetchError;
        continue;
      }
      // No PASS — fallback single evidence to preserve prior FAIL/PENDING audit trail
      {
        const fallbackCand = candidates.find((c) => c.kind === "video") ?? candidates[0]!;
        const fbKind = fallbackCand.kind;
        const fbData = fallbackCand.data as CanonicalLiveStream | CanonicalVideo;
        let fbSource: string;
        let fbSourceId: string;
        let fbObservedAt: string;
        let fbTitle: string;
        if (fbKind === "live") {
          fbSource = platform === "twitch" ? "get_streams" : platform === "youtube" ? "youtube_videos_list" : "kick_livestreams";
          fbSourceId = (fbData as CanonicalLiveStream).externalStreamId;
          fbObservedAt = (fbData as CanonicalLiveStream).observedAt;
          fbTitle = (fbData as CanonicalLiveStream).title;
        } else {
          fbSource = platform === "youtube" ? "youtube_videos_list" : "get_videos";
          fbSourceId = (fbData as CanonicalVideo).externalVideoId;
          fbObservedAt = (fbData as CanonicalVideo).observedAt;
          fbTitle = (fbData as CanonicalVideo).title;
        }
        let fbOutcome;
        try {
          const fbObs = fbKind === "live" ? ({ kind: "live", data: fbData } as const) : ({ kind: "video", data: fbData } as const);
          fbOutcome = evaluateRule(rule, platform, fbObs as never);
        } catch (e) {
          stageErrors.push({ stage: "EVALUATE", platform, message: e instanceof Error ? e.message : String(e) });
          void fetchError;
          continue;
        }
        const evidenceType = fbKind === "live" ? "live_stream" : "video";
        const externalContentId = fbKind === "live" ? (fbData as CanonicalLiveStream).externalStreamId : (fbData as CanonicalVideo).externalVideoId;
        const normalized = normalizeText(fbTitle);
        pending.push({
          evidenceInput: {
            organization_id: organizationId,
            campaign_id: campaignId,
            deliverable_id: deliverable.id,
            platform,
            external_channel_id: channel.external_channel_id,
            external_content_id: externalContentId,
            evidence_type: evidenceType,
            source: fbSource as never,
            source_id: fbSourceId,
            source_url: fbKind === "live" ? (fbData as CanonicalLiveStream).canonicalUrl : (fbData as CanonicalVideo).canonicalUrl,
            observed_at: fbObservedAt,
            observed_value: fbTitle,
            normalized_value: normalized,
            raw_ref: { externalId: externalContentId, url: fbSourceId, platform },
            scanner_version: scannerVersion,
            scan_id: scan.id,
          },
          outcome: { result: fbOutcome.result as import("@/types/database").EvaluationResult, reason: fbOutcome.reason },
          deliverable_id: deliverable.id,
        });
      }
      void fetchError;
    }
  }

  // ─ BATCH PERSIST: evidence[] → evaluations[] (2 round trips, fallback per-row on error preserves idempotency)
  if (pending.length > 0) {
    let insertedEvidence: import("@/types/database").Evidence[] = [];
    let batchSucceeded = false;
    try {
      const batchResult = await evidenceRepo.createEvidenceBatch(
        supabase,
        pending.map((p) => p.evidenceInput),
      );
      // Supabase batch returns array in insertion order; handle stub returning empty/single
      if (Array.isArray(batchResult) && batchResult.length > 0) {
        insertedEvidence = batchResult as import("@/types/database").Evidence[];
        batchSucceeded = insertedEvidence.length === pending.length;
        // If batch returned partial (e.g., stub), treat as not fully succeeded and fallback for missing
        if (batchSucceeded) {
          for (const ev of insertedEvidence) evidencePlatforms.add(ev.platform as Platform);
          evidenceCount = insertedEvidence.length;
        }
      }
      if (!batchSucceeded) throw new Error("batch incomplete, fallback per-row");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isDuplicate = msg.includes("duplicate") || msg.includes("unique") || msg.includes("violates unique constraint");
      if (!isDuplicate && batchSucceeded) {
        // Real non-duplicate batch error already handled above; don't double push
      } else if (!isDuplicate) {
        // Batch incomplete or error — fallback per-row without pushing stage error yet
      }
      if (!batchSucceeded) {
        // Fallback per-row to preserve duplicate-swallowing and partial success semantics
        insertedEvidence = [];
        // Clear any partial batch evidencePlatforms added above before fallback
        // (if batch partially succeeded, keep those, but our batchSucceeded false means none kept)
        if (insertedEvidence.length === 0) evidencePlatforms.clear();
        for (const p of pending) {
          try {
            const ev = await evidenceRepo.createEvidence(supabase, p.evidenceInput);
            insertedEvidence.push(ev as import("@/types/database").Evidence);
            evidencePlatforms.add(p.evidenceInput.platform as Platform);
          } catch (inner) {
            const imsg = inner instanceof Error ? inner.message : String(inner);
            if (imsg.includes("duplicate") || imsg.includes("unique") || imsg.includes("violates unique constraint")) {
              continue;
            }
            stageErrors.push({ stage: "PERSIST_EVIDENCE", platform: p.evidenceInput.platform as Platform, message: imsg });
          }
        }
        evidenceCount = insertedEvidence.length;
        if (evidenceCount === 0 && pending.length > 0 && !isDuplicate) {
          // Only push batch error if fallback also produced nothing and it's not duplicate case
          const batchMsg = msg.includes("batch incomplete") ? "batch insert incomplete" : msg;
          stageErrors.push({ stage: "PERSIST_EVIDENCE", message: batchMsg });
        }
      }
    }

    // Build evaluation inputs aligned to successfully inserted evidence
    // For batch success path, insertedEvidence length === pending length and order-aligned
    // For fallback path, we need to map via unique key (deliverable_id+source_id+observed_at)
    const evidenceByKey = new Map<string, import("@/types/database").Evidence>();
    for (const ev of insertedEvidence) {
      const key = `${ev.organization_id}|${ev.deliverable_id}|${ev.platform}|${ev.source}|${ev.source_id}|${ev.observed_at}`;
      evidenceByKey.set(key, ev);
    }
    const evaluationInputs: import("@/server/repositories/evaluations").CreateEvaluationInput[] = [];
    for (const p of pending) {
      const key = `${p.evidenceInput.organization_id}|${p.evidenceInput.deliverable_id}|${p.evidenceInput.platform}|${p.evidenceInput.source}|${p.evidenceInput.source_id}|${p.evidenceInput.observed_at}`;
      const ev = evidenceByKey.get(key);
      if (!ev) continue; // duplicate swallowed, no evaluation
      evaluationInputs.push({
        organization_id: organizationId,
        evidence_id: ev.id,
        deliverable_id: p.deliverable_id,
        result: p.outcome.result,
        reason: p.outcome.reason,
        scan_id: scan.id,
      });
    }

    if (evaluationInputs.length > 0) {
      let evalBatchSucceeded = false;
      try {
        const insertedEvals = await evaluationRepo.createEvaluationsBatch(supabase, evaluationInputs);
        if (Array.isArray(insertedEvals) && insertedEvals.length > 0) {
          evalBatchSucceeded = insertedEvals.length === evaluationInputs.length;
          if (evalBatchSucceeded) evaluationCount = insertedEvals.length;
          else throw new Error("eval batch incomplete");
        } else {
          throw new Error("eval batch incomplete");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!evalBatchSucceeded) {
          // Fallback per-row for evaluations (no unique, but preserve partial on transient failure)
          evaluationCount = 0;
          for (const inp of evaluationInputs) {
            try {
              await evaluationRepo.createEvaluation(supabase, inp);
              evaluationCount++;
            } catch (inner) {
              const imsg = inner instanceof Error ? inner.message : String(inner);
              stageErrors.push({ stage: "PERSIST_EVIDENCE", message: imsg });
            }
          }
          if (evaluationCount === 0 && evaluationInputs.length > 0 && !msg.includes("duplicate")) {
            stageErrors.push({ stage: "PERSIST_EVIDENCE", message: msg });
          }
        }
      }
    }
  }

  // Platform correction: if all evidence is on a single platform but initial scan platform differs, fix it
  // This resolves twitch proof showing as youtube when org has youtube as first channel
  if (evidencePlatforms.size === 1) {
    const evidencePlatform = [...evidencePlatforms][0] as Platform;
    if (evidencePlatform && evidencePlatform !== initialScanPlatform && !input.platformFilter) {
      try {
        scan = await scanRepo.updateScanPlatform(supabase, scan.id, evidencePlatform);
      } catch {
        // best-effort: if update fails, the completed scan below will still carry original platform
        // but evidence platform remains authoritative for UI fallback
      }
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
