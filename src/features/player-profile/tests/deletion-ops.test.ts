// G1-7 deletion operation tests with a mocked Supabase client.
// Lane: pure unit (no network). Live cascade/RLS/storage semantics are
// proven in the integration lane; these tests prove session-derived
// identity, exact scoping (no broad selectors), storage-first ordering and
// safe error mapping at the application layer.
//
// Authoritative: D-G1-07 Option A (approved 2026-11-11: hard delete, two
// operations only, whole-account deletion excluded), 05 (owner DELETE
// policies/grants + cascade), 06 section 5 (storage-first), 08 T2/T6.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  GameProfileNotFoundError,
  GameProfileOperationError,
} from "../domain/game-profile";
import {
  ProfileDeletionError,
  ProfileNotFoundError,
  ProfileOperationError,
} from "../domain/player-profile";
import { deletePlayerProfile, removeGameProfile } from "../server/deletion";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

interface FakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  canonicalRows?: unknown[] | null;
  deleteGameRows?: { rows: unknown[]; error?: unknown };
  deleteProfileRows?: { rows: unknown[]; error?: unknown };
  removeError?: unknown;
  onDeleteFilter?: (table: string, filters: Array<{ col: string; val: unknown }>) => void;
  onRemove?: (paths: string[]) => void;
  callOrder?: string[];
}

