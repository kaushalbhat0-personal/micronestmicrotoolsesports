// G1-2 application-operation tests with a mocked Supabase client.
// Lane: pure unit (no network). RLS itself is proven in the integration
// lane; these tests prove session-derived identity, allowlists, Zod
// boundaries and safe error mapping at the application layer.
//
// Authoritative: 02 sections 2-3, 03 section 1/7, 07 sections 1/3/5,
//   08 T2/T4, 12 section 3.

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  HandleTakenError,
  ProfileAlreadyExistsError,
  ProfileNotFoundError,
  ProfileOperationError,
  ProfileValidationError,
} from "../domain/player-profile";
import {
  createPlayerProfile,
  getOwnProfile,
  updatePlayerProfile,
} from "../server/player-profile";

const SESSION_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

const PROFILE_ROW = {
  user_id: SESSION_USER_ID,
  handle: "nova_01",
  display_name: "Nova",
  avatar_path: null,
  bio: null,
  country_code: "IN",
  is_discoverable: false,
  handle_changed_at: null,
  created_at: "2026-11-10T00:00:00.000Z",
  updated_at: "2026-11-10T00:00:00.000Z",
};

interface FakeOpts {
  sessionUserId?: string | null;
  sessionError?: boolean;
  ensureStatus?: string;
  rpcCreate?: { data: unknown; error: unknown };
  selectRows?: { rows: unknown[]; error?: unknown };
  updateRows?: { rows: unknown[]; error?: unknown };
  onRpcArgs?: (fn: string, args: unknown) => void;
  onUpdatePayload?: (payload: unknown) => void;
  onFromTable?: (table: string) => void;
}

