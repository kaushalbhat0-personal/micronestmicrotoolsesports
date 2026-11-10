import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PlatformProofSections } from "./platform-proof-sections";
import type { Evidence } from "@/types/database";

function ev(platform: string, overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    organization_id: "org-a",
    campaign_id: "camp-a",
    deliverable_id: "del-a",
    platform: platform as Evidence["platform"],
    external_channel_id: "ch-1",
    external_content_id: "cnt-1",
    evidence_type: "video",
    source: "get_videos",
    source_id: "src-1",
    source_url: "https://twitch.tv/videos/123",
    observed_at: "2026-10-02T12:00:00Z",
    observed_value: "SPONSOR-TEST Twitch Integration",
    normalized_value: "sponsor-test twitch integration",
    raw_ref: null,
    scanner_version: "v1",
    scan_id: "scan-1",
    created_at: new Date().toISOString(),
    ...overrides,
  } as Evidence;
}

const map = new Map<string, { name: string; rule: unknown }>([["del-a", { name: "Title contains SPONSOR-TEST", rule: {} }]]);

describe("PlatformProofSections — UX", () => {
  it("renders single platform section Twitch Proofs (1)", () => {
    const html = renderToString(<PlatformProofSections evidence={[ev("twitch", { id: "1" })]} deliverableMap={map} />);
    expect(html).toContain("Twitch Proofs (1)");
    expect(html).not.toContain("YouTube Proofs");
    expect(html).not.toContain("Kick Proofs");
  });

  it("renders multi-platform sections in YouTube Twitch Kick order", () => {
    const evidence = [ev("kick", { id: "k" }), ev("youtube", { id: "y1" }), ev("youtube", { id: "y2" }), ev("twitch", { id: "t" })];
    const html = renderToString(<PlatformProofSections evidence={evidence} deliverableMap={map} />);
    const youIdx = html.indexOf("YouTube Proofs");
    const twIdx = html.indexOf("Twitch Proofs");
    const kickIdx = html.indexOf("Kick Proofs");
    expect(youIdx).toBeGreaterThan(-1);
    expect(twIdx).toBeGreaterThan(youIdx);
    expect(kickIdx).toBeGreaterThan(twIdx);
    expect(html).toContain("YouTube Proofs (2)");
    expect(html).toContain("Kick Proofs (1)");
  });

  it("empty proof → No proof yet, no platform sections", () => {
    const html = renderToString(<PlatformProofSections evidence={[]} deliverableMap={map} />);
    expect(html).toContain("No proof yet");
    expect(html).not.toContain("Proofs (");
  });

  it("existing proof fields remain visible", () => {
    const html = renderToString(<PlatformProofSections evidence={[ev("twitch", { observed_value: "My Brand Video", source_url: "https://twitch.tv/v/1", observed_at: "2026-10-02T11:28:08Z" })]} deliverableMap={map} />);
    expect(html).toContain("My Brand Video");
    expect(html).toContain("Title contains SPONSOR-TEST");
    expect(html).toContain("https://twitch.tv/v/1");
    expect(html).toContain("2026"); // timestamp rendered via Kolkata
  });

  it("accessibility — section control has accessible name and is keyboard focusable (summary)", () => {
    const html = renderToString(<PlatformProofSections evidence={[ev("youtube", { id: "y" }), ev("twitch", { id: "t" })]} deliverableMap={map} />);
    // <summary> is natively keyboard accessible, aria-label contains platform and count
    expect(html).toContain('aria-label="YouTube Proofs (1)"');
    expect(html).toContain('aria-label="Twitch Proofs (1)"');
    expect(html).toContain("<summary");
    expect(html).toContain("<details");
  });

  it("uses evidence.platform not source URL", () => {
    const tricky = ev("twitch", { id: "x", source_url: "https://youtube.com/watch?v=999", observed_value: "youtube-like title", source: "youtube_videos_list" as Evidence["source"] });
    const html = renderToString(<PlatformProofSections evidence={[tricky]} deliverableMap={map} />);
    expect(html).toContain("Twitch Proofs (1)");
    expect(html).not.toContain("YouTube Proofs");
  });
});
