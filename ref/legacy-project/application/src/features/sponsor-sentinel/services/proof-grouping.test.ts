import { describe, expect, it } from "vitest";
import { groupEvidenceByPlatform, groupProofByContent, groupProofByDeliverable } from "./proof-grouping";
import type { Evidence, Evaluation } from "@/types/database";

function ev(platform: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: `ev-${Math.random()}`,
    organization_id: "org-a",
    campaign_id: "camp-a",
    deliverable_id: "del-a",
    platform: platform as Evidence["platform"],
    external_channel_id: "ch-1",
    external_content_id: "cnt-1",
    evidence_type: "video",
    source: "get_videos",
    source_id: "src-1",
    source_url: "https://example.com",
    observed_at: "2026-10-02T12:00:00Z",
    observed_value: "SPONSOR-TEST",
    normalized_value: "sponsor-test",
    raw_ref: null,
    scanner_version: "v1",
    scan_id: "scan-1",
    created_at: new Date().toISOString(),
    ...overrides,
  } as Evidence;
}

describe("proof-grouping — platform-specific Proof sections", () => {
  it("1. single-platform proof → Twitch Proofs (1) only", () => {
    const grouped = groupEvidenceByPlatform([ev("twitch")]);
    expect(grouped.length).toBe(1);
    expect(grouped[0]!.platform).toBe("twitch");
    expect(grouped[0]!.items.length).toBe(1);
  });

  it("2. multi-platform proof → YouTube(2) Twitch(1) Kick(1)", () => {
    const evidence = [ev("youtube", { id: "1" }), ev("youtube", { id: "2" }), ev("twitch", { id: "3" }), ev("kick", { id: "4" })];
    const grouped = groupEvidenceByPlatform(evidence);
    expect(grouped.map((g) => `${g.platform}:${g.items.length}`)).toEqual(["youtube:2", "twitch:1", "kick:1"]);
  });

  it("3. empty proof → no sections", () => {
    expect(groupEvidenceByPlatform([]).length).toBe(0);
  });

  it("4. platform ordering deterministic YouTube Twitch Kick regardless of input order", () => {
    const evidence = [ev("kick", { id: "k" }), ev("youtube", { id: "y" }), ev("twitch", { id: "t" })];
    const grouped = groupEvidenceByPlatform(evidence);
    expect(grouped.map((g) => g.platform)).toEqual(["youtube", "twitch", "kick"]);
  });

  it("5. platform comes from evidence.platform not URL/title/source", () => {
    const tricky = ev("twitch", { id: "x", source_url: "https://youtube.com/watch?v=abc", observed_value: "youtube video", source: "youtube_videos_list" });
    // Even though URL/title/source hint youtube, grouping must be twitch
    const grouped = groupEvidenceByPlatform([tricky]);
    expect(grouped[0]!.platform).toBe("twitch");
    expect(grouped[0]!.items[0]!.source_url).toBe("https://youtube.com/watch?v=abc");
  });

  it("6. no empty sections for missing platform", () => {
    const grouped = groupEvidenceByPlatform([ev("twitch")]);
    expect(grouped.some((g) => g.platform === "youtube")).toBe(false);
    expect(grouped.some((g) => g.platform === "kick")).toBe(false);
  });
});

function evWithContent(
  externalContentId: string | null,
  deliverableId: string,
  scanId = "scan-1",
  platform: Evidence["platform"] = "youtube",
  overrides: Partial<Evidence> = {},
): Evidence {
  return ev(platform, {
    external_content_id: externalContentId,
    deliverable_id: deliverableId,
    scan_id: scanId,
    id: `ev-${externalContentId ?? "null"}-${deliverableId}-${scanId}-${Math.random().toString(36).slice(2, 6)}`,
    source_url: `https://youtube.com/watch?v=${externalContentId ?? "novideo"}`,
    observed_value: `Title for ${externalContentId ?? "null"}`,
    ...overrides,
  });
}