function fakeClient(opts: FakeOpts): {
  client: SupabaseClient;
  rpcCalls: Array<{ fn: string; args: unknown }>;
} {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const sessionUserId =
    opts.sessionUserId === undefined ? SESSION_USER_ID : opts.sessionUserId;

  const rpc = vi.fn(async (fn: string, args?: unknown) => {
    rpcCalls.push({ fn, args });
    opts.onRpcArgs?.(fn, args);
    if (fn === "ensure_app_user") {
      return {
        data: [{ id: sessionUserId, status: opts.ensureStatus ?? "active" }],
        error: null,
      };
    }
    if (fn === "create_player_profile") {
      return (
        opts.rpcCreate ?? {
          data: [{ ...PROFILE_ROW, is_discoverable: false }],
          error: null,
        }
      );
    }
    return { data: null, error: { message: "unknown function", code: "42883" } };
  });

  const from = vi.fn((table: string) => {
    opts.onFromTable?.(table);
    return {
      select: vi.fn((_cols?: string) => ({
        eq: vi.fn(async (_col: string, _val: unknown) => {
          if (opts.selectRows !== undefined) {
            return { data: opts.selectRows.rows, error: opts.selectRows.error ?? null };
          }
          return { data: [], error: null };
        }),
      })),
      update: vi.fn((payload: unknown) => {
        opts.onUpdatePayload?.(payload);
        return {
          eq: vi.fn((_col: string, _val: unknown) => ({
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
  return { client: client as unknown as SupabaseClient, rpcCalls };
}

describe("getOwnProfile — session-derived reads (02 section 3, 08 T2)", () => {
  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(getOwnProfile(client)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it("returns null when the caller has no profile (no row created on read)", async () => {
    const { client, rpcCalls } = fakeClient({ selectRows: { rows: [] } });
    await expect(getOwnProfile(client)).resolves.toBeNull();
    // Read-only: the bootstrap RPC must never run on a read path.
    expect(rpcCalls.map((c) => c.fn)).not.toContain("ensure_app_user");
  });

  it("returns the caller's own row with the full private shape", async () => {
    const { client } = fakeClient({ selectRows: { rows: [PROFILE_ROW] } });
    await expect(getOwnProfile(client)).resolves.toEqual(PROFILE_ROW);
  });

  it("fails closed on ambiguous results (never guesses)", async () => {
    const { client } = fakeClient({
      selectRows: { rows: [PROFILE_ROW, PROFILE_ROW] },
    });
    await expect(getOwnProfile(client)).rejects.toBeInstanceOf(
      ProfileOperationError,
    );
  });

  it("maps database failures to a safe generic error", async () => {
    const { client } = fakeClient({
      selectRows: {
        rows: [],
        error: { message: "relation exploded: sorry", code: "XX000" },
      },
    });
    const failure = await getOwnProfile(client).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProfileOperationError);
    expect((failure as Error).message).not.toContain("exploded");
  });
});

describe("createPlayerProfile — session-derived creation (07, 08 T2/T4)", () => {
  it("accepts no caller-supplied user ID (session wins by construction)", () => {
    // (client, input) only: there is no identity parameter to forge.
    expect(createPlayerProfile.length).toBe(2);
  });

  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(
      createPlayerProfile(client, { handle: "nova_01", display_name: "Nova" }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("derives the owner from the session and forces undiscoverable", async () => {
    let rpcArgs: unknown;
    const { client } = fakeClient({
      onRpcArgs: (fn, args) => {
        if (fn === "create_player_profile") rpcArgs = args;
      },
    });
    const profile = await createPlayerProfile(client, {
      handle: "Nova_01",
      display_name: "Nova",
      country_code: "in",
    });
    expect(profile.user_id).toBe(SESSION_USER_ID);
    expect(profile.handle).toBe("nova_01");
    expect(profile.country_code).toBe("IN");
    expect(profile.is_discoverable).toBe(false);
    // The RPC carries no identity parameter and no publish flag.
    expect(rpcArgs).toEqual({
      p_handle: "nova_01",
      p_display_name: "Nova",
      p_bio: null,
      p_country_code: "IN",
    });
  });

  it("rejects mass-assigned publish/identity flags at the boundary", async () => {
    const { client } = fakeClient({});
    for (const extra of [
      { is_discoverable: true },
      { user_id: OTHER_USER_ID },
      { status: "active" },
    ]) {
      await expect(
        createPlayerProfile(client, {
          handle: "nova_01",
          display_name: "Nova",
          ...extra,
        }),
      ).rejects.toThrow();
    }
  });

  it("rejects invalid handles, names and country codes (incl. ONLINE)", async () => {
    const { client } = fakeClient({});
    for (const bad of [
      { handle: "ab", display_name: "Nova" },
      { handle: "NOVA-01", display_name: "Nova" },
      { handle: "nova_01", display_name: "" },
      { handle: "nova_01", display_name: "Nova", country_code: "ONLINE" },
      { handle: "nova_01", display_name: "Nova", country_code: "USA" },
      { handle: "nova_01", display_name: "Nova", bio: "x".repeat(281) },
    ]) {
      await expect(createPlayerProfile(client, bad)).rejects.toThrow();
    }
  });

  it("maps a duplicate own profile to ProfileAlreadyExistsError", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "player_profiles_pkey"',
        },
      },
      selectRows: { rows: [{ user_id: SESSION_USER_ID }] },
    });
    await expect(
      createPlayerProfile(client, { handle: "nova_01", display_name: "Nova" }),
    ).rejects.toBeInstanceOf(ProfileAlreadyExistsError);
  });

  it("maps a taken handle to HandleTakenError (accepted enumerable residual)", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "player_profiles_handle_lower_uniq"',
        },
      },
      selectRows: { rows: [] },
    });
    const failure = await createPlayerProfile(client, {
      handle: "nova_01",
      display_name: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(HandleTakenError);
    expect((failure as Error).message).toBe("This handle is already taken.");
  });

  it("maps CHECK violations to a safe validation error (no DB detail)", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: null,
        error: { code: "23514", message: "violates check constraint" },
      },
    });
    const failure = await createPlayerProfile(client, {
      handle: "nova_01",
      display_name: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProfileValidationError);
    expect((failure as Error).message).not.toContain("violates");
  });

  it("maps infrastructure failures to a safe retryable error", async () => {
    const { client } = fakeClient({
      rpcCreate: { data: null, error: { message: "connection reset" } },
    });
    const failure = await createPlayerProfile(client, {
      handle: "nova_01",
      display_name: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProfileOperationError);
    expect((failure as Error).message).not.toContain("reset");
  });

  it("fails closed when the RPC returns another identity", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: [{ ...PROFILE_ROW, user_id: OTHER_USER_ID }],
        error: null,
      },
    });
    await expect(
      createPlayerProfile(client, { handle: "nova_01", display_name: "Nova" }),
    ).rejects.toBeInstanceOf(ProfileOperationError);
  });

  it("fails closed when the RPC returns a discoverable row", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: [{ ...PROFILE_ROW, is_discoverable: true }],
        error: null,
      },
    });
    await expect(
      createPlayerProfile(client, { handle: "nova_01", display_name: "Nova" }),
    ).rejects.toBeInstanceOf(ProfileOperationError);
  });

  it("blocks suspended accounts with the generic account error", async () => {
    const { client } = fakeClient({ ensureStatus: "suspended" });
    const failure = await createPlayerProfile(client, {
      handle: "nova_01",
      display_name: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SuspendedError);
    expect((failure as Error).message).not.toContain(SESSION_USER_ID);
  });
});

