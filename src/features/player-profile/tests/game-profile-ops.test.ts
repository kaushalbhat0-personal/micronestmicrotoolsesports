// G1-3 application-operation tests with a mocked Supabase client.
// Lane: pure unit (no network). RLS itself is proven in the integration
// lane; these tests prove session-derived identity, catalogue/active
// gating, allowlists, Zod boundaries and safe error mapping.
//
// Authoritative: 02 sections 2-3, 03 sections 3/5, 05 section 1,
//   07 sections 1/3/5, 08 T2/T4, 12 section 4.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  GameProfileAlreadyExistsError,
  GameProfileNotFoundError,
  GameProfileOperationError,
  GameProfileValidationError,
  MissingPlayerProfileError,
  UnsupportedGameError,
} from "../domain/game-profile";
import {
  createGameProfile,
  getOwnGameProfiles,
  listSupportedGames,
  updateGameProfile,
} from "../server/game-profile";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

const CATALOGUE_ROW = {
  key: "bgmi",
  name: "Battlegrounds Mobile India",
  short_name: "BGMI",
  is_active: true,
};

const GAME_ROW = {
  id: "33333333-3333-4333-8333-333333333333",
  player_user_id: SESSION_USER_ID,
  game_key: "bgmi",
  ign: "NovaScout",
  game_user_id: null,
  primary_role: "Scout",
  play_modes: ["squad", "tpp"],
  region_code: "india",
  availability: ["weekend"],
  is_visible: true,
  created_at: "2026-11-10T00:00:00.000Z",
  updated_at: "2026-11-10T00:00:00.000Z",
};

interface FakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  canonicalRows?: unknown[];
  gameRows?: unknown[];
  gameListError?: unknown;
  insertResult?: { data: unknown; error: unknown };
  updateRows?: { rows: unknown[]; error?: unknown };
  selectGameRows?: { rows: unknown[]; error?: unknown };
  onInsertPayload?: (payload: unknown) => void;
  onUpdatePayload?: (payload: unknown) => void;
}

function fakeClient(opts: FakeOpts): { client: SupabaseClient } {
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

  // from(table) -> select/update/insert chains. select chains dispatch on
  // table: player_profiles (canonical check), games (catalogue check),
  // player_game_profiles (reads). Like the real PostgREST builder, .eq()
  // stays chainable (.order()) and awaitable.
  const from = vi.fn((table: string) => {
    const eqResult = () => {
      if (table === "player_profiles") {
        return { data: opts.canonicalRows ?? [{ user_id: sessionUserId }], error: null };
      }
      if (table === "games") {
        return {
          data: opts.gameRows ?? [{ ...CATALOGUE_ROW }],
          error: null,
        };
      }
      return {
        data: opts.selectGameRows?.rows ?? [],
        error: opts.selectGameRows?.error ?? null,
      };
    };
    const orderResult = () => {
      if (table === "games") {
        if (opts.gameListError !== undefined) {
          return { data: null, error: opts.gameListError };
        }
        return {
          data: opts.gameRows ?? [{ ...CATALOGUE_ROW }],
          error: null,
        };
      }
      return {
        data: opts.selectGameRows?.rows ?? [],
        error: opts.selectGameRows?.error ?? null,
      };
    };
    const selectChain = {
      eq: vi.fn((_col: string, _val: unknown) =>
        Object.assign(Promise.resolve(eqResult()), {
          order: vi.fn(async (_c: string) => orderResult()),
        }),
      ),
      order: vi.fn(async (_col: string) => orderResult()),
    };
    return {
      select: vi.fn((_cols?: string) => selectChain),
      insert: vi.fn((payload: unknown) => {
        opts.onInsertPayload?.(payload);
        return {
          select: vi.fn(async (_cols?: string) => {
            return (
              opts.insertResult ?? { data: [{ ...GAME_ROW }], error: null }
            );
          }),
        };
      }),
      update: vi.fn((payload: unknown) => {
        opts.onUpdatePayload?.(payload);
        return {
          eq: vi.fn((_c1: string, _v1: unknown) => ({
            eq: vi.fn((_c2: string, _v2: unknown) => ({
              select: vi.fn(async (_cols?: string) => {
                if (opts.updateRows !== undefined) {
                  return {
                    data: opts.updateRows.rows,
                    error: opts.updateRows.error ?? null,
                  };
                }
                return { data: [], error: null };
              }),
            })),
          })),
        };
      }),
    };
  });

  const client = {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.sessionError || sessionUserId === null) {
          return {
            data: { user: null },
            error: { message: "Auth session missing" },
          };
        }
        return {
          data: { user: { id: sessionUserId } },
          error: null,
        };
      }),
    },
    rpc,
    from,
  };
  return { client: client as unknown as SupabaseClient };
}

