import { describe, expect, it } from "vitest";
import { isPlatform } from "../types/platform";
import { getCapabilities } from "./capabilities";
import { validateRulesForPlatform, deliverableRuleSchema } from "../schemas/rules";
import { evaluateRule } from "./evaluator";
import { normalizeHashtag, normalizeText, parseTwitchDurationToSeconds, parseYouTubeDurationToSeconds } from "./normalization";
import { createInMemoryBudget } from "./budget";
import type { CanonicalLiveStream, CanonicalVideo } from "../types/observations";
import type { CanonicalCategory } from "../types/category";
import type { DeliverableRule } from "../schemas/rules";

function live(platform: "twitch" | "youtube" | "kick", overrides: Partial<CanonicalLiveStream> = {}): CanonicalLiveStream {
  const category: CanonicalCategory = { id: "123", name: "Game", platform };
  return {
    platform,
    externalStreamId: "s1",
    externalChannelId: "c1",
    channelHandle: "handle",
    title: "Test Title #OurBrand",
    category,
    tags: [],
    startedAt: "2026-03-10T14:00:00Z",
    observedAt: "2026-03-10T14:05:00Z",
    canonicalUrl: `https://example.com/${platform}`,
    isLive: true,
    description: "desc #OurBrand",
    ...overrides,
  };
}

function video(platform: "twitch" | "youtube", overrides: Partial<CanonicalVideo> = {}): CanonicalVideo {
  const category: CanonicalCategory = { id: "123", name: "Game", platform };
  return {
    platform,
    externalVideoId: "v1",
    externalChannelId: "c1",
    channelHandle: "handle",
    title: "VOD Title",
    description: "vod description",
    category,
    tags: [],
    startedAt: "2026-03-10T14:00:00Z",
    publishedAt: "2026-03-10T16:00:00Z",
    endedAt: "2026-03-10T16:00:00Z",
    durationSeconds: 7200,
    canonicalUrl: `https://example.com/${platform}/v1`,
    observedAt: "2026-03-10T16:05:00Z",
    viewable: true,
    ...overrides,
  };
}

describe("platform", () => {
  it("accepts valid platforms", () => {
    expect(isPlatform("twitch")).toBe(true);
    expect(isPlatform("youtube")).toBe(true);
    expect(isPlatform("kick")).toBe(true);
  });
  it("rejects invalid platforms", () => {
    expect(isPlatform("facebook")).toBe(false);
    expect(isPlatform("")).toBe(false);
    expect(isPlatform(null)).toBe(false);
    expect(isPlatform(undefined)).toBe(false);
  });
});

describe("normalization", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeText("  #OurBrand  CUP  ")).toBe("#ourbrand cup");
  });
  it("normalizes hashtag with leading #", () => {
    expect(normalizeHashtag("OurBrand")).toBe("#ourbrand");
    expect(normalizeHashtag("#OurBrand")).toBe("#ourbrand");
    expect(normalizeHashtag("  #OurBrand  ")).toBe("#ourbrand");
  });
  it("parses twitch durations", () => {
    expect(parseTwitchDurationToSeconds("2h34m12s")).toBe(2 * 3600 + 34 * 60 + 12);
    expect(parseTwitchDurationToSeconds("45m")).toBe(2700);
    expect(parseTwitchDurationToSeconds("30s")).toBe(30);
  });
  it("parses youtube durations", () => {
    expect(parseYouTubeDurationToSeconds("PT1H2M3S")).toBe(3723);
    expect(parseYouTubeDurationToSeconds("PT15M51S")).toBe(951);
  });
});

describe("capabilities", () => {
  it("twitch supports vod", () => {
    expect(getCapabilities("twitch").vodExistence).toBe(true);
    expect(getCapabilities("twitch").vodDuration).toBe(true);
  });
  it("youtube supports vod", () => {
    expect(getCapabilities("youtube").vodExistence).toBe(true);
  });
  it("kick does not support vod", () => {
    expect(getCapabilities("kick").vodExistence).toBe(false);
    expect(getCapabilities("kick").vodDuration).toBe(false);
    expect(getCapabilities("kick").vodDescription).toBe(false);
  });
  it("kick tag sources are kick variants", () => {
    expect(getCapabilities("kick").tagSources).toEqual(["kick", "kick_custom"]);
  });
});