describe("updatePlayerProfile — owner-only patch (07, 08 T2/T4)", () => {
  it("accepts no caller-supplied user ID (session wins by construction)", () => {
    expect(updatePlayerProfile.length).toBe(2);
  });

  it("rejects callers without a verified session", async () => {
    const { client } = fakeClient({ sessionUserId: null });
    await expect(
      updatePlayerProfile(client, { display_name: "Nova Prime" }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("writes only the allowlisted columns (no mass assignment)", async () => {
    let payload: unknown;
    const updated = { ...PROFILE_ROW, display_name: "Nova Prime" };
    const { client } = fakeClient({
      updateRows: { rows: [updated] },
      onUpdatePayload: (p) => {
        payload = p;
      },
    });
    const result = await updatePlayerProfile(client, {
      display_name: "Nova Prime",
    });
    expect(result.display_name).toBe("Nova Prime");
    expect(payload).toEqual({ display_name: "Nova Prime" });
  });

  it("supports clearing nullable fields with explicit null", async () => {
    let payload: unknown;
    const updated = { ...PROFILE_ROW, bio: null, country_code: null };
    const { client } = fakeClient({
      updateRows: { rows: [updated] },
      onUpdatePayload: (p) => {
        payload = p;
      },
    });
    await updatePlayerProfile(client, { bio: null, country_code: null });
    expect(payload).toEqual({ bio: null, country_code: null });
  });

  it("rejects ownership changes through the patch", async () => {
    const { client } = fakeClient({
      updateRows: { rows: [PROFILE_ROW] },
    });
    for (const bad of [
      { user_id: OTHER_USER_ID },
      { user_id: SESSION_USER_ID, display_name: "Nova" },
      { status: "active" },
      { handle: "new_handle" },
      { is_discoverable: true },
      { display_name: "Nova", is_discoverable: false },
    ]) {
      await expect(updatePlayerProfile(client, bad)).rejects.toThrow();
    }
  });

  it("rejects invalid country codes (incl. ONLINE) before any write", async () => {
    let wrote = false;
    const { client } = fakeClient({
      updateRows: { rows: [PROFILE_ROW] },
      onUpdatePayload: () => {
        wrote = true;
      },
    });
    await expect(
      updatePlayerProfile(client, { country_code: "ONLINE" }),
    ).rejects.toThrow();
    expect(wrote).toBe(false);
  });

  it("maps a missing profile to ProfileNotFoundError", async () => {
    const { client } = fakeClient({ updateRows: { rows: [] } });
    await expect(
      updatePlayerProfile(client, { display_name: "Nova Prime" }),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  it("maps CHECK violations to a safe validation error", async () => {
    const { client } = fakeClient({
      updateRows: {
        rows: [],
        error: { code: "23514", message: "violates check constraint" },
      },
    });
    const failure = await updatePlayerProfile(client, {
      display_name: "Nova Prime",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ProfileValidationError);
    expect((failure as Error).message).not.toContain("violates");
  });

  it("surfaces suspension distinctly from not-found on write denial", async () => {
    const { client } = fakeClient({
      ensureStatus: "suspended",
      updateRows: { rows: [] },
    });
    // The pre-gate already blocks suspended callers before the UPDATE.
    const failure = await updatePlayerProfile(client, {
      display_name: "Nova Prime",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SuspendedError);
  });

  it("fails closed when the UPDATE returns another identity", async () => {
    const { client } = fakeClient({
      updateRows: { rows: [{ ...PROFILE_ROW, user_id: OTHER_USER_ID }] },
    });
    await expect(
      updatePlayerProfile(client, { display_name: "Nova Prime" }),
    ).rejects.toBeInstanceOf(ProfileOperationError);
  });

  it("error messages expose no private information", async () => {
    const { client } = fakeClient({
      rpcCreate: {
        data: null,
        error: {
          code: "23505",
          message: `Key (handle)=(secret_handle) already exists for user ${OTHER_USER_ID}.`,
        },
      },
      selectRows: { rows: [] },
    });
    const failure = await createPlayerProfile(client, {
      handle: "nova_01",
      display_name: "Nova",
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(HandleTakenError);
    expect((failure as Error).message).not.toContain(OTHER_USER_ID);
    expect((failure as Error).message).not.toContain("secret_handle");
  });
});
