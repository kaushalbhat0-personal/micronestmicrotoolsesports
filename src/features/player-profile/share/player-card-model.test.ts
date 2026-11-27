import { describe, expect, it } from "vitest";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import {
  assertNoForbiddenShareFields,
  buildPlayerShareSpec,
  toPlayerShareInput,
} from "./player-card-model";

const card: PublicPlayerCard = {
  handle: "nova",
  display_name: "Nova",
  avatar_url: null,
  bio: "Self-reported bio",
  country_code: "IN",
  game_key: "bgmi",
  game_name: "BGMI",
  ign: "NovaIGN",
  primary_role: "IGL",
  play_modes: ["squad"],
  region_code: "india",
  availability: ["weeknights"],
};

describe("player share model", () => {
  it("maps only public projection fields", () => {
    const input = toPlayerShareInput(card, "https://example.test/players/nova");
    expect(input).not.toBeNull();
    expect(assertNoForbiddenShareFields({ ...input! })).toBe(true);
    expect("bio" in (input as object)).toBe(false);
    expect("game_key" in (input as object)).toBe(false);
  });

  it("rejects empty profile URL", () => {
    expect(toPlayerShareInput(card, "")).toBeNull();
  });

  it("builds FRAGIX identity label without LFT claims; optional reviewed badge", () => {
    const input = toPlayerShareInput(card, "https://example.test/players/nova")!;
    const spec = buildPlayerShareSpec(input);
    expect(spec.eyebrow).toBe("FRAGIX player identity");
    expect(spec.disclaimer.toLowerCase()).toContain("does not require ownership review");
    expect(spec.disclaimer.toLowerCase()).not.toContain("looking for team");
    expect(spec.rows.some((r) => r.label === "Availability")).toBe(true);

    const reviewed = buildPlayerShareSpec(input, { ownershipReviewed: true });
    expect(reviewed.eyebrow).toBe("BGMI ownership evidence reviewed");
    expect(reviewed.disclaimer.toLowerCase()).toContain("ownership evidence reviewed");
  });

  it("omits empty availability from rows", () => {
    const input = toPlayerShareInput(
      { ...card, availability: [] },
      "https://example.test/players/nova",
    )!;
    const spec = buildPlayerShareSpec(input);
    expect(spec.rows.some((r) => r.label === "Availability")).toBe(false);
  });

  it("flags forbidden private keys", () => {
    expect(assertNoForbiddenShareFields({ game_user_id: "x" })).toBe(false);
    expect(assertNoForbiddenShareFields({ email: "a@b.c" })).toBe(false);
    expect(assertNoForbiddenShareFields({ display_name: "Nova", profileUrl: "/x" })).toBe(true);
  });
});