describe("rules validation", () => {
  it("accepts valid twitch tag on twitch", () => {
    const rules: DeliverableRule[] = [{ type: "required_twitch_tag", tag_id: "English" }];
    expect(validateRulesForPlatform("twitch", rules).valid).toBe(true);
  });
  it("rejects twitch tag on youtube", () => {
    const rules: DeliverableRule[] = [{ type: "required_twitch_tag", tag_id: "English" }];
    const res = validateRulesForPlatform("youtube", rules);
    expect(res.valid).toBe(false);
    expect(res.errors[0]?.reason).toMatch(/twitch/);
  });
  it("rejects youtube tags on kick", () => {
    const rules: DeliverableRule[] = [{ type: "required_youtube_tags", tags: ["a"] }];
    expect(validateRulesForPlatform("kick", rules).valid).toBe(false);
  });
  it("rejects minimum_duration on kick", () => {
    const rules: DeliverableRule[] = [{ type: "minimum_duration", minutes: 60 }];
    expect(validateRulesForPlatform("kick", rules).valid).toBe(false);
  });
  it("rejects vod_exists on kick", () => {
    const rules: DeliverableRule[] = [{ type: "required_vod_exists" }];
    expect(validateRulesForPlatform("kick", rules).valid).toBe(false);
  });
  it("rejects kick tags on twitch", () => {
    const rules: DeliverableRule[] = [{ type: "required_kick_tags", tags: ["x"] }];
    expect(validateRulesForPlatform("twitch", rules).valid).toBe(false);
  });
  it("accepts platform-neutral rules on any platform", () => {
    const rules: DeliverableRule[] = [
      { type: "required_title_contains", value: "hello" },
      { type: "required_hashtag", value: "#brand" },
    ];
    expect(validateRulesForPlatform("kick", rules).valid).toBe(true);
    expect(validateRulesForPlatform("twitch", rules).valid).toBe(true);
  });
  it("validates rule schema rejects empty", () => {
    expect(() => deliverableRuleSchema.parse({ type: "required_title_contains", value: "" })).toThrow();
  });
});

