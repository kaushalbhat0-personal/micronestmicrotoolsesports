// G1-7 per-game visibility operation tests with a mocked client.
// Lane: pure unit (no network). Live revocation is proven in the
// integration lane; these tests prove session-derived identity, strict
// input and delegation to the owner-bound update path.
//
// Authoritative: 04 section 2, 07 updateGameProfile, D-G1-07 2026-11-11.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { UnauthenticatedError } from "../domain/app-user";
import { GameProfileNotFoundError, GameProfileOperationError } from "../domain/game-profile";
import {
  getGameVisibility,
  setGameProfileVisibility,
} from "../server/game-visibility";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

function fakeClient(opts: {
  sessionUserId?: string | null;
  ensureStatus?: string;
  visibilityRows?: unknown[];
  updateResult?: { data: unknown; error: unknown };
  onUpdatePayload?: (payload: unknown) => void;
} = {}): { client: SupabaseClient } {
  const sessionUserId =
    opts.sessionUserId === undefined ? SESSION_USER_ID : opts.sessionUserId;
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "ensure_app_user") {
      return {
        data: [{ id: sessionUserId, status: opts.ensureStatus ?? "active" }],
        error: null,
      };
    }
    return { data: null, error: { message: "unknown function", code: "42883" } };
  });
  const from = vi.fn((table: string) => ({
    select: vi.fn((_cols?: string) => ({
      eq: vi.fn((_c1: string, _v1: unknown) => ({
        eq: vi.fn(async (_c2: string, _v2: unknown) => {
          if (table === "player_game_profiles") {
            return {
              data: opts.visibilityRows ?? [{ game_key: "bgmi", is_visible: true }],
              error: null,
            };
          }
          if (table === "player_profiles") {
            return { data: [{ user_id: sessionUserId }], error: null };
          }
          if (table === "games") {
            return { data: [{ key: "bgmi", is_active: true }], error: null };
          }
          return { data: [], error: null };
        }),
      })),
    })),
    update: vi.fn((payload: unknown) => {
      opts.onUpdatePayload?.(payload);
      return {
        eq: vi.fn((_c1: string, _v1: unknown) => ({
          eq: vi.fn((_c2: string, _v2: unknown) => ({
            select: vi.fn(async () => {
              if (opts.updateResult !== undefined) {
                return opts.updateResult;
              }
              return {
                data: [
                  {
                    id: "game-id",
                    player_user_id: sessionUserId,
                    game_key: "bgmi",
                    ign: "NovaScout",
                    game_user_id: null,
                    primary_role: null,
                    play_modes: [],
                    region_code: null,
                    availability: [],
                    is_visible: (payload as { is_visible?: boolean }).is_visible ?? true,
                    created_at: "2026-11-11T00:00:00.000Z",
                    updated_at: "2026-11-11T00:00:00.000Z",
                  },
                ],
                error: null,
              };
            }),
          })),
        })),
      };
    }),
  }));
  const client = {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.sessionUserId === null) {
          return { data: { user: null }, error: { message: "missing" } };
        }
        return { data: { user: { id: sessionUserId } }, error: null };
      }),
    },
    rpc,
    from,
  } as unknown as SupabaseClient;
  return { client };
}

describe("getGameVisibility (04 section 2)", () => {
  it("requires a session", async () => {
    await expect(
      getGameVisibility(fakeClient({ sessionUserId: null }).client, "bgmi"),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("returns the flag for an owned game profile", async () => {
    await expect(
      getGameVisibility(fakeClient().client, "bgmi"),
    ).resolves.toEqual({ game_key: "bgmi", is_visible: true });
  });

  it("returns null when the caller has no profile for the game", async () => {
    const { client } = fakeClient({ visibilityRows: [] });
    await expect(getGameVisibility(client, "bgmi")).resolves.toBeNull();
  });

  it("rejects invalid game keys", async () => {
    await expect(getGameVisibility(fakeClient().client, "BGMI!")).rejects.toThrow();
  });
});

describe("setGameProfileVisibility (D-G1-07 visibility controls)", () => {
  it("toggles visibility through the owner-bound update path only", async () => {
    let payload: unknown = null;
    const { client } = fakeClient({ onUpdatePayload: (p) => (payload = p) });
    const updated = await setGameProfileVisibility(client, "bgmi", {
      is_visible: false,
    });
    expect(payload).toEqual({ is_visible: false });
    expect(updated.is_visible).toBe(false);
    const restored = await setGameProfileVisibility(
      fakeClient().client,
      "bgmi",
      { is_visible: true },
    );
    expect(restored.is_visible).toBe(true);
  });

  it("rejects non-boolean flags and sibling fields", async () => {
    const { client } = fakeClient();
    await expect(
      setGameProfileVisibility(client, "bgmi", { is_visible: "yes" }),
    ).rejects.toThrow();
    await expect(
      setGameProfileVisibility(client, "bgmi", { is_visible: true, ign: "X" }),
    ).rejects.toThrow();
    await expect(
      setGameProfileVisibility(client, "bgmi", {}),
    ).rejects.toThrow();
  });

  it("surfaces update failures safely", async () => {
    const missing = fakeClient({
      updateResult: { data: [], error: null },
    }).client;
    await expect(
      setGameProfileVisibility(missing, "bgmi", { is_visible: false }),
    ).rejects.toBeInstanceOf(GameProfileNotFoundError);
    const failing = fakeClient({
      updateResult: { data: null, error: { code: "500", message: "boom" } },
    }).client;
    await expect(
      setGameProfileVisibility(failing, "bgmi", { is_visible: false }),
    ).rejects.toBeInstanceOf(GameProfileOperationError);
  });
});
