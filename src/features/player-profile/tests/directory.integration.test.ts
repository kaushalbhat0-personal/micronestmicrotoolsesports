// G1-4 live adversarial tests (12 section 5).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/verification/cleanup below (12 section 6). Run:
//   G1_TEST_MODE=g1-4 npm run test:integration -- directory.integration
// Fail closed: without G1_TEST_MODE=g1-4 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY records created by this run
// (exact tracked ids, reverse dependency order). Never truncate, never
// reset, never touch non-test records.
//
// NOTE: creating `g1t4_*` auth users + app rows + profiles and deleting them
// afterwards is an intentional, authorized write to the single project. RPC
// deployment itself is the reviewed G1-4 migration. No other writes occur.
//
// Authoritative: 04 sections 2/5/6, 05 section 5, 07 sections 1-4, 08
// T1/T3/T5/T8, 11 sections 3-4 (D-G1-03 + D-G1-04 Option A omit 2026-11-11).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createGameProfile,
  getOwnGameProfiles,
  updateGameProfile,
} from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";
import { setDiscoverability } from "../server/consent";
import {
  getPlayerByHandle,
  searchDirectory,
} from "../server/directory-reader";

const ENABLED = process.env.G1_TEST_MODE === "g1-4";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t4_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}_${who}`;
const PASSWORD = `T4st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

const FROZEN_KEYS = [
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
];

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
let tokenC = "";
let idA = "";
let idB = "";
let idC = "";
let handleA = "";
let handleB = "";
let handleC = "";

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

