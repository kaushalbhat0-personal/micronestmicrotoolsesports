import { describe, expect, it } from "vitest";
import { formatRequirementDescription } from "./requirement-description";

describe("formatRequirementDescription", () => {
  it("required_title_contains", () => {
    expect(formatRequirementDescription({ type: "required_title_contains", value: "#OurBrand" })).toBe("Title contains #OurBrand");
  });
  it("required_hashtag", () => {
    expect(formatRequirementDescription({ type: "required_hashtag", value: "#Esports" })).toBe("Includes #Esports");
  });
  it("required_youtube_tags single", () => {
    expect(formatRequirementDescription({ type: "required_youtube_tags", tags: ["#Esports"] })).toBe("YouTube tags include #Esports");
  });
  it("required_youtube_tags multiple", () => {
    expect(formatRequirementDescription({ type: "required_youtube_tags", tags: ["#Esports", "#OurBrand"] })).toBe("YouTube tags include #Esports, #OurBrand");
  });
  it("required_twitch_tag", () => {
    expect(formatRequirementDescription({ type: "required_twitch_tag", tag_id: "Esports" })).toBe("Twitch tags include Esports");
  });
  it("required_kick_tags", () => {
    expect(formatRequirementDescription({ type: "required_kick_tags", tags: ["Esports"] })).toBe("Kick tags include Esports");
  });
  it("minimum_duration", () => {
    expect(formatRequirementDescription({ type: "minimum_duration", minutes: 60 })).toBe("Stream for at least 60 minutes");
  });
  it("required_vod_exists", () => {
    expect(formatRequirementDescription({ type: "required_vod_exists" })).toBe("A VOD must be available");
  });
  it("required_description_contains", () => {
    expect(formatRequirementDescription({ type: "required_description_contains", value: "#OurBrand" })).toBe("Description contains #OurBrand");
  });
  it("required_category with id", () => {
    expect(formatRequirementDescription({ type: "required_category", categoryId: "509658" })).toBe("Category ID: 509658");
  });
  it("required_category fallback", () => {
    expect(formatRequirementDescription({ type: "required_category", categoryId: "" })).toBe("Required category selected");
  });
  it("required_streaming_window", () => {
    expect(formatRequirementDescription({ type: "required_streaming_window" })).toBe("Stream during the required campaign window");
  });
  it("unknown fallback does not render JSON", () => {
    const out = formatRequirementDescription({ type: "unknown_type", foo: "bar" });
    expect(out).toBe("Requirement configured");
    expect(out).not.toContain("unknown_type");
    expect(out).not.toContain("foo");
    expect(out).not.toContain("{");
  });
  it("null/empty fallback", () => {
    expect(formatRequirementDescription(null)).toBe("Requirement configured");
    expect(formatRequirementDescription({})).toBe("Requirement configured");
  });
  it("never renders raw JSON", () => {
    const rule = { type: "required_youtube_tags", tags: ["#Esports"] };
    const out = formatRequirementDescription(rule);
    expect(out).not.toContain('{"');
    expect(out).not.toContain('"type"');
  });
});
