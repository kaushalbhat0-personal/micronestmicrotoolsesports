import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ContentProofSections } from "./content-proof-sections";
import type { Evidence, Evaluation } from "@/types/database";

function ev(platform: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    organization_id: "org-a",
    campaign_id: "camp-a",
    deliverable_id: "R1",
    platform: platform as Evidence["platform"],
    external_channel_id: "ch-1",
    external_content_id: "cnt-A",
    evidence_type: "video",
    source: "get_videos",
    source_id: "src-1",
    source_url: "https://youtube.com/watch?v=cnt-A",
    observed_at: "2026-10-02T12:00:00Z",
    observed_value: "Video A Title",
    normalized_value: "video a title",
    raw_ref: null,
    scanner_version: "v1",
    scan_id: "scan-1",
    created_at: new Date().toISOString(),
    ...overrides,
  } as unknown as Evidence;
}

function mkEval(evidenceId: string, deliverableId: string, result: Evaluation["result"]): Evaluation {
  return {
    id: `eval-${evidenceId}`,
    organization_id: "org-a",
    evidence_id: evidenceId,
    deliverable_id: deliverableId,
    result,
    reason: `${result} reason`,
    evaluated_at: "2026-10-02T12:00:00Z",
    evaluator_version: "1",
    scan_id: "scan-1",
    created_at: "2026-10-02T12:00:00Z",
  };
}

const map = new Map<string, { name: string; rule: unknown }>([
  ["R1", { name: "Requirement 1", rule: {} }],
  ["R2", { name: "Requirement 2", rule: {} }],
  ["R4", { name: "Requirement 4", rule: {} }],
]);

