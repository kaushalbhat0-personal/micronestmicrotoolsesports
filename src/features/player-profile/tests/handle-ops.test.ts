// G1-7 handle-change operation tests with a mocked Supabase client.
// Lane: pure unit (no network). Live cooldown/RPC semantics are proven in
// the integration lane; these tests prove session-derived identity, strict
// normalization input, DEFINER-function routing, cooldown/collision mapping
// and that the generic profile patch still rejects `handle`.
//
// Authoritative: D-G1-05 Option A (approved 2026-11-11), 05 (bypass
// closure + update_player_handle DEFINER), 07 updateHandle, 08 T2/T4/T8.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  HandleCooldownError,
  HandleTakenError,
  ProfileNotFoundError,
  ProfileValidationError,
} from "../domain/player-profile";
import { updatePlayerProfile } from "../server/player-profile";
import { getHandleChangeState, updateHandle } from "../server/handle";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

const HANDLE_ROW = {
  user_id: SESSION_USER_ID,
  handle: "nova_prime",
  display_name: "Nova",
  avatar_path: null,
  bio: null,
  country_code: null,
  is_discoverable: false,
  handle_changed_at: "2026-11-11T00:00:00.000Z",
  created_at: "2026-11-10T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
};

interface FakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  handleRpc?: { data: unknown; error: unknown };
  selectRows?: { rows: unknown[]; error?: unknown };
  onRpc?: (fn: string, args: unknown) => void;
}

function fakeClient(opts: FakeOpts = {}): { client: SupabaseClient } {
  const sessionUserId =
    opts.sessionUserId === undefined ? SESSION_USER_ID : opts.sessionUserId;
  const rpc = vi.fn(async (fn: string, args?: unknown) => {
    opts.onRpc?.(fn, args);
    if (fn === "ensure_app_user") {
      return {
        data: [{ id: sessionUserId, status: opts.ensureStatus ?? "active" }],
        error: null,
      };
    }
    if (fn === "update_player_handle") {
      if (opts.handleRpc !== undefined) {
        return opts.handleRpc;
      }
      return { data: [{ ...HANDLE_ROW }], error: null };
    }
    return { data: null, error: { message: "unknown function", code: "42883" } };
  });
  const from = vi.fn((_table: string) => ({
    select: vi.fn((_cols?: string) => ({
      eq: vi.fn(async (_col: string, _val: unknown) => {
        if (opts.selectRows !== undefined) {
          return { data: opts.selectRows.rows, error: opts.selectRows.error ?? null };
        }
        return { data: [], error: null };
      }),
    })),
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
  } as unknown as SupabaseClient;
  return { client };
}

describe("updateHandle (07 updateHandle, D-G1-05 Option A)", () => {
  it("normalizes input and routes through the narrow DEFINER function", async () => {
    let seen: { fn: string; args: unknown } | null = null;
    const { client } = fakeClient({
      onRpc: (fn, args) => {
        if (fn === "update_player_handle") {
          seen = { fn, args };
        }
      },
    });
    const profile = await updateHandle(client, { handle: " Nova_Prime " });
    // Zod trims + lowercases before the RPC call.
    expect(seen).toEqual({
      fn: "update_player_handle",
      args: { p_handle: "nova_prime" },
    });
    expect(profile.user_id).toBe(SESSION_USER_ID);
    expect(profile.handle).toBe("nova_prime");
    expect(profile.handle_changed_at).toBe("2026-11-11T00:00:00.000Z");
  });

  it("rejects invalid handles at the Zod boundary", async () => {
    const { client } = fakeClient();
    await expect(updateHandle(client, { handle: "ab" })).rejects.toThrow();
    await expect(updateHandle(client, { handle: "HAS SPACE" })).rejects.toThrow();
    await expect(updateHandle(client, { handle: "UPPER!" })).rejects.toThrow();
    await expect(updateHandle(client, {})).rejects.toThrow();
    await expect(
      updateHandle(client, { handle: "nova_prime", user_id: "x" }),
    ).rejects.toThrow();
  });

  it("requires a session and accepts no user id", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(updateHandle(client, { handle: "nova_prime" })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    expect(updateHandle.length).toBe(2);
  });

  it("maps a cooldown failure to HandleCooldownError with eligibility", async () => {
    const eligible = "2026-12-11T00:00:00.000Z";
    const { client } = fakeClient({
      handleRpc: {
        data: null,
        error: { code: "P0001", message: `HANDLE_COOLDOWN:${eligible}` },
      },
    });
    const failure = await updateHandle(client, { handle: "nova_next" }).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(HandleCooldownError);
    expect((failure as HandleCooldownError).nextEligibleAt).toBe(eligible);
  });

  it("maps a collision to HandleTakenError without leaking the owner", async () => {
    const { client } = fakeClient({
      handleRpc: {
        data: null,
        error: { code: "23505", message: "handle taken" },
      },
    });
    const failure = await updateHandle(client, { handle: "taken_name" }).catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(HandleTakenError);
    expect((failure as Error).message).not.toContain(SESSION_USER_ID);
  });

  it("maps suspended to SuspendedError", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    await expect(
      updateHandle(client, { handle: "nova_next" }),
    ).rejects.toBeInstanceOf(SuspendedError);
  });

  it("maps invalid input to ProfileValidationError", async () => {
    const { client } = fakeClient({
      handleRpc: {
        data: null,
        error: { code: "22000", message: "invalid handle" },
      },
    });
    await expect(
      updateHandle(client, { handle: "abc" }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("maps a missing profile to ProfileNotFoundError", async () => {
    const { client } = fakeClient({ handleRpc: { data: [], error: null } });
    await expect(updateHandle(client, { handle: "nova_next" })).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });

  it("generic profile update still rejects handle", async () => {
    const { client } = fakeClient();
    await expect(
      updatePlayerProfile(client, { display_name: "Nova", handle: "nova_x" }),
    ).rejects.toThrow();
  });
});

describe("getHandleChangeState (D-G1-05 cooldown guidance)", () => {
  it("requires a session", async () => {
    await expect(
      getHandleChangeState(fakeClient({ sessionUserId: null }).client),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("reports eligible when no prior change exists", async () => {
    const { client } = fakeClient({
      selectRows: { rows: [{ handle: "nova_01", handle_changed_at: null }] },
    });
    await expect(getHandleChangeState(client)).resolves.toEqual({
      handle: "nova_01",
      handleChangedAt: null,
      nextEligibleAt: null,
    });
  });

  it("reports the next eligible time within the cooldown window", async () => {
    const changedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { client } = fakeClient({
      selectRows: { rows: [{ handle: "nova_01", handle_changed_at: changedAt }] },
    });
    const state = await getHandleChangeState(client);
    expect(state.handle).toBe("nova_01");
    expect(state.handleChangedAt).toBe(changedAt);
    expect(state.nextEligibleAt).not.toBeNull();
    expect(Date.parse(state.nextEligibleAt as string)).toBeGreaterThan(Date.now());
  });
});