function mkEval(evidenceId: string, deliverableId: string, result: Evaluation["result"], scanId = "scan-1", reason = `${result} reason`): Evaluation {
  return {
    id: `eval-${evidenceId}`,
    organization_id: "org-a",
    evidence_id: evidenceId,
    deliverable_id: deliverableId,
    result,
    reason,
    evaluated_at: "2026-10-02T12:00:00Z",
    evaluator_version: "1",
    scan_id: scanId,
    created_at: "2026-10-02T12:00:00Z",
  };
}

function deliverableMapFor(ids: string[]) {
  const m = new Map<string, { name: string; rule: unknown }>();
  for (const id of ids) m.set(id, { name: `Requirement ${id}`, rule: {} });
  // Alias R1,R2,R4 to readable
  if (m.has("R1")) m.set("R1", { name: "Requirement 1", rule: {} });
  if (m.has("R2")) m.set("R2", { name: "Requirement 2", rule: {} });
  if (m.has("R4")) m.set("R4", { name: "Requirement 4", rule: {} });
  if (m.has("del-a")) m.set("del-a", { name: "Requirement A", rule: {} });
  return m;
}

describe("proof-grouping — content-centric (RCCF-SPONSOR-PROOF-UI-01)", () => {
  it("Test 1 — Same content, multiple requirements → 1 content group, 2 requirements", () => {
    const e1 = evWithContent("video-A", "R1");
    const e2 = evWithContent("video-A", "R4");
    const eval1 = mkEval(e1.id, "R1", "PASS");
    const eval2 = mkEval(e2.id, "R4", "PASS");
    const groups = groupProofByContent([e1, e2], [eval1, eval2], deliverableMapFor(["R1", "R4"]));
    expect(groups.length).toBe(1);
    expect(groups[0]!.contentId).toBe("video-A");
    expect(groups[0]!.requirements.length).toBe(2);
    expect(groups[0]!.requirements.map((r) => r.deliverableId).sort()).toEqual(["R1", "R4"]);
    // Must not render Video X twice
    expect(groups.filter((g) => g.contentId === "video-A").length).toBe(1);
  });

  it("Test 2 — Different content, same requirement → 2 content groups, each contains R1", () => {
    const e1 = evWithContent("video-A", "R1");
    const e2 = evWithContent("video-B", "R1");
    const eval1 = mkEval(e1.id, "R1", "PASS");
    const eval2 = mkEval(e2.id, "R1", "PASS");
    const groups = groupProofByContent([e1, e2], [eval1, eval2], deliverableMapFor(["R1"]));
    expect(groups.length).toBe(2);
    const a = groups.find((g) => g.contentId === "video-A")!;
    const b = groups.find((g) => g.contentId === "video-B")!;
    expect(a.requirements.length).toBe(1);
    expect(a.requirements[0]!.deliverableId).toBe("R1");
    expect(b.requirements.length).toBe(1);
    expect(b.requirements[0]!.deliverableId).toBe("R1");
  });

  it("Test 3 — Mixed matrix A+R1 A+R4 B+R2 C+R1 C+R2 C+R4", () => {
    const eA1 = evWithContent("A", "R1");
    const eA4 = evWithContent("A", "R4");
    const eB2 = evWithContent("B", "R2");
    const eC1 = evWithContent("C", "R1");
    const eC2 = evWithContent("C", "R2");
    const eC4 = evWithContent("C", "R4");
    const evidence = [eA1, eA4, eB2, eC1, eC2, eC4];
    const evaluations = [
      mkEval(eA1.id, "R1", "PASS"),
      mkEval(eA4.id, "R4", "PASS"),
      mkEval(eB2.id, "R2", "PASS"),
      mkEval(eC1.id, "R1", "PASS"),
      mkEval(eC2.id, "R2", "PASS"),
      mkEval(eC4.id, "R4", "PASS"),
    ];
    const groups = groupProofByContent(evidence, evaluations, deliverableMapFor(["R1", "R2", "R4"]));
    expect(groups.length).toBe(3);
    const byId = new Map(groups.map((g) => [g.contentId, g] as const));
    expect(byId.get("A")!.requirements.map((r) => r.deliverableId).sort()).toEqual(["R1", "R4"]);
    expect(byId.get("B")!.requirements.map((r) => r.deliverableId).sort()).toEqual(["R2"]);
    expect(byId.get("C")!.requirements.map((r) => r.deliverableId).sort()).toEqual(["R1", "R2", "R4"]);
  });

  it("Test 4 — Evaluation result preservation (PASS FAIL PENDING NOT_SUPPORTED untouched)", () => {
    const ePass = evWithContent("v-pass", "R1");
    const eFail = evWithContent("v-fail", "R1");
    const ePending = evWithContent("v-pending", "R1");
    const eNotSupported = evWithContent("v-ns", "R1");
    const evaluations = [
      mkEval(ePass.id, "R1", "PASS"),
      mkEval(eFail.id, "R1", "FAIL"),
      mkEval(ePending.id, "R1", "PENDING"),
      mkEval(eNotSupported.id, "R1", "NOT_SUPPORTED"),
    ];
    const groups = groupProofByContent([ePass, eFail, ePending, eNotSupported], evaluations, deliverableMapFor(["R1"]));
    const byContent = new Map(groups.map((g) => [g.contentId, g.requirements[0]!.result] as const));
    expect(byContent.get("v-pass")).toBe("PASS");
    expect(byContent.get("v-fail")).toBe("FAIL");
    expect(byContent.get("v-pending")).toBe("PENDING");
    expect(byContent.get("v-ns")).toBe("NOT_SUPPORTED");
    // No conversion: ensure PASS not turned into FAIL etc
    expect(groups.flatMap((g) => g.requirements.map((r) => r.result)).sort()).toEqual(["FAIL", "NOT_SUPPORTED", "PASS", "PENDING"].sort());
  });

  it("Test 5 — Same external_content_id across different Checks must not merge (scan isolation)", () => {
    const eScan1 = evWithContent("video-A", "R1", "scan-1");
    const eScan2 = evWithContent("video-A", "R1", "scan-2");
    const eval1 = mkEval(eScan1.id, "R1", "PASS", "scan-1");
    const eval2 = mkEval(eScan2.id, "R1", "PASS", "scan-2");
    // Grouping called per-check preserves isolation — simulate unified call with mixed scan_ids
    const groups = groupProofByContent([eScan1, eScan2], [eval1, eval2], deliverableMapFor(["R1"]));
    // Must be 2 independent groups because scan_id is part of key
    expect(groups.length).toBe(2);
    expect(groups[0]!.scanId).not.toBe(groups[1]!.scanId);
    expect(groups.every((g) => g.contentId === "video-A")).toBe(true);
    expect(groups.every((g) => g.requirements.length === 1)).toBe(true);
    // Also verify per-check grouping individually
    const g1 = groupProofByContent([eScan1], [eval1], deliverableMapFor(["R1"]));
    const g2 = groupProofByContent([eScan2], [eval2], deliverableMapFor(["R1"]));
    expect(g1.length).toBe(1);
    expect(g2.length).toBe(1);
    expect(g1[0]!.scanId).toBe("scan-1");
    expect(g2[0]!.scanId).toBe("scan-2");
  });

  it("Test 6 — Source URL deduplication: same URL repeated → one sourceUrl/link", () => {
    const url = "https://youtube.com/watch?v=video-A";
    const e1 = evWithContent("video-A", "R1", "scan-1", "youtube", { source_url: url });
    const e2 = evWithContent("video-A", "R2", "scan-1", "youtube", { source_url: url });
    const eval1 = mkEval(e1.id, "R1", "PASS");
    const eval2 = mkEval(e2.id, "R2", "PASS");
    const groups = groupProofByContent([e1, e2], [eval1, eval2], deliverableMapFor(["R1", "R2"]));
    expect(groups.length).toBe(1);
    expect(groups[0]!.sourceUrls.length).toBe(1);
    expect(groups[0]!.sourceUrl).toBe(url);
    expect(groups[0]!.sourceUrls[0]).toBe(url);
    // Requirements still 2 but link deduplicated
    expect(groups[0]!.requirements.length).toBe(2);
  });

  it("Test 7 — Requirement isolation: video-A+R1, video-B+R2 must not produce video-A→R1,R2", () => {
    const eA = evWithContent("video-A", "R1", "scan-1", "youtube", { observed_value: "Video A" });
    const eB = evWithContent("video-B", "R2", "scan-1", "youtube", { observed_value: "Video B" });
    const evalA = mkEval(eA.id, "R1", "PASS");
    const evalB = mkEval(eB.id, "R2", "PASS");
    const groups = groupProofByContent([eA, eB], [evalA, evalB], deliverableMapFor(["R1", "R2"]));
    expect(groups.length).toBe(2);
    const gA = groups.find((g) => g.contentId === "video-A")!;
    const gB = groups.find((g) => g.contentId === "video-B")!;
    expect(gA.requirements.map((r) => r.deliverableId)).toEqual(["R1"]);
    expect(gB.requirements.map((r) => r.deliverableId)).toEqual(["R2"]);
    expect(gA.requirements.some((r) => r.deliverableId === "R2")).toBe(false);
    expect(gB.requirements.some((r) => r.deliverableId === "R1")).toBe(false);
  });

  it("null external_content_id → each evidence is own group (no false merge by title/URL)", () => {
    const e1 = evWithContent(null, "R1", "scan-1", "youtube", { source_url: "https://example.com/same", observed_value: "Same Title" });
    const e2 = evWithContent(null, "R1", "scan-1", "youtube", { source_url: "https://example.com/same", observed_value: "Same Title" });
    // Same title and URL but null contentId must not merge — fallback to evidence.id
    const groups = groupProofByContent([e1, e2], [mkEval(e1.id, "R1", "PASS"), mkEval(e2.id, "R1", "PASS")], deliverableMapFor(["R1"]));
    expect(groups.length).toBe(2);
  });

  it("platform preserved per content group", () => {
    const eYt = evWithContent("v1", "R1", "scan-1", "youtube");
    const eTw = evWithContent("v2", "R1", "scan-1", "twitch");
    const groups = groupProofByContent([eYt, eTw], [mkEval(eYt.id, "R1", "PASS"), mkEval(eTw.id, "R1", "PASS")], deliverableMapFor(["R1"]));
    const yt = groups.find((g) => g.contentId === "v1")!;
    const tw = groups.find((g) => g.contentId === "v2")!;
    expect(yt.platform).toBe("youtube");
    expect(tw.platform).toBe("twitch");
  });

  it("requirement-centric projection additive: deliverable → content list", () => {
    const eA1 = evWithContent("A", "R1");
    const eA4 = evWithContent("A", "R4");
    const eB2 = evWithContent("B", "R2");
    const evidence = [eA1, eA4, eB2];
    const evaluations = [mkEval(eA1.id, "R1", "PASS"), mkEval(eA4.id, "R4", "PASS"), mkEval(eB2.id, "R2", "PASS")];
    const byReq = groupProofByDeliverable(evidence, evaluations, deliverableMapFor(["R1", "R2", "R4"]));
    const r1 = byReq.find((r) => r.deliverableId === "R1")!;
    const r4 = byReq.find((r) => r.deliverableId === "R4")!;
    expect(r1.items.map((i) => i.contentId)).toEqual(["A"]);
    expect(r4.items.map((i) => i.contentId)).toEqual(["A"]);
    expect(byReq.find((r) => r.deliverableId === "R2")!.items[0]!.contentId).toBe("B");
  });
});
