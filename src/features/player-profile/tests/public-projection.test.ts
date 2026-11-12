import { describe, expect, it } from "vitest";
import {
  PUBLIC_PROJECTION_COLUMNS,
  isPublicProjectionColumn,
} from "../domain/public-projection";

// Frozen contract mirror (APPROVED D-G1-03, 04 §5, 11 §3).
// This test guards the scaffold constant; the authoritative G1-4 key-set
// test against the real RPCs is PLANNED in 12-implementation-test-plan.md.

describe("PUBLIC_PROJECTION_COLUMNS", () => {
  it("matches the frozen 12-column allowlist exactly", () => {
    expect([...PUBLIC_PROJECTION_COLUMNS]).toEqual([
      "handle",
      "display_name",
      "avatar_url",
      "bio",
      "country_code",
      "game_key",
      "game_name",
      "ign",
      "primary_role",
      "play_modes",
      "region_code",
      "availability",
    ]);
  });

  it("exposes no IDs, PII, game_user_id, evidence or timestamps", () => {
    for (const forbidden of [
      "user_id",
      "id",
      "email",
      "phone",
      "game_user_id",
      "evidence",
      "created_at",
      "updated_at",
      "suspended_at",
      "is_discoverable",
      "is_visible",
      "status",
    ]) {
      expect(isPublicProjectionColumn(forbidden)).toBe(false);
    }
    expect(isPublicProjectionColumn("handle")).toBe(true);
  });
});
