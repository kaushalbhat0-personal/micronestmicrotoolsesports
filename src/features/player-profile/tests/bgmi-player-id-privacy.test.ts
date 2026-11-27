import { describe, expect, it } from "vitest";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import {
  assertNoForbiddenShareFields,
  PLAYER_SHARE_FIELD_KEYS,
  toPlayerShareInput,
} from "../share/player-card-model";
import type { PublicPlayerCard } from "../domain/directory";
import { updateGameProfileInputSchema } from "../schemas/game-profile";
import { gameUserIdSchema, normalizeGameUserIdInput } from "../schemas/game";

const CARD: PublicPlayerCard = {
  handle: "nova_01",
  display_name: "Nova",
  avatar_url: null,
  bio: null,
  country_code: "IN",
  game_key: "bgmi",
  game_name: "Battlegrounds Mobile India",
  ign: "NovaScout",
  primary_role: "Support",
  play_modes: ["squad"],
  region_code: "india",
  availability: [],
};

describe("P15-M2B.2 private BGMI Player ID privacy", () => {
  it("keeps game_user_id off the frozen public projection", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("game_user_id");
  });

  it("rejects game_user_id in share payloads", () => {
    expect(PLAYER_SHARE_FIELD_KEYS).not.toContain("game_user_id");
    expect(assertNoForbiddenShareFields({ game_user_id: "001234" })).toBe(false);
    const share = toPlayerShareInput(CARD, "https://example.test/players/nova_01");
    expect(share).not.toBeNull();
    expect(JSON.stringify(share)).not.toContain("game_user_id");
    expect(JSON.stringify(share)).not.toContain("001234");
  });

  it("allows owner patch set/clear through update schema only", () => {
    expect(
      updateGameProfileInputSchema.parse({ game_user_id: "001234" }).game_user_id,
    ).toBe("001234");
    expect(updateGameProfileInputSchema.parse({ game_user_id: null }).game_user_id).toBeNull();
    expect(gameUserIdSchema.safeParse("12").success).toBe(false);
    expect(normalizeGameUserIdInput("  ")).toBeNull();
  });
});
