import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProfileIncompleteError } from "../domain/player-profile";
import { setDiscoverability } from "../server/consent";
import { getProfileCompleteness } from "../server/completeness";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { canOptIntoDiscoverability } from "../domain/access-policy";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

describe("P15-M2B.1 discoverability completeness contract", () => {
  it("maps RPC profile incomplete to ProfileIncompleteError", async () => {
    const rpc = vi.fn(async (fn: string) => {
      if (fn === "ensure_app_user") {
        return {
          data: [{ id: SESSION_USER_ID, status: "active" }],
          error: null,
        };
      }
      if (fn === "set_player_discoverability") {
        return {
          data: null,
          error: { code: "22000", message: "profile incomplete" },
        };
      }
      return { data: null, error: { code: "42883", message: "unknown" } };
    });

    const client = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: SESSION_USER_ID } },
          error: null,
        })),
      },
      rpc,
    } as unknown as SupabaseClient;

    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(ProfileIncompleteError);
    expect(rpc).toHaveBeenCalledWith("set_player_discoverability", {
      p_value: true,
    });
  });

  it("keeps D-G1-08 as the single completeness rule (no invented mandatory fields)", () => {
    const incomplete = getProfileCompleteness(
      { handle: "alpha", displayName: "Alpha", avatarPath: null, bio: null },
      1,
    );
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missing).toEqual(["avatar_or_bio"]);

    const complete = getProfileCompleteness(
      { handle: "alpha", displayName: "Alpha", avatarPath: null, bio: "Ready" },
      1,
    );
    expect(complete.complete).toBe(true);
    expect(canOptIntoDiscoverability("complete", true).allowed).toBe(true);
    expect(canOptIntoDiscoverability("incomplete").allowed).toBe(false);
  });

  it("does not widen the frozen public projection", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("game_user_id");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("is_discoverable");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("is_verified");
  });
});