const MINIMAL = { game_key: "bgmi", ign: "NovaScout" };

describe("listSupportedGames — public catalogue (05 section 3)", () => {
  it("needs no session and returns active titles", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(listSupportedGames(client)).resolves.toEqual([
      { key: "bgmi", name: "Battlegrounds Mobile India", short_name: "BGMI" },
    ]);
  });

  it("maps database failures to a safe generic error", async () => {
    const { client } = fakeClient({
      gameListError: { message: "connection reset", code: "XX000" },
    });
    const failure = await listSupportedGames(client).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(GameProfileOperationError);
    expect((failure as Error).message).not.toContain("reset");
  });
});

describe("getOwnGameProfiles — session-derived reads (08 T2)", () => {
  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(getOwnGameProfiles(client)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("returns the caller's own rows (empty allowed)", async () => {
    const { client } = fakeClient({ selectGameRows: { rows: [] } });
    await expect(getOwnGameProfiles(client)).resolves.toEqual([]);
    const { client: c2 } = fakeClient({ selectGameRows: { rows: [GAME_ROW] } });
    await expect(getOwnGameProfiles(c2)).resolves.toEqual([GAME_ROW]);
  });

  it("fails closed on foreign rows", async () => {
    const { client } = fakeClient({
      selectGameRows: {
        rows: [{ ...GAME_ROW, player_user_id: "other-user" }],
      },
    });
    await expect(getOwnGameProfiles(client)).rejects.toBeInstanceOf(
      GameProfileOperationError,
    );
  });
});

describe("createGameProfile — owner creation (07, 08 T2/T4)", () => {
  it("accepts no caller-supplied user ID (session wins by construction)", () => {
    expect(createGameProfile.length).toBe(2);
  });

  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(createGameProfile(client, MINIMAL)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("blocks suspended accounts with the generic account error", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    const failure = await createGameProfile(client, MINIMAL).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(SuspendedError);
    expect((failure as Error).message).not.toContain(SESSION_USER_ID);
  });

  it("requires an existing canonical profile (never auto-creates)", async () => {
    const { client } = fakeClient({ canonicalRows: [] });
    await expect(createGameProfile(client, MINIMAL)).rejects.toBeInstanceOf(
      MissingPlayerProfileError,
    );
  });

  it("rejects unknown games without an existence oracle", async () => {
    const { client } = fakeClient({ gameRows: [] });
    const failure = await createGameProfile(client, {
      game_key: "valorant",
      ign: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(UnsupportedGameError);
    expect((failure as Error).message).toBe("This game is not supported.");
  });

  it("rejects inactive titles like unknown ones", async () => {
    const { client } = fakeClient({
      gameRows: [{ key: "bgmi", is_active: false }],
    });
    await expect(createGameProfile(client, MINIMAL)).rejects.toBeInstanceOf(
      UnsupportedGameError,
    );
  });

  it("derives the owner from the session and writes explicit columns", async () => {
    let payload: unknown;
    const { client } = fakeClient({
      onInsertPayload: (p) => {
        payload = p;
      },
    });
    const profile = await createGameProfile(client, {
      ...MINIMAL,
      primary_role: "Scout",
      region_code: "INDIA",
    });
    expect(profile.player_user_id).toBe(SESSION_USER_ID);
    expect(profile.game_key).toBe("bgmi");
    expect(payload).toEqual({
      player_user_id: SESSION_USER_ID,
      game_key: "bgmi",
      ign: "NovaScout",
      game_user_id: null,
      primary_role: "Scout",
      region_code: "india",
    });
  });

  it("rejects mass-assigned ownership fields at the boundary", async () => {
    const { client } = fakeClient({});
    for (const extra of [
      { player_user_id: "someone-else" },
      { id: "some-uuid" },
      { user_id: "someone-else" },
    ]) {
      await expect(
        createGameProfile(client, { ...MINIMAL, ...extra }),
      ).rejects.toThrow();
    }
  });

  it("rejects invalid roles, modes, regions and availability", async () => {
    const { client } = fakeClient({});
    for (const bad of [
      { ...MINIMAL, primary_role: "Sniper" },
      { ...MINIMAL, play_modes: ["ranked"] },
      { ...MINIMAL, region_code: "atlantis" },
      { ...MINIMAL, ign: "x" },
      { ...MINIMAL, availability: new Array(8).fill("weekend") },
    ]) {
      await expect(createGameProfile(client, bad)).rejects.toThrow();
    }
  });

  it("maps the (player, game) conflict deterministically", async () => {
    const { client } = fakeClient({
      insertResult: {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "player_game_profiles_player_user_id_game_key_key"',
        },
      },
    });
    await expect(createGameProfile(client, MINIMAL)).rejects.toBeInstanceOf(
      GameProfileAlreadyExistsError,
    );
  });

  it("maps FK races to UnsupportedGameError and CHECKs to validation", async () => {
    const { client: fk } = fakeClient({
      insertResult: {
        data: null,
        error: { code: "23503", message: "violates foreign key constraint" },
      },
    });
    await expect(createGameProfile(fk, MINIMAL)).rejects.toBeInstanceOf(
      UnsupportedGameError,
    );
    const { client: ck } = fakeClient({
      insertResult: {
        data: null,
        error: { code: "23514", message: "violates check constraint" },
      },
    });
    const failure = await createGameProfile(ck, MINIMAL).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(GameProfileValidationError);
    expect((failure as Error).message).not.toContain("violates");
  });

  it("fails closed on foreign or ambiguous rows", async () => {
    const { client } = fakeClient({
      insertResult: {
        data: [{ ...GAME_ROW, player_user_id: "other-user" }],
        error: null,
      },
    });
    await expect(createGameProfile(client, MINIMAL)).rejects.toBeInstanceOf(
      GameProfileOperationError,
    );
  });
});

describe("updateGameProfile — owner-only patch (07, 08 T2/T4)", () => {
  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(
      updateGameProfile(client, "bgmi", { ign: "NovaPrime" }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("writes only the allowlisted columns for the selected game", async () => {
    let payload: unknown;
    const { client } = fakeClient({
      updateRows: { rows: [{ ...GAME_ROW, ign: "NovaPrime" }] },
      onUpdatePayload: (p) => {
        payload = p;
      },
    });
    const result = await updateGameProfile(client, "bgmi", { ign: "NovaPrime" });
    expect(result.ign).toBe("NovaPrime");
    expect(payload).toEqual({ ign: "NovaPrime" });
  });

  it("rejects ownership selectors in the patch", async () => {
    const { client } = fakeClient({ updateRows: { rows: [GAME_ROW] } });
    for (const bad of [
      { game_key: "bgmi" },
      { player_user_id: "someone-else" },
      { id: "some-uuid" },
      { ign: "Nova", player_user_id: "someone-else" },
    ]) {
      await expect(updateGameProfile(client, "bgmi", bad)).rejects.toThrow();
    }
  });

  it("re-validates region against the row's game vocabulary", async () => {
    const { client } = fakeClient({ updateRows: { rows: [GAME_ROW] } });
    await expect(
      updateGameProfile(client, "bgmi", { region_code: "atlantis" }),
    ).rejects.toThrow();
    // Unknown-game selector with a region fails closed.
    await expect(
      updateGameProfile(client, "some-future-title", { region_code: "india" }),
    ).rejects.toThrow();
  });

  it("maps a missing row to GameProfileNotFoundError", async () => {
    const { client } = fakeClient({ updateRows: { rows: [] } });
    await expect(
      updateGameProfile(client, "bgmi", { ign: "NovaPrime" }),
    ).rejects.toBeInstanceOf(GameProfileNotFoundError);
  });

  it("surfaces suspension distinctly from not-found", async () => {
    const { client } = fakeClient({
      ensureStatus: "suspended",
      updateRows: { rows: [] },
    });
    await expect(
      updateGameProfile(client, "bgmi", { ign: "NovaPrime" }),
    ).rejects.toBeInstanceOf(SuspendedError);
  });

  it("error messages expose no private information", async () => {
    const { client } = fakeClient({
      insertResult: {
        data: null,
        error: {
          code: "23505",
          message: "Key (player_user_id, game_key)=(secret-id, bgmi) exists.",
        },
      },
    });
    const failure = await createGameProfile(client, MINIMAL).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(GameProfileAlreadyExistsError);
    expect((failure as Error).message).not.toContain("secret-id");
  });
});
