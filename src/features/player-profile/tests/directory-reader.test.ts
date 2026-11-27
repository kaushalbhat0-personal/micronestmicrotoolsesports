// G1-4 directory-reader unit tests (mocked client, no network).
// Lane: pure unit. RLS + RPC semantics are proven in the live integration
// lane; these tests prove Zod boundaries, strict 12-key mapping, avatar
// resolution, per-game allowlists and safe error mapping.
//
// Authoritative: 04 sections 5-6, 05 section 5, 07 sections 1-4,
//   08 T1/T3/T5/T8, 11 sections 3-4 (D-G1-03 + D-G1-04 Option A).

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  DirectoryOperationError,
  DirectoryValidationError,
} from "../domain/directory";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import { getPlayerByHandle, searchDirectory } from "../server/directory-reader";

const FROZEN_KEYS = [...PUBLIC_PROJECTION_COLUMNS];

const RPC_ROW = {
  handle: "nova_01",
  display_name: "Nova",
  avatar_url: null,
  bio: "BGMI scout",
  country_code: "IN",
  game_key: "bgmi",
  game_name: "Battlegrounds Mobile India",
  ign: "NovaScout",
  primary_role: "Scout",
  play_modes: ["squad", "tpp"],
  region_code: "india",
  availability: ["weekend"],
};

interface FakeOpts {
  rows?: unknown[] | null;
  rpcError?: unknown;
  onRpcArgs?: (fn: string, args: unknown) => void;
  publicUrl?: string | null;
}

function fakeClient(opts: FakeOpts = {}): { client: SupabaseClient } {
  const rpc = vi.fn(async (fn: string, args: unknown) => {
    opts.onRpcArgs?.(fn, args);
    if (opts.rpcError !== undefined) {
      return { data: null, error: opts.rpcError };
    }
    return { data: opts.rows ?? [], error: null };
  });
  const getPublicUrl = vi.fn((path: string) => ({
    data: {
      publicUrl:
        opts.publicUrl !== undefined
          ? opts.publicUrl
          : `https://cdn.example/storage/v1/object/public/public-avatars/${path}`,
    },
  }));
  const client = {
    rpc,
    storage: { from: vi.fn((_bucket: string) => ({ getPublicUrl })) },
  };
  return { client: client as unknown as SupabaseClient };
}

