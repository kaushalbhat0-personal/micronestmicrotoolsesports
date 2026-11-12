// G1-7 consent operation tests with a mocked Supabase client.
// Lane: pure unit (no network). Live RLS/RPC semantics are proven in the
// integration lane; these tests prove session-derived identity, strict input,
// DEFINER-function routing and safe error mapping at the application layer.
//
// Authoritative: 04 section 2 (consent toggles + approved copy), 05 (column
// grants + set_player_discoverability DEFINER), 07 setDiscoverability,
// 08 T2/T4.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  ProfileNotFoundError,
  ProfileOperationError,
  ProfileValidationError,
} from "../domain/player-profile";
import {
  getDiscoverabilityState,
  setDiscoverability,
} from "../server/consent";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";

const CONSENT_ROW = {
  user_id: SESSION_USER_ID,
  handle: "nova_01",
  display_name: "Nova",
  avatar_path: null,
  bio: null,
  country_code: null,
  is_discoverable: true,
  handle_changed_at: null,
  created_at: "2026-11-11T00:00:00.000Z",
  updated_at: "2026-11-11T00:00:00.000Z",
};

interface FakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  consentRpc?: { data: unknown; error: unknown };
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
    if (fn === "set_player_discoverability") {
      if (opts.consentRpc !== undefined) {
        return opts.consentRpc;
      }
      return { data: [{ ...CONSENT_ROW }], error: null };
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

describe("getDiscoverabilityState (04 section 2)", () => {
  it("requires a session", async () => {
    await expect(
      getDiscoverabilityState(fakeClient({ sessionUserId: null }).client),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("returns the stored flag for the caller", async () => {
    const state = await fakeClient({
      selectRows: { rows: [{ is_discoverable: false }] },
    }).client;
    await expect(getDiscoverabilityState(state)).resolves.toEqual({
      is_discoverable: false,
    });
  });

  it("throws not-found when the caller has no profile", async () => {
    const { client } = fakeClient({ selectRows: { rows: [] } });
    await expect(getDiscoverabilityState(client)).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});

describe("setDiscoverability (07 setDiscoverability)", () => {
  it("requires an explicit boolean and rejects mass assignment", async () => {
    const { client } = fakeClient();
    await expect(setDiscoverability(client, {})).rejects.toThrow();
    await expect(
      setDiscoverability(client, { is_discoverable: "true" }),
    ).rejects.toThrow();
    await expect(
      setDiscoverability(client, {
        is_discoverable: true,
        user_id: "someone-else",
      }),
    ).rejects.toThrow();
  });

  it("requires a session and accepts no user id", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    // Two-arg boundary: (client, input) — no target selector exists.
    expect(setDiscoverability.length).toBe(2);
  });

  it("routes through the narrow DEFINER function with the parsed flag", async () => {
    let seen: { fn: string; args: unknown } | null = null;
    const { client } = fakeClient({
      onRpc: (fn, args) => {
        if (fn === "set_player_discoverability") {
          seen = { fn, args };
        }
      },
    });
    const profile = await setDiscoverability(client, { is_discoverable: false });
    expect(seen).toEqual({
      fn: "set_player_discoverability",
      args: { p_value: false },
    });
    expect(profile.user_id).toBe(SESSION_USER_ID);
    expect(profile.is_discoverable).toBe(true);
  });

  it("maps suspended to SuspendedError", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(SuspendedError);
  });

  it("maps function-level suspension to SuspendedError", async () => {
    const { client } = fakeClient({
      consentRpc: {
        data: null,
        error: { code: "28000", message: "account not active" },
      },
    });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(SuspendedError);
  });

  it("maps missing profile to ProfileNotFoundError", async () => {
    const { client } = fakeClient({ consentRpc: { data: [], error: null } });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  it("maps invalid input to ProfileValidationError", async () => {
    const { client } = fakeClient({
      consentRpc: {
        data: null,
        error: { code: "22000", message: "invalid input" },
      },
    });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("fails closed on foreign rows", async () => {
    const { client } = fakeClient({
      consentRpc: {
        data: [{ ...CONSENT_ROW, user_id: "other-user" }],
        error: null,
      },
    });
    await expect(
      setDiscoverability(client, { is_discoverable: true }),
    ).rejects.toBeInstanceOf(ProfileOperationError);
  });
});
