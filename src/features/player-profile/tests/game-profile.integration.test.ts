// G1-3 live adversarial tests (12 section 4).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/verification/cleanup below (12 section 6). Run:
//   G1_TEST_MODE=g1-3 npm run test:integration
// Fail closed: without G1_TEST_MODE=g1-3 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY rows/records created by this
// run (exact tracked ids, reverse dependency order). Never truncate, never
// reset, never touch non-test records.
//
// NOTE: creating `g1t3_*` auth users + app rows + profiles + a temporary
// second catalogue row, and deleting them afterwards, is an intentional,
// authorized write to the single project. No other writes occur.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { UnauthenticatedError } from "../domain/app-user";
import {
  GameProfileAlreadyExistsError,
  GameProfileNotFoundError,
  MissingPlayerProfileError,
  UnsupportedGameError,
} from "../domain/game-profile";
import { SuspendedError } from "../domain/app-user";
import {
  createGameProfile,
  getOwnGameProfiles,
  listSupportedGames,
  updateGameProfile,
} from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";

const ENABLED = process.env.G1_TEST_MODE === "g1-3";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t3_${Date.now().toString(36)}`;
const TS = Date.now().toString(36);
const emailFor = (who: "a" | "b") => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: "a" | "b") => `${RUN_ID}_${who}`;
const SECOND_GAME_KEY = `g1t3${TS}`.slice(0, 20);
const PASSWORD = `T3st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

function anonClient(): SupabaseClient {
  return createClient(URL, ANON);
}