describe("evaluation - five states", () => {
  it("PASS title contains", () => {
    const rule: DeliverableRule = { type: "required_title_contains", value: "ourbrand" };
    const res = evaluateRule(rule, "twitch", { kind: "live", data: live("twitch", { title: "Epic #OurBrand Cup" }) });
    expect(res.result).toBe("PASS");
  });
  it("FAIL title missing", () => {
    const rule: DeliverableRule = { type: "required_title_contains", value: "missing" };
    const res = evaluateRule(rule, "twitch", { kind: "live", data: live("twitch", { title: "hello world" }) });
    expect(res.result).toBe("FAIL");
  });
  it("NOT_VERIFIABLE category missing", () => {
    const rule: DeliverableRule = { type: "required_category", categoryId: "123" };
    const res = evaluateRule(rule, "twitch", { kind: "live", data: live("twitch", { category: null }) });
    expect(res.result).toBe("NOT_VERIFIABLE");
  });
  it("PENDING when no observation", () => {
    const rule: DeliverableRule = { type: "required_title_contains", value: "x" };
    expect(evaluateRule(rule, "twitch", { kind: "none" }).result).toBe("PENDING");
    expect(evaluateRule(rule, "twitch", { kind: "live", data: null }).result).toBe("PENDING");
  });
  it("NOT_SUPPORTED kick vod duration", () => {
    const rule: DeliverableRule = { type: "minimum_duration", minutes: 60 };
    expect(evaluateRule(rule, "kick", { kind: "video", data: video("twitch") }).result).toBe("NOT_SUPPORTED");
  });
  it("NOT_SUPPORTED kick vod exists", () => {
    const rule: DeliverableRule = { type: "required_vod_exists" };
    expect(evaluateRule(rule, "kick", { kind: "none" }).result).toBe("NOT_SUPPORTED");
  });
  it("NOT_SUPPORTED twitch tag on youtube", () => {
    const rule: DeliverableRule = { type: "required_twitch_tag", tag_id: "English" };
    expect(evaluateRule(rule, "youtube", { kind: "live", data: live("youtube") }).result).toBe("NOT_SUPPORTED");
  });
  it("PASS hashtag case-insensitive", () => {
    const rule: DeliverableRule = { type: "required_hashtag", value: "#OurBrand" };
    const res = evaluateRule(rule, "kick", { kind: "live", data: live("kick", { title: "live #ourbrand event" }) });
    expect(res.result).toBe("PASS");
  });
  it("FAIL hashtag missing", () => {
    const rule: DeliverableRule = { type: "required_hashtag", value: "#brand" };
    const res = evaluateRule(rule, "twitch", { kind: "live", data: live("twitch", { title: "no tag here" }) });
    expect(res.result).toBe("FAIL");
  });
  it("PASS category", () => {
    const rule: DeliverableRule = { type: "required_category", categoryId: "123" };
    expect(evaluateRule(rule, "twitch", { kind: "live", data: live("twitch") }).result).toBe("PASS");
  });
  it("FAIL category mismatch", () => {
    const rule: DeliverableRule = { type: "required_category", categoryId: "999" };
    expect(evaluateRule(rule, "twitch", { kind: "live", data: live("twitch") }).result).toBe("FAIL");
  });
  it("PASS minimum_duration when enough", () => {
    const rule: DeliverableRule = { type: "minimum_duration", minutes: 60 };
    expect(evaluateRule(rule, "youtube", { kind: "video", data: video("youtube", { durationSeconds: 4000 }) }).result).toBe("PASS");
  });
  it("FAIL minimum_duration when short", () => {
    const rule: DeliverableRule = { type: "minimum_duration", minutes: 120 };
    expect(evaluateRule(rule, "twitch", { kind: "video", data: video("twitch", { durationSeconds: 3600 }) }).result).toBe("FAIL");
  });
  it("NOT_VERIFIABLE description missing", () => {
    const rule: DeliverableRule = { type: "required_description_contains", value: "sponsor" };
    expect(evaluateRule(rule, "twitch", { kind: "live", data: live("twitch", { description: null }) }).result).toBe("NOT_VERIFIABLE");
  });
  it("PASS description contains", () => {
    const rule: DeliverableRule = { type: "required_description_contains", value: "sponsor" };
    expect(evaluateRule(rule, "youtube", { kind: "live", data: live("youtube", { description: "Visit sponsor link" }) }).result).toBe("PASS");
  });
  it("NOT_VERIFIABLE minimum_duration on live not video", () => {
    const rule: DeliverableRule = { type: "minimum_duration", minutes: 10 };
    expect(evaluateRule(rule, "twitch", { kind: "live", data: live("twitch") }).result).toBe("NOT_VERIFIABLE");
  });
});

describe("budget", () => {
  it("tracks remaining and cost", () => {
    const b = createInMemoryBudget({ platform: "twitch", limit: 800, windowMs: 60_000 });
    expect(b.canConsume(1).allowed).toBe(true);
    const c = b.consume(1);
    expect(c.remaining).toBe(799);
    expect(b.canConsume(800).allowed).toBe(false);
  });
  it("insufficient budget returns retryAfter", () => {
    const b = createInMemoryBudget({ platform: "youtube", limit: 5, windowMs: 60_000 }, 1);
    const check = b.canConsume(2);
    expect(check.allowed).toBe(false);
    expect(check.retryAfter).not.toBeNull();
    expect(check.remaining).toBe(1);
  });
  it("reset after window", () => {
    const b = createInMemoryBudget({ platform: "kick", limit: 10, windowMs: 60_000 }, 0);
    expect(b.canConsume(1).allowed).toBe(false);
    const future = new Date(Date.now() + 61_000).toISOString();
    b.resetIfNeeded(future);
    expect(b.canConsume(1).allowed).toBe(true);
  });
});