describe("ContentProofSections — content-centric UI", () => {
  it("same content multiple requirements → one content card with 2 requirements, not duplicated video", () => {
    const e1 = ev("youtube", { id: "e1", external_content_id: "video-A", deliverable_id: "R1", observed_value: "Video A" });
    const e2 = ev("youtube", { id: "e2", external_content_id: "video-A", deliverable_id: "R4", observed_value: "Video A" });
    const evaluations = [mkEval(e1.id, "R1", "PASS"), mkEval(e2.id, "R4", "PASS")];
    const html = renderToString(<ContentProofSections evidence={[e1, e2]} evaluations={evaluations} deliverableMap={map} />);
    expect(html).toContain("Requirement 1");
    expect(html).toContain("Requirement 4");
    // Only one content group element (aria-label per group)
    const groups = (html.match(/content video-A/g) ?? []).length;
    expect(groups).toBe(1);
    // Source URL deduplicated to one href (anchor) — count href attr occurrences
    const hrefs = (html.match(/https:\/\/youtube\.com\/watch\?v=cnt-A/g) ?? []).length;
    expect(hrefs).toBe(1);
    // View source anchor appears once per group — aria-label + text = 2 matches per anchor, so 2 for 1 group
    const viewSourceCount = (html.match(/View source/g) ?? []).length;
    expect(viewSourceCount).toBe(2);
    // Title "Video A" appears in header and aria-labels — ensure not duplicated as multiple cards (max 3 incl aria)
    const countVideoA = (html.match(/Video A/g) ?? []).length;
    expect(countVideoA).toBeLessThan(5);
  });

  it("different content same requirement → two content groups each with Requirement 1", () => {
    const eA = ev("youtube", { id: "eA", external_content_id: "A", deliverable_id: "R1", observed_value: "Video A" });
    const eB = ev("youtube", { id: "eB", external_content_id: "B", deliverable_id: "R1", observed_value: "Video B" });
    const evaluations = [mkEval(eA.id, "R1", "PASS"), mkEval(eB.id, "R1", "PASS")];
    const html = renderToString(<ContentProofSections evidence={[eA, eB]} evaluations={evaluations} deliverableMap={map} />);
    expect(html).toContain("Video A");
    expect(html).toContain("Video B");
    // Requirement 1 appears twice per group (title attr + text) → 4 total for 2 groups
    const bothReq = (html.match(/Requirement 1/g) ?? []).length;
    expect(bothReq).toBe(4);
    // Verify two content groups via aria-label count
    const groupCount = (html.match(/content [AB]/g) ?? []).length;
    expect(groupCount).toBe(2);
  });

  it("result semantics preserved: PASS, FAIL, PENDING, NOT_SUPPORTED distinct", () => {
    const ePass = ev("youtube", { id: "e1", external_content_id: "v-pass", deliverable_id: "R1", observed_value: "V pass" });
    const eFail = ev("youtube", { id: "e2", external_content_id: "v-fail", deliverable_id: "R1", observed_value: "V fail" });
    const ePend = ev("youtube", { id: "e3", external_content_id: "v-pend", deliverable_id: "R1", observed_value: "V pend" });
    const eNs = ev("youtube", { id: "e4", external_content_id: "v-ns", deliverable_id: "R1", observed_value: "V ns" });
    const evals = [mkEval(ePass.id, "R1", "PASS"), mkEval(eFail.id, "R1", "FAIL"), mkEval(ePend.id, "R1", "PENDING"), mkEval(eNs.id, "R1", "NOT_SUPPORTED")];
    const html = renderToString(<ContentProofSections evidence={[ePass, eFail, ePend, eNs]} evaluations={evals} deliverableMap={map} />);
    // StatusBadge renders labels Confirmed/Not found/Checking/Not applicable but aria-label contains result
    expect(html).toContain("PASS");
    expect(html).toContain("FAIL");
    expect(html).toContain("PENDING");
    expect(html).toContain("NOT_SUPPORTED");
  });

  it("source URL deduplication — same URL for same content shows one link", () => {
    const url = "https://youtube.com/watch?v=same";
    const e1 = ev("youtube", { id: "e1", external_content_id: "vid", deliverable_id: "R1", source_url: url, observed_value: "Vid" });
    const e2 = ev("youtube", { id: "e2", external_content_id: "vid", deliverable_id: "R2", source_url: url, observed_value: "Vid" });
    const evals = [mkEval(e1.id, "R1", "PASS"), mkEval(e2.id, "R2", "PASS")];
    const html = renderToString(<ContentProofSections evidence={[e1, e2]} evaluations={evals} deliverableMap={new Map([["R1", { name: "Requirement 1", rule: {} }], ["R2", { name: "Requirement 2", rule: {} }]])} />);
    const hrefCount = (html.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    expect(hrefCount).toBe(1);
  });

  it("platform badge preserved per content", () => {
    const eYt = ev("youtube", { id: "y", external_content_id: "yt-vid", observed_value: "YT Video" });
    const eTw = ev("twitch", { id: "t", external_content_id: "tw-vid", observed_value: "TW Video" });
    const evals = [mkEval(eYt.id, "R1", "PASS"), mkEval(eTw.id, "R1", "PASS")];
    const html = renderToString(<ContentProofSections evidence={[eYt, eTw]} evaluations={evals} deliverableMap={map} />);
    expect(html).toContain("YouTube");
    expect(html).toContain("Twitch");
  });

  it("long title does not break layout — break-words and title attr", () => {
    const long = "A".repeat(200) + " Very Long Video Title That Should Break Words And Not Overflow";
    const e = ev("youtube", { id: "long", external_content_id: "long-id", observed_value: long });
    const evals = [mkEval(e.id, "R1", "PASS")];
    const html = renderToString(<ContentProofSections evidence={[e]} evaluations={evals} deliverableMap={map} />);
    expect(html).toContain("break-words");
    expect(html).toContain(long.slice(0, 20));
  });

  it("empty evidence → EmptyState", () => {
    const html = renderToString(<ContentProofSections evidence={[]} evaluations={[]} deliverableMap={map} />);
    expect(html).toContain("No proof yet");
  });
});