function authedClient(accessToken: string): SupabaseClient {
  return createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const trackedUserIds: string[] = [];
let tokenA = "";
let tokenB = "";
let idA = "";
let idB = "";

async function signUpIdentity(
  anon: SupabaseClient,
  email: string,
): Promise<{ id: string; accessToken: string }> {
  const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`BLOCKED: signUp failed: ${error.message}`);
  let session = data.session;
  if (!session) {
    const retry = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (retry.error || !retry.data.session) {
      throw new Error(
        "BLOCKED: no session issued (email confirmation likely required); cannot establish isolated test identities without weakening security.",
      );
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "gameProfile integration (G1-3, real RLS)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(anon, emailFor("a")));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(anon, emailFor("b")));
    }, 120_000);

    afterAll(async () => {
      // Best-effort, ownership-verified cleanup: only tracked ids, exact
      // match, reverse dependency order. Safety-restores shared invariants.
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      for (const uid of trackedUserIds) {
        await admin.from("player_game_profiles").delete().eq("player_user_id", uid);
      }
      await admin.from("games").delete().eq("key", SECOND_GAME_KEY);
      await admin.from("games").update({ is_active: true }).eq("key", "bgmi");
      for (const uid of trackedUserIds) {
        await admin.from("player_profiles").delete().eq("user_id", uid);
        await admin.from("app_users").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }, 120_000);

    it("creates no canonical or game rows at signup", async () => {
      const admin = adminClient();
      const { data: pp } = await admin
        .from("player_profiles")
        .select("user_id")
        .in("user_id", [idA, idB]);
      expect(pp ?? []).toEqual([]);
      const { data: gp } = await admin
        .from("player_game_profiles")
        .select("id")
        .in("player_user_id", [idA, idB]);
      expect(gp ?? []).toEqual([]);
    });

    it("unauthenticated game operations are rejected", async () => {
      const anon = anonClient();
      await expect(getOwnGameProfiles(anon)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
      await expect(
        createGameProfile(anon, { game_key: "bgmi", ign: "Anon" }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
      await expect(
        updateGameProfile(anon, "bgmi", { ign: "Anon" }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
      // The public catalogue is the only anon-safe read.
      const games = await listSupportedGames(anon);
      expect(games.map((g) => g.key)).toContain("bgmi");
    });

    it("anonymous callers see the catalogue but no private game rows", async () => {
      const anon = anonClient();
      const bgmi = await anon.from("games").select("key,is_active").eq("key", "bgmi");
      expect((bgmi.data ?? []) as unknown[]).toHaveLength(1);
      const rows = await anon
        .from("player_game_profiles")
        .select("id")
        .eq("player_user_id", idA);
      expect(rows.data ?? []).toEqual([]);
      const rpcDenied = await anon.rpc("create_player_profile", {
        p_handle: "x",
        p_display_name: "x",
        p_bio: null,
        p_country_code: null,
      });
      expect(rpcDenied.error).not.toBeNull();
    });

    it("game creation requires an existing canonical profile", async () => {
      await expect(
        createGameProfile(authedClient(tokenA), {
          game_key: "bgmi",
          ign: "NoCanon",
        }),
      ).rejects.toBeInstanceOf(MissingPlayerProfileError);
    });

    it("owner creates a canonical profile, then a BGMI game profile", async () => {
      const profile = await createPlayerProfile(authedClient(tokenA), {
        handle: handleFor("a"),
        display_name: "G1T3 Alice",
      });
      expect(profile.user_id).toBe(idA);

      const gp = await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "AliceIGL",
        primary_role: "IGL",
        play_modes: ["squad", "tpp"],
        region_code: "india",
        availability: ["weekend"],
        game_user_id: "001234",
      });
      expect(gp.player_user_id).toBe(idA);
      expect(gp.game_key).toBe("bgmi");
      expect(gp.ign).toBe("AliceIGL");
      expect(gp.is_visible).toBe(true);
      expect(gp.play_modes).toEqual(["squad", "tpp"]);
      expect(gp.region_code).toBe("india");
      // Owner-private identifier is stored and owner-readable (G1 omits it
      // from future projections per D-G1-03; D-G1-04 stays open).
      expect(gp.game_user_id).toBe("001234");
    });

    it("inactive titles are hidden from creation; existing rows preserved", async () => {
      const admin = adminClient();
      // A has no second title to test with yet, so use a fresh supported
      // check: deactivate bgmi, attempt creation for B (canonical first).
      await createPlayerProfile(authedClient(tokenB), {
        handle: handleFor("b"),
        display_name: "G1T2 Bob",
      });
      const off = await admin
        .from("games")
        .update({ is_active: false })
        .eq("key", "bgmi");
      expect(off.error).toBeNull();
      await expect(
        createGameProfile(authedClient(tokenB), {
          game_key: "bgmi",
          ign: "BobScout",
        }),
      ).rejects.toBeInstanceOf(UnsupportedGameError);
      const on = await admin
        .from("games")
        .update({ is_active: true })
        .eq("key", "bgmi");
      expect(on.error).toBeNull();
      // A's existing profile survived deactivation untouched.
      const own = await getOwnGameProfiles(authedClient(tokenA));
      expect(own.map((g) => g.game_key)).toEqual(["bgmi"]);
    });

    it("duplicate (player, game) creation is a predictable domain error", async () => {
      await expect(
        createGameProfile(authedClient(tokenA), {
          game_key: "bgmi",
          ign: "AliceAgain",
        }),
      ).rejects.toBeInstanceOf(GameProfileAlreadyExistsError);
      const admin = adminClient();
      const { data } = await admin
        .from("player_game_profiles")
        .select("id")
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      expect((data ?? []).length).toBe(1);
    });

    it("invalid game keys, roles, modes, regions and availability rejected", async () => {
      const client = authedClient(tokenA);
      // Malformed key: Zod boundary.
      await expect(
        createGameProfile(client, { game_key: "BGMI!", ign: "Xx" }),
      ).rejects.toThrow();
      // Well-formed but unsupported: catalogue authority, no oracle.
      await expect(
        createGameProfile(client, { game_key: "valorant", ign: "Nova" }),
      ).rejects.toBeInstanceOf(UnsupportedGameError);
      // Frozen vocabularies: Zod boundary.
      for (const bad of [
        { game_key: "bgmi", ign: "x" },
        { game_key: "bgmi", ign: "Nova", primary_role: "Sniper" },
        { game_key: "bgmi", ign: "Nova", play_modes: ["ranked"] },
        { game_key: "bgmi", ign: "Nova", region_code: "atlantis" },
        { game_key: "bgmi", ign: "Nova", region_code: "IN" },
        {
          game_key: "bgmi",
          ign: "Nova",
          availability: new Array(8).fill("weekend"),
        },
      ]) {
        await expect(createGameProfile(client, bad)).rejects.toThrow();
      }
      // region_code 'IN' (a country) is not a game region — D-G1-09 kept
      // separate. ONLINE is the only cross-listed token, and only here.
      const online = await createGameProfile(authedClient(tokenB), {
        game_key: "bgmi",
        ign: "BobOnline",
        region_code: "online",
      });
      expect(online.region_code).toBe("online");
    });

    it("concurrent duplicate creation cannot create duplicates", async () => {
      // B owns exactly one bgmi row now (online-region row above).
      const admin = adminClient();
      await admin
        .from("player_game_profiles")
        .delete()
        .eq("player_user_id", idB)
        .eq("game_key", "bgmi");
      const client = authedClient(tokenB);
      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          createGameProfile(client, { game_key: "bgmi", ign: "BobRace" }),
        ),
      );
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length + rejected.length).toBe(5);
      for (const r of rejected) {
        expect(
          (r as PromiseRejectedResult).reason instanceof
            GameProfileAlreadyExistsError,
        ).toBe(true);
      }
      const { data } = await admin
        .from("player_game_profiles")
        .select("id")
        .eq("player_user_id", idB)
        .eq("game_key", "bgmi");
      expect((data ?? []).length).toBe(1);
    });

    it("one player may hold profiles for multiple games (catalogue row only)", async () => {
      const admin = adminClient();
      const seed = await admin.from("games").insert({
        key: SECOND_GAME_KEY,
        name: "G1T3 Test Title",
        short_name: "G1T3",
        is_active: true,
      });
      expect(seed.error).toBeNull();
      try {
        // New title, same canonical profile: no schema change.
        const second = await createGameProfile(authedClient(tokenB), {
          game_key: SECOND_GAME_KEY,
          ign: "BobSecond",
        });
        expect(second.game_key).toBe(SECOND_GAME_KEY);
        const { data } = await admin
          .from("player_game_profiles")
          .select("game_key")
          .eq("player_user_id", idB);
        expect(((data ?? []) as Array<{ game_key: string }>).map((r) => r.game_key).sort()).toEqual(
          ["bgmi", SECOND_GAME_KEY].sort(),
        );
      } finally {
        await admin
          .from("player_game_profiles")
          .delete()
          .eq("player_user_id", idB)
          .eq("game_key", SECOND_GAME_KEY);
        await admin.from("games").delete().eq("key", SECOND_GAME_KEY);
      }
      const { data: seedGone } = await admin
        .from("games")
        .select("key")
        .eq("key", SECOND_GAME_KEY);
      expect(seedGone ?? []).toEqual([]);
    });

    it("user A cannot read user B's private game rows", async () => {
      const other = await authedClient(tokenA)
        .from("player_game_profiles")
        .select("id,game_user_id")
        .eq("player_user_id", idB);
      expect(other.error).toBeNull();
      expect(other.data ?? []).toEqual([]);
      // Owner still reads their own rows, identifier included.
      const own = await getOwnGameProfiles(authedClient(tokenB));
      expect(own.length).toBeGreaterThanOrEqual(1);
      expect(own[0]?.player_user_id).toBe(idB);
    });

    it("user A cannot update user B's game profile", async () => {
      const upd = await authedClient(tokenA)
        .from("player_game_profiles")
        .update({ ign: "Hijacked" })
        .eq("player_user_id", idB)
        .eq("game_key", "bgmi")
        .select("id");
      expect((upd.data ?? []) as unknown[]).toEqual([]);
      const admin = adminClient();
      const { data } = await admin
        .from("player_game_profiles")
        .select("ign")
        .eq("player_user_id", idB)
        .eq("game_key", "bgmi");
      expect(data?.[0]?.ign).not.toBe("Hijacked");
    });

    it("user A cannot create a game profile owned by user B", async () => {
      const { error } = await authedClient(tokenA)
        .from("player_game_profiles")
        .insert({ player_user_id: idB, game_key: "bgmi", ign: "Forgery" });
      expect(error).not.toBeNull();
    });

    it("ownership transfer is impossible", async () => {
      const upd = await authedClient(tokenA)
        .from("player_game_profiles")
        .update({ player_user_id: idB })
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      const admin = adminClient();
      const { data } = await admin
        .from("player_game_profiles")
        .select("player_user_id")
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      expect((data ?? []).length).toBe(1);
      expect(
        upd.error !== null || ((upd.data ?? []) as unknown[]).length === 0,
      ).toBe(true);
    });

    it("owner update works and leaves the canonical profile unchanged", async () => {
      const admin = adminClient();
      const before = await admin
        .from("player_profiles")
        .select("handle,display_name,bio,country_code,is_discoverable")
        .eq("user_id", idA);
      const updated = await updateGameProfile(authedClient(tokenA), "bgmi", {
        ign: "AlicePrime",
        region_code: "asia",
        is_visible: false,
      });
      expect(updated.ign).toBe("AlicePrime");
      expect(updated.region_code).toBe("asia");
      expect(updated.is_visible).toBe(false);
      const after = await admin
        .from("player_profiles")
        .select("handle,display_name,bio,country_code,is_discoverable")
        .eq("user_id", idA);
      expect(after.data).toEqual(before.data);
    });

    it("mass assignment of ownership fields is rejected", async () => {
      await expect(
        createGameProfile(authedClient(tokenA), {
          game_key: "bgmi",
          ign: "Nova",
          player_user_id: idB,
        }),
      ).rejects.toThrow();
      await expect(
        updateGameProfile(authedClient(tokenA), "bgmi", {
          ign: "Nova",
          player_user_id: idB,
        }),
      ).rejects.toThrow();
      await expect(
        updateGameProfile(authedClient(tokenA), "bgmi", {
          ign: "Nova",
          game_key: "bgmi",
        }),
      ).rejects.toThrow();
    });

    it("invalid updates rejected at Zod and CHECK layers", async () => {
      await expect(
        updateGameProfile(authedClient(tokenA), "bgmi", { ign: "x" }),
      ).rejects.toThrow();
      await expect(
        updateGameProfile(authedClient(tokenA), "bgmi", {
          region_code: "atlantis",
        }),
      ).rejects.toThrow();
      const bad = await authedClient(tokenA)
        .from("player_game_profiles")
        .update({ primary_role: "Sniper" })
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      expect(bad.error).not.toBeNull();
      await expect(
        updateGameProfile(authedClient(tokenA), "a".repeat(25), {
          ign: "Nope",
        }),
      ).rejects.toThrow();
    });

    it("missing game profile maps to a safe not-found error", async () => {
      // Shaped-but-unsupported key: passes Zod, matches zero owned rows.
      await expect(
        updateGameProfile(authedClient(tokenA), "valorant", { ign: "Ghost" }),
      ).rejects.toBeInstanceOf(GameProfileNotFoundError);
    });

    it("owner DELETE removes only the caller's game row (D-G1-07 approved, G1-7)", async () => {
      // G1-7 approves hard deletion of an individual game profile: the
      // owner's DELETE succeeds for their own (player, game) row only. The
      // canonical profile and the catalogue entry survive. The row is
      // recreated afterwards so the lane stays tidy.
      const del = await authedClient(tokenA)
        .from("player_game_profiles")
        .delete()
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi")
        .select("id");
      expect(del.error).toBeNull();
      const admin = adminClient();
      const { data } = await admin
        .from("player_game_profiles")
        .select("id")
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      expect(data ?? []).toEqual([]);
      const { data: canon } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect((canon ?? []).length).toBe(1);
      const recreated = await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "AliceScout",
        region_code: "india",
      });
      expect(recreated.player_user_id).toBe(idA);
    });

    it("catalogue writes are denied to authenticated users", async () => {
      const client = authedClient(tokenA);
      const ins = await client.from("games").insert({
        key: "evil-title",
        name: "Evil",
        short_name: "EV",
      });
      expect(ins.error).not.toBeNull();
      const upd = await client
        .from("games")
        .update({ is_active: false })
        .eq("key", "bgmi");
      const admin = adminClient();
      const { data } = await admin
        .from("games")
        .select("is_active")
        .eq("key", "bgmi");
      expect(data?.[0]?.is_active).toBe(true);
      expect(upd.error !== null || ((upd.data ?? []) as unknown[]).length === 0).toBe(
        true,
      );
    });

    it("suspended accounts cannot write; own reads stay allowed", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idB);
      expect(susp.error).toBeNull();

      await expect(getOwnGameProfiles(authedClient(tokenB))).resolves.toMatchObject([
        { player_user_id: idB },
      ]);
      await expect(
        createGameProfile(authedClient(tokenB), {
          game_key: "bgmi",
          ign: "Blocked",
        }),
      ).rejects.toBeInstanceOf(SuspendedError);
      const updateFailure = await updateGameProfile(authedClient(tokenB), "bgmi", {
        ign: "Blocked",
      }).catch((e: unknown) => e);
      expect(updateFailure).toBeInstanceOf(SuspendedError);
      expect((updateFailure as Error).message).not.toContain(idB);

      const direct = await authedClient(tokenB)
        .from("player_game_profiles")
        .update({ ign: "Hijacked While Suspended" })
        .eq("player_user_id", idB)
        .eq("game_key", "bgmi")
        .select("id");
      expect((direct.data ?? []) as unknown[]).toEqual([]);
    });
  },
);