async function setDiscoverable(
  client: SupabaseClient,
  uid: string,
  value: boolean,
): Promise<void> {
  // G1-7 dedicated consent action is the only owner path (column-level
  // grants deny direct PostgREST writes to is_discoverable since the G1-7
  // bypass closure). The RPC predicate reads the stored flag.
  const profile = await setDiscoverability(client, {
    is_discoverable: value,
  });
  expect(profile.user_id).toBe(uid);
  expect(profile.is_discoverable).toBe(value);
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "directory projection integration (G1-4, real RLS + RPCs)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(anon, emailFor("a")));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(anon, emailFor("b")));
      ({ id: idC, accessToken: tokenC } = await signUpIdentity(anon, emailFor("c")));
      handleA = handleFor("a");
      handleB = handleFor("b");
      handleC = handleFor("c");

      // A: public, visible, active. Distinctive IGN carries ILIKE metachars.
      await createPlayerProfile(authedClient(tokenA), {
        handle: handleA,
        display_name: `${RUN_ID} Alpha`,
        bio: `${RUN_ID} alpha bio`,
        country_code: "IN",
      });
      await setDiscoverable(authedClient(tokenA), idA, true);
      await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "Pct_100%Sure",
        primary_role: "Scout",
        play_modes: ["squad", "tpp"],
        region_code: "india",
        availability: ["weekend"],
        game_user_id: "00998877",
      });

      // B: private by default (master off), visible game row.
      await createPlayerProfile(authedClient(tokenB), {
        handle: handleB,
        display_name: `${RUN_ID} Bravo`,
      });
      await createGameProfile(authedClient(tokenB), {
        game_key: "bgmi",
        ign: "QuietBravo",
        region_code: "asia",
      });

      // C: discoverable but game-hidden (is_visible false).
      await createPlayerProfile(authedClient(tokenC), {
        handle: handleC,
        display_name: `${RUN_ID} Charlie`,
      });
      await setDiscoverable(authedClient(tokenC), idC, true);
      await createGameProfile(authedClient(tokenC), {
        game_key: "bgmi",
        ign: "HiddenCharlie",
        region_code: "europe",
        is_visible: false,
      });
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      for (const uid of trackedUserIds) {
        await admin.from("player_game_profiles").delete().eq("player_user_id", uid);
      }
      await admin.from("games").update({ is_active: true }).eq("key", "bgmi");
      for (const uid of trackedUserIds) {
        await admin.from("player_profiles").delete().eq("user_id", uid);
        await admin
          .from("app_users")
          .update({ status: "active", suspended_at: null })
          .eq("id", uid);
        await admin.from("app_users").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }, 180_000);

    it("anonymous base-table reads are denied", async () => {
      const anon = anonClient();
      for (const table of ["app_users", "player_profiles", "player_game_profiles"]) {
        const res = await anon.from(table).select("id").limit(1);
        expect(res.data ?? []).toEqual([]);
      }
    });

    it("authenticated non-owners cannot read others' private rows", async () => {
      const other = await authedClient(tokenB)
        .from("player_game_profiles")
        .select("id,game_user_id")
        .eq("player_user_id", idA);
      expect(other.error).toBeNull();
      expect(other.data ?? []).toEqual([]);
      const canon = await authedClient(tokenB)
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect(canon.data ?? []).toEqual([]);
    });

    it("directory search returns only eligible rows with exact frozen keys", async () => {
      const cards = await searchDirectory(anonClient(), {});
      const handles = cards.map((c) => c.handle);
      expect(handles).toContain(handleA);
      expect(handles).not.toContain(handleB);
      expect(handles).not.toContain(handleC);
      expect(cards.length).toBeGreaterThanOrEqual(1);
      for (const card of cards) {
        expect(Object.keys(card)).toEqual(FROZEN_KEYS);
        expect(card).not.toHaveProperty("game_user_id");
        expect(card).not.toHaveProperty("user_id");
        expect(card).not.toHaveProperty("id");
      }
      const mine = cards.find((c) => c.handle === handleA);
      expect(mine?.game_name).toBe("Battlegrounds Mobile India");
      expect(mine?.ign).toBe("Pct_100%Sure");
      expect(mine?.avatar_url).toBeNull();
    });

    it("game_user_id is stored owner-private but never projected", async () => {
      const own = await getOwnGameProfiles(authedClient(tokenA));
      expect(own.find((g) => g.game_key === "bgmi")?.game_user_id).toBe("00998877");
      const cards = await searchDirectory(anonClient(), { query: "Pct_100" });
      expect(cards.length).toBeGreaterThanOrEqual(1);
      for (const card of cards) {
        expect(JSON.stringify(card)).not.toContain("00998877");
        expect(Object.keys(card)).toEqual(FROZEN_KEYS);
      }
    });

    it("consent withdrawal removes the row on the next call", async () => {
      await setDiscoverable(authedClient(tokenA), idA, false);
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.map((c) => c.handle)).not.toContain(handleA);
      const byHandle = await getPlayerByHandle(anonClient(), handleA);
      expect(byHandle).toBeNull();
      await setDiscoverable(authedClient(tokenA), idA, true);
      const back = await searchDirectory(anonClient(), {});
      expect(back.map((c) => c.handle)).toContain(handleA);
    });

    it("per-game invisibility hides that title only", async () => {
      await updateGameProfile(authedClient(tokenA), "bgmi", { is_visible: false });
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anonClient(), handleA)).toBeNull();
      await updateGameProfile(authedClient(tokenA), "bgmi", { is_visible: true });
      const back = await searchDirectory(anonClient(), {});
      expect(back.map((c) => c.handle)).toContain(handleA);
    });

    it("suspended accounts vanish from the directory", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idA);
      expect(susp.error).toBeNull();
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anonClient(), handleA)).toBeNull();
      const restore = await admin
        .from("app_users")
        .update({ status: "active", suspended_at: null })
        .eq("id", idA);
      expect(restore.error).toBeNull();
      const back = await searchDirectory(anonClient(), {});
      expect(back.map((c) => c.handle)).toContain(handleA);
    });

    it("inactive games hide joined rows while base rows survive", async () => {
      const admin = adminClient();
      const off = await admin
        .from("games")
        .update({ is_active: false })
        .eq("key", "bgmi");
      expect(off.error).toBeNull();
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anonClient(), handleA)).toBeNull();
      const own = await getOwnGameProfiles(authedClient(tokenA));
      expect(own.map((g) => g.game_key)).toContain("bgmi");
      const on = await admin
        .from("games")
        .update({ is_active: true })
        .eq("key", "bgmi");
      expect(on.error).toBeNull();
      const back = await searchDirectory(anonClient(), {});
      expect(back.map((c) => c.handle)).toContain(handleA);
    });

    it("handle lookup is case-insensitive and 404-equivalent", async () => {
      const anon = anonClient();
      const found = await getPlayerByHandle(anon, handleA.toUpperCase());
      expect(found?.handle).toBe(handleA);
      expect(Object.keys(found as unknown as Record<string, unknown>)).toEqual(
        FROZEN_KEYS,
      );
      // Missing, private and hidden are indistinguishable (all null).
      expect(await getPlayerByHandle(anon, "ghost_zzzz")).toBeNull();
      expect(await getPlayerByHandle(anon, handleB)).toBeNull();
      expect(await getPlayerByHandle(anon, handleC)).toBeNull();
    });

    it("filters narrow without leaking ineligible rows", async () => {
      const anon = anonClient();
      expect(
        (await searchDirectory(anon, { game: "bgmi" })).map((c) => c.handle),
      ).toContain(handleA);
      expect(
        (await searchDirectory(anon, { region: "india" })).map((c) => c.handle),
      ).toContain(handleA);
      expect(
        (await searchDirectory(anon, { role: "Scout" })).map((c) => c.handle),
      ).toContain(handleA);
      // Valid filters with no match: empty, no error.
      expect(await searchDirectory(anon, { region: "europe" })).toEqual([]);
      expect(await searchDirectory(anon, { role: "IGL" })).toEqual([]);
      // Well-formed but unknown values fail closed (empty, no oracle).
      expect(await searchDirectory(anon, { game: "valorant" })).toEqual([]);
      expect(await searchDirectory(anon, { region: "atlantis" })).toEqual([]);
      // Malformed values are rejected before any RPC call.
      await expect(searchDirectory(anon, { game: "BGMI!" })).rejects.toThrow();
      await expect(
        searchDirectory(anon, { game: "bgmi", region: "atlantis" }),
      ).rejects.toThrow();
    });

    it("free-text matching is literal: metacharacters are not wildcards", async () => {
      const anon = anonClient();
      const pct = await searchDirectory(anon, { query: "100%" });
      expect(pct.map((c) => c.handle)).toContain(handleA);
      // A bare % must match only rows containing a literal % (A's IGN),
      // never the whole directory.
      const bare = await searchDirectory(anon, { query: "%" });
      expect(bare.length).toBeGreaterThanOrEqual(1);
      expect(bare.map((c) => c.handle)).toContain(handleA);
      expect(bare.map((c) => c.handle)).not.toContain(handleB);
      const under = await searchDirectory(anon, { query: "_" });
      expect(under.map((c) => c.handle)).toContain(handleA);
      const slash = await searchDirectory(anon, { query: "\\" });
      expect(slash).toEqual([]);
    });

    it("injection strings remain data, pagination bounds hold", async () => {
      const anon = anonClient();
      expect(
        await searchDirectory(anon, { query: "'; DROP TABLE player_profiles; --" }),
      ).toEqual([]);
      expect(await searchDirectory(anon, { query: "' OR '1'='1" })).toEqual([]);
      // LIMIT floor is enforced SQL-side: 0 clamps to 1 (one row, no error).
      const one = await anon.rpc("search_player_directory", {
        p_game: null,
        p_region: null,
        p_role: null,
        p_query: null,
        p_limit: 0,
        p_offset: 0,
      });
      expect(one.error).toBeNull();
      expect(((one.data ?? []) as unknown[]).length).toBe(1);
      // Negative OFFSET clamps to 0 (rows returned, no error).
      const neg = await anon.rpc("search_player_directory", {
        p_game: null,
        p_region: null,
        p_role: null,
        p_query: null,
        p_limit: 24,
        p_offset: -5,
      });
      expect(neg.error).toBeNull();
      expect(((neg.data ?? []) as unknown[]).length).toBeGreaterThanOrEqual(1);
      // Far OFFSET (clamped server-side) stays empty without error.
      const far = await anon.rpc("search_player_directory", {
        p_game: null,
        p_region: null,
        p_role: null,
        p_query: null,
        p_limit: 24,
        p_offset: 5000,
      });
      expect(far.error).toBeNull();
      expect(far.data ?? []).toEqual([]);
      // Malformed handle never reaches the RPC as a match.
      await expect(getPlayerByHandle(anon, "a".repeat(64))).rejects.toThrow();
    });

    it("G1-1/G1-2/G1-3 owner flows still work (regression)", async () => {
      const own = await getOwnGameProfiles(authedClient(tokenB));
      expect(own.length).toBeGreaterThanOrEqual(1);
      expect(own.every((g) => g.player_user_id === idB)).toBe(true);
      const updated = await updateGameProfile(authedClient(tokenB), "bgmi", {
        availability: ["weekend"],
      });
      expect(updated.availability).toEqual(["weekend"]);
      expect(updated.game_user_id).toBeNull();
    });
  },
);