describe("searchDirectory — frozen contract (05 §5, 11 §3)", () => {
  it("applies frozen defaults and passes explicit NULL filters", async () => {
    const seen: { fn?: string; args?: unknown } = {};
    const { client } = fakeClient({
      rows: [],
      onRpcArgs: (fn, args) => {
        seen.fn = fn;
        seen.args = args;
      },
    });
    await expect(searchDirectory(client, {})).resolves.toEqual([]);
    expect(seen?.fn).toBe("search_player_directory");
    expect(seen?.args).toEqual({
      p_game: null,
      p_region: null,
      p_role: null,
      p_query: null,
      p_limit: 24,
      p_offset: 0,
    });
  });

  it("returns exactly the frozen 12 keys in frozen order", async () => {
    const { client } = fakeClient({ rows: [{ ...RPC_ROW }] });
    const cards = await searchDirectory(client, {});
    expect(cards).toHaveLength(1);
    expect(Object.keys(cards[0] as unknown as Record<string, unknown>)).toEqual(
      FROZEN_KEYS,
    );
  });

  it("rejects RPC rows with extra keys instead of forwarding them", async () => {
    // Drift tripwire: if the RPC definition ever widens (e.g. a future
    // game_user_id leak), the reader fails closed rather than passing the
    // extra keys through. The live key-set test pins the RPC itself.
    const { client } = fakeClient({
      rows: [
        {
          ...RPC_ROW,
          game_user_id: "001234",
          id: "33333333-3333-4333-8333-333333333333",
          user_id: "11111111-1111-4111-8111-111111111111",
          email: "nova@example.com",
          created_at: "2026-11-10T00:00:00.000Z",
        },
      ],
    });
    const failure = await searchDirectory(client, {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(DirectoryOperationError);
  });

  it("resolves the stored avatar path to a public URL, NULL stays NULL", async () => {
    const uid = "11111111-1111-4111-8111-111111111111";
    const { client } = fakeClient({
      rows: [
        { ...RPC_ROW, avatar_url: `${uid}/avatar.png` },
        { ...RPC_ROW, handle: "nova_02", avatar_url: null },
      ],
    });
    const cards = await searchDirectory(client, {});
    expect(cards[0]?.avatar_url).toContain(`${uid}/avatar.png`);
    expect(cards[1]?.avatar_url).toBeNull();
  });

  it("derives game_name from the catalogue join", async () => {
    const { client } = fakeClient({ rows: [{ ...RPC_ROW }] });
    const cards = await searchDirectory(client, {});
    expect(cards[0]?.game_name).toBe("Battlegrounds Mobile India");
  });

  it("rejects malformed inputs at the Zod boundary", async () => {
    const { client } = fakeClient({ rows: [] });
    await expect(
      searchDirectory(client, { limit: 0 }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { limit: 49 }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { offset: -1 }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { query: "x".repeat(121) }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { game: "BGMI!" }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { limit: 10, user_id: "forged" }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
  });

  it("rejects off-vocabulary region/role for the known game", async () => {
    const { client } = fakeClient({ rows: [] });
    await expect(
      searchDirectory(client, { game: "bgmi", region: "atlantis" }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    await expect(
      searchDirectory(client, { game: "bgmi", role: "Sniper" }),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
    // In-vocabulary values pass through to the RPC.
    let seen: unknown = null;
    const { client: c2 } = fakeClient({
      rows: [],
      onRpcArgs: (_fn, args) => {
        seen = args;
      },
    });
    await searchDirectory(c2, {
      game: "bgmi",
      region: "online",
      role: "IGL",
      query: "nova",
      limit: 10,
      offset: 5,
    });
    expect(seen).toEqual({
      p_game: "bgmi",
      p_region: "online",
      p_role: "IGL",
      p_query: "nova",
      p_limit: 10,
      p_offset: 5,
    });
  });

  it("maps RPC failures to a safe generic error", async () => {
    const { client } = fakeClient({
      rpcError: { message: "connection reset by peer", code: "XX000" },
    });
    const failure = await searchDirectory(client, {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(DirectoryOperationError);
    expect((failure as Error).message).not.toContain("reset");
  });

  it("fails closed on malformed RPC rows", async () => {
    const { client } = fakeClient({ rows: [{ ...RPC_ROW, ign: 42 }] });
    await expect(searchDirectory(client, {})).rejects.toBeInstanceOf(
      DirectoryOperationError,
    );
  });
});

describe("getPlayerByHandle — 404-equivalence (05 §5, 08 T5/T8)", () => {
  it("accepts a raw handle string and normalizes", async () => {
    let seen: unknown = null;
    const { client } = fakeClient({
      rows: [{ ...RPC_ROW }],
      onRpcArgs: (_fn, args) => {
        seen = args;
      },
    });
    const card = await getPlayerByHandle(client, "Nova_01");
    expect(seen).toEqual({ p_handle: "nova_01" });
    expect(card?.handle).toBe("nova_01");
    expect(Object.keys(card as unknown as Record<string, unknown>)).toEqual(FROZEN_KEYS);
  });

  it("returns null for empty sets without distinction", async () => {
    const { client } = fakeClient({ rows: [] });
    await expect(getPlayerByHandle(client, "ghost_99")).resolves.toBeNull();
  });

  it("rejects invalid handle syntax", async () => {
    const { client } = fakeClient({ rows: [] });
    await expect(getPlayerByHandle(client, "ab")).rejects.toBeInstanceOf(
      DirectoryValidationError,
    );
    await expect(
      getPlayerByHandle(client, "../admin"),
    ).rejects.toBeInstanceOf(DirectoryValidationError);
  });

  it("fails closed on multi-row anomalies", async () => {
    const { client } = fakeClient({ rows: [{ ...RPC_ROW }, { ...RPC_ROW }] });
    await expect(getPlayerByHandle(client, "nova_01")).rejects.toBeInstanceOf(
      DirectoryOperationError,
    );
  });

  it("maps RPC failures to a safe generic error", async () => {
    const { client } = fakeClient({
      rpcError: { message: "row-level security boom", code: "42501" },
    });
    const failure = await getPlayerByHandle(client, "nova_01").catch(
      (e: unknown) => e,
    );
    expect(failure).toBeInstanceOf(DirectoryOperationError);
    expect((failure as Error).message).not.toContain("boom");
  });
});