function fakeClient(opts: FakeOpts = {}): { client: SupabaseClient } {
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
  const from = vi.fn((table: string) => {
    const filters: Array<{ col: string; val: unknown }> = [];
    const chainable = {
      eq: (col: string, val: unknown) => {
        filters.push({ col, val });
        return chainable;
      },
      // biome-ignore lint: PostgREST builder is thenable
      then: undefined as unknown,
    };
    return {
      select: vi.fn((_cols?: string) => ({
        eq: vi.fn(async (_col: string, _val: unknown) => {
          if (table === "player_profiles") {
            if (opts.canonicalRows !== undefined && opts.canonicalRows !== null) {
              return { data: opts.canonicalRows, error: null };
            }
            return {
              data: [{ user_id: sessionUserId, avatar_path: null }],
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn((col: string, val: unknown) => {
          filters.push({ col, val });
          return {
            eq: vi.fn((col2: string, val2: unknown) => {
              filters.push({ col: col2, val: val2 });
              return {
                select: vi.fn(async (_cols?: string) => {
                  opts.onDeleteFilter?.(table, filters);
                  opts.callOrder?.push(`db-delete:${table}`);
                  if (table === "player_game_profiles") {
                    if (opts.deleteGameRows !== undefined) {
                      return {
                        data: opts.deleteGameRows.rows,
                        error: opts.deleteGameRows.error ?? null,
                      };
                    }
                    return { data: [{ game_key: "bgmi" }], error: null };
                  }
                  if (opts.deleteProfileRows !== undefined) {
                    return {
                      data: opts.deleteProfileRows.rows,
                      error: opts.deleteProfileRows.error ?? null,
                    };
                  }
                  return { data: [{ user_id: sessionUserId }], error: null };
                }),
              };
            }),
            select: vi.fn(async (_cols?: string) => {
              opts.onDeleteFilter?.(table, filters);
              opts.callOrder?.push(`db-delete:${table}`);
              if (table === "player_profiles") {
                if (opts.deleteProfileRows !== undefined) {
                  return {
                    data: opts.deleteProfileRows.rows,
                    error: opts.deleteProfileRows.error ?? null,
                  };
                }
                return { data: [{ user_id: sessionUserId }], error: null };
              }
              return { data: [], error: null };
            }),
          };
        }),
      })),
      storage: undefined,
    };
  });
  const storageFrom = vi.fn((_bucket: string) => ({
    remove: vi.fn(async (paths: string[]) => {
      opts.onRemove?.(paths);
      opts.callOrder?.push("storage-remove");
      if (opts.removeError !== undefined) {
        return { data: null, error: opts.removeError };
      }
      return { data: [], error: null };
    }),
  }));
  const client = {
    auth: {
      getUser: vi.fn(async () => {
        if (opts.sessionError || sessionUserId === null) {
          return { data: { user: null }, error: { message: "Auth session missing" } };
        }
        return { data: { user: { id: sessionUserId } }, error: null };
      }),
    },
    rpc,
    from,
    storage: { from: storageFrom },
  } as unknown as SupabaseClient;
  return { client };
}

describe("removeGameProfile (D-G1-07 game-profile removal)", () => {
  it("requires a session and accepts no user id", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(removeGameProfile(client, "bgmi")).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(removeGameProfile.length).toBe(2);
  });

  it("deletes exactly the caller's row for the given game", async () => {
    const seen: Array<{ col: string; val: unknown }> = [];
    const { client } = fakeClient({
      onDeleteFilter: (table, filters) => {
        if (table === "player_game_profiles") {
          seen.push(...filters);
        }
      },
    });
    await expect(removeGameProfile(client, "bgmi")).resolves.toEqual({
      game_key: "bgmi",
    });
    expect(seen).toContainEqual({ col: "player_user_id", val: SESSION_USER_ID });
    expect(seen).toContainEqual({ col: "game_key", val: "bgmi" });
  });

  it("maps a missing row to GameProfileNotFoundError", async () => {
    const { client } = fakeClient({ deleteGameRows: { rows: [] } });
    await expect(removeGameProfile(client, "bgmi")).rejects.toBeInstanceOf(
      GameProfileNotFoundError,
    );
  });

  it("maps suspended to SuspendedError", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    await expect(removeGameProfile(client, "bgmi")).rejects.toBeInstanceOf(
      SuspendedError,
    );
  });

  it("rejects invalid selectors and surfaces DB failures safely", async () => {
    const { client } = fakeClient();
    await expect(removeGameProfile(client, "BGMI!")).rejects.toThrow();
    const failing = fakeClient({
      deleteGameRows: { rows: [], error: { code: "42501", message: "denied" } },
    }).client;
    await expect(removeGameProfile(failing, "bgmi")).rejects.toBeInstanceOf(
      GameProfileOperationError,
    );
  });
});

describe("deletePlayerProfile (D-G1-07 canonical-profile deletion)", () => {
  it("requires a session and accepts no user id", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(deletePlayerProfile(client)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(deletePlayerProfile.length).toBe(1);
  });

  it("deletes only the caller's canonical row", async () => {
    const seen: Array<{ col: string; val: unknown }> = [];
    const { client } = fakeClient({
      onDeleteFilter: (table, filters) => {
        if (table === "player_profiles") {
          seen.push(...filters);
        }
      },
    });
    await expect(deletePlayerProfile(client)).resolves.toBeUndefined();
    expect(seen).toContainEqual({ col: "user_id", val: SESSION_USER_ID });
  });

  it("removes owned avatar objects first by exact path, then deletes the row", async () => {
    const order: string[] = [];
    let removed: string[] = [];
    const { client } = fakeClient({
      canonicalRows: [
        { user_id: SESSION_USER_ID, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      callOrder: order,
      onRemove: (paths) => {
        removed = paths;
      },
    });
    await deletePlayerProfile(client);
    expect(order).toEqual(["storage-remove", "db-delete:player_profiles"]);
    expect(removed).toContain(`${SESSION_USER_ID}/avatar.png`);
    expect(removed.every((p) => p.startsWith(`${SESSION_USER_ID}/`))).toBe(true);
  });

  it("surfaces storage cleanup failure without deleting the row", async () => {
    const order: string[] = [];
    const { client } = fakeClient({
      canonicalRows: [
        { user_id: SESSION_USER_ID, avatar_path: `${SESSION_USER_ID}/avatar.png` },
      ],
      removeError: { message: "storage unavailable" },
      callOrder: order,
    });
    await expect(deletePlayerProfile(client)).rejects.toBeInstanceOf(
      ProfileDeletionError,
    );
    expect(order).toEqual(["storage-remove"]);
  });

  it("maps a missing profile to ProfileNotFoundError", async () => {
    const { client } = fakeClient({ canonicalRows: [] });
    await expect(deletePlayerProfile(client)).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });

  it("maps suspended to SuspendedError", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    await expect(deletePlayerProfile(client)).rejects.toBeInstanceOf(
      SuspendedError,
    );
  });

  it("fails closed on foreign rows and DB failures", async () => {
    const foreign = fakeClient({
      canonicalRows: [{ user_id: "other-user", avatar_path: null }],
    }).client;
    await expect(deletePlayerProfile(foreign)).rejects.toBeInstanceOf(
      ProfileOperationError,
    );
    const failing = fakeClient({
      deleteProfileRows: { rows: [], error: { code: "500", message: "boom" } },
    }).client;
    await expect(deletePlayerProfile(failing)).rejects.toBeInstanceOf(
      ProfileOperationError,
    );
  });
});
