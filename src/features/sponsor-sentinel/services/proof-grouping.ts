import type { Evidence, Evaluation } from "@/types/database";
import type { EvaluationResult } from "@/types/database";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import { PLATFORM_DISPLAY_ORDER } from "@/features/sponsor-sentinel/types/platform";

/** Pure helper — groups evidence by persisted evidence.platform. */
export function groupEvidenceByPlatform(evidence: readonly Evidence[]): ReadonlyArray<{ platform: Platform; items: Evidence[] }> {
  const byPlatform = new Map<Platform, Evidence[]>();
  for (const ev of evidence) {
    const p = ev.platform as Platform;
    // Type-safe — only known platforms, ignore unknown
    if (p !== "youtube" && p !== "twitch" && p !== "kick") continue;
    const list = byPlatform.get(p) ?? [];
    list.push(ev);
    byPlatform.set(p, list);
  }
  // Deterministic product order, only platforms with proof
  const ordered: Array<{ platform: Platform; items: Evidence[] }> = [];
  for (const p of PLATFORM_DISPLAY_ORDER) {
    const items = byPlatform.get(p);
    if (items && items.length > 0) ordered.push({ platform: p, items });
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Content-centric projection — primary grouping for RCCF-SPONSOR-PROOF-UI-01
// One group per external_content_id (plus scan_id boundary) → many requirements.
// ---------------------------------------------------------------------------

export interface ProofContentRequirement {
  readonly deliverableId: string;
  readonly requirementName: string;
  readonly result: EvaluationResult;
  readonly reason?: string | undefined;
  readonly evidenceId: string;
  readonly evaluationId?: string | undefined;
}

export interface ProofContentGroup {
  readonly contentId: string;
  readonly scanId: string | null;
  readonly sourceUrl: string | null;
  /** Deduplicated source URLs for this content (one entry if same URL repeated). */
  readonly sourceUrls: readonly string[];
  /** Human title — derived from evidence.observed_value. */
  readonly title?: string | undefined;
  readonly platform: Platform;
  readonly channelId?: string | undefined;
  readonly observedAt?: string | undefined;
  readonly evidenceIds: readonly string[];
  readonly requirements: readonly ProofContentRequirement[];
}

/**
 * Content-centric grouping.
 * - Groups by external_content_id (fallback to evidence.id when null) + scan_id boundary.
 * - One content group appears once with all requirements it satisfies underneath.
 * - Preserves evaluation result semantics exactly (no PASS inference).
 * - Deduplicates identical source_url to single content-level link.
 * - Deterministic ordering: platform display order → observedAt → contentId.
 */
export function groupProofByContent(
  evidence: readonly Evidence[],
  evaluations: readonly Evaluation[],
  deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>,
): ReadonlyArray<ProofContentGroup> {
  if (evidence.length === 0) return [];

  // Fast lookup: evidence_id → evaluation (1:1 in current scanner Cartesian model)
  const evalByEvidenceId = new Map<string, Evaluation>();
  for (const ev of evaluations) {
    // Keep first evaluation per evidence_id (scanner currently creates one)
    if (!evalByEvidenceId.has(ev.evidence_id)) evalByEvidenceId.set(ev.evidence_id, ev);
  }

  // Internal mutable group builder
  type MutableGroup = {
    contentId: string;
    scanId: string | null;
    sourceUrl: string | null;
    sourceUrlSet: Set<string>;
    title?: string | undefined;
    platform: Platform;
    channelId?: string | undefined;
    observedAt?: string | undefined;
    evidenceIds: string[];
    requirements: ProofContentRequirement[];
  };

  const groupsByKey = new Map<string, MutableGroup>();
  const platformOrderIndex = new Map<Platform, number>(PLATFORM_DISPLAY_ORDER.map((p, i) => [p, i] as const));

  for (const ev of evidence) {
    const platform = ev.platform as Platform;
    if (platform !== "youtube" && platform !== "twitch" && platform !== "kick") continue;

    const contentIdRaw = ev.external_content_id;
    // Null external_content_id → each evidence is its own content (cannot group)
    const contentId = contentIdRaw ?? ev.id;
    const evalMatch = evalByEvidenceId.get(ev.id);
    // Scan boundary: evidence.scan_id (or evaluation scan_id) is part of key to keep Check isolation
    const scanId = (ev.scan_id ?? evalMatch?.scan_id ?? null) as string | null;
    const key = `${scanId ?? "__null_scan"}::${contentId}`;

    const deliverableId = ev.deliverable_id;
    const requirementName = deliverableMap.get(deliverableId)?.name ?? (evalMatch ? (deliverableMap.get(evalMatch.deliverable_id)?.name ?? "Requirement") : "Requirement");
    // Preserve exact result — never infer PASS; fall back to PENDING if no evaluation present (explicit)
    const result: EvaluationResult = (evalMatch?.result as EvaluationResult | undefined) ?? "PENDING";
    const reason = evalMatch?.reason;

    let group: MutableGroup | undefined = groupsByKey.get(key);
    if (!group) {
      const sourceUrlSet = new Set<string>();
      if (ev.source_url) sourceUrlSet.add(ev.source_url);
      const initialReq: ProofContentRequirement = {
        deliverableId,
        requirementName,
        result,
        evidenceId: ev.id,
        ...(reason !== undefined ? { reason } : {}),
        ...(evalMatch?.id !== undefined ? { evaluationId: evalMatch.id } : {}),
      };
      const newGroup: MutableGroup = {
        contentId,
        scanId,
        sourceUrl: ev.source_url ?? null,
        sourceUrlSet,
        platform,
        evidenceIds: [ev.id],
        requirements: [initialReq],
        ...(ev.observed_value !== undefined && ev.observed_value !== null ? { title: ev.observed_value } : {}),
        ...(ev.external_channel_id ? { channelId: ev.external_channel_id } : {}),
        ...(ev.observed_at ? { observedAt: ev.observed_at } : {}),
      };
      groupsByKey.set(key, newGroup);
    } else {
      // Deduplicate source_url
      if (ev.source_url) group.sourceUrlSet.add(ev.source_url);
      // Preserve first non-null title/observedAt/platform but keep earliest observedAt
      if (!group.title && ev.observed_value) group.title = ev.observed_value;
      if (!group.channelId && ev.external_channel_id) group.channelId = ev.external_channel_id;
      // Keep earliest observedAt
      if (ev.observed_at && group.observedAt) {
        if (ev.observed_at < group.observedAt) group.observedAt = ev.observed_at;
      } else if (ev.observed_at && !group.observedAt) {
        group.observedAt = ev.observed_at;
      }
      // Merge canonical sourceUrl for display — first unique remains, but set tracks dedup
      group.evidenceIds.push(ev.id);
      const req: ProofContentRequirement = {
        deliverableId,
        requirementName,
        result,
        evidenceId: ev.id,
        ...(reason !== undefined ? { reason } : {}),
        ...(evalMatch?.id !== undefined ? { evaluationId: evalMatch.id } : {}),
      };
      group.requirements.push(req);
    }
  }

  // Finalize groups: compute deduplicated sourceUrls / sourceUrl, sort requirements, sort groups
  const groups: ProofContentGroup[] = [];
  for (const g of groupsByKey.values()) {
    const sourceUrls = Array.from(g.sourceUrlSet);
    const sourceUrl = sourceUrls[0] ?? g.sourceUrl ?? null;
    // Sort requirements deterministically by requirementName → deliverableId
    const sortedReqs = [...g.requirements].sort((a, b) => {
      if (a.requirementName !== b.requirementName) return a.requirementName.localeCompare(b.requirementName);
      return a.deliverableId.localeCompare(b.deliverableId);
    });
    const groupToPush: ProofContentGroup = {
      contentId: g.contentId,
      scanId: g.scanId,
      sourceUrl,
      sourceUrls,
      platform: g.platform,
      evidenceIds: [...g.evidenceIds],
      requirements: sortedReqs,
      ...(g.title !== undefined ? { title: g.title } : {}),
      ...(g.channelId !== undefined ? { channelId: g.channelId } : {}),
      ...(g.observedAt !== undefined ? { observedAt: g.observedAt } : {}),
    };
    groups.push(groupToPush);
  }

  // Deterministic group order: platform display order → observedAt → contentId (scanId secondary)
  groups.sort((a, b) => {
    const pa = platformOrderIndex.get(a.platform) ?? 99;
    const pb = platformOrderIndex.get(b.platform) ?? 99;
    if (pa !== pb) return pa - pb;
    if (a.observedAt && b.observedAt && a.observedAt !== b.observedAt) return a.observedAt.localeCompare(b.observedAt);
    if (a.observedAt && !b.observedAt) return -1;
    if (!a.observedAt && b.observedAt) return 1;
    if (a.contentId !== b.contentId) return a.contentId.localeCompare(b.contentId);
    return (a.scanId ?? "").localeCompare(b.scanId ?? "");
  });

  return groups;
}

/**
 * Requirement-centric projection — additive / reusable inverse view.
 * Groups by deliverable_id → content list. Preserves same invariants.
 */
export interface ProofRequirementGroup {
  readonly deliverableId: string;
  readonly requirementName: string;
  readonly items: readonly {
    readonly contentId: string;
    readonly scanId: string | null;
    readonly platform: Platform;
    readonly title?: string | undefined;
    readonly sourceUrl: string | null;
    readonly result: EvaluationResult;
    readonly reason?: string | undefined;
    readonly evidenceId: string;
  }[];
}

export function groupProofByDeliverable(
  evidence: readonly Evidence[],
  evaluations: readonly Evaluation[],
  deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>,
): ReadonlyArray<ProofRequirementGroup> {
  const contentGroups = groupProofByContent(evidence, evaluations, deliverableMap);
  const byDeliverable = new Map<string, Array<ProofRequirementGroup["items"][number]>>();

  for (const g of contentGroups) {
    for (const req of g.requirements) {
      const list = byDeliverable.get(req.deliverableId) ?? [];
      const item: ProofRequirementGroup["items"][number] = {
        contentId: g.contentId,
        scanId: g.scanId,
        platform: g.platform,
        sourceUrl: g.sourceUrl,
        result: req.result,
        evidenceId: req.evidenceId,
        ...(g.title !== undefined ? { title: g.title } : {}),
        ...(req.reason !== undefined ? { reason: req.reason } : {}),
      };
      list.push(item);
      byDeliverable.set(req.deliverableId, list);
    }
  }

  const out: ProofRequirementGroup[] = [];
  for (const [deliverableId, items] of byDeliverable.entries()) {
    out.push({
      deliverableId,
      requirementName: deliverableMap.get(deliverableId)?.name ?? "Requirement",
      items: [...items].sort((a, b) => a.contentId.localeCompare(b.contentId)),
    });
  }
  // Deterministic: sort by requirementName
  out.sort((a, b) => a.requirementName.localeCompare(b.requirementName));
  return out;
}
