import { describe, expect, it } from "vitest";
import { groupEvidenceByPlatform } from "./proof-grouping";
import type { Evidence } from "@/types/database";

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
