// G1-7 live adversarial tests (12 section 5).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/verification/cleanup below (12 section 6). Run:
//   G1_TEST_MODE=g1-7 npm run test:integration -- lifecycle.integration
// Fail closed: without G1_TEST_MODE=g1-7 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY records created by this run
// (exact tracked ids, reverse dependency order). Never truncate, never
// reset, never touch non-test records.
//
// NOTE: creating `g1t7_*` auth users + app rows + profiles and deleting them
// afterwards is an intentional, authorized write to the single project.
// The G1-7 migration itself is the reviewed additive migration. No other
// writes occur.
//
// Authoritative: D-G1-05 Option A, D-G1-07 Option A, D-G1-08 approved set,
// discoverability copy (all 2026-11-11); 04 sections 2/4/7, 05 (DELETE
// policies/grants, column grants, DEFINER functions), 06 section 5, 07
// (setDiscoverability/updateHandle/removeGameProfile/deletePlayerProfile),
// 08 T1/T2/T4/T5/T6/T8.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import { getProfileCompleteness } from "../server/completeness";
import {
  getDiscoverabilityState,
  setDiscoverability,
} from "../server/consent";
import {
  deletePlayerProfile,
  removeGameProfile,
} from "../server/deletion";
import {
  getPlayerByHandle,
  searchDirectory,
} from "../server/directory-reader";
import {
  createGameProfile,
  updateGameProfile,
} from "../server/game-profile";
import { setGameProfileVisibility } from "../server/game-visibility";
import {
  HandleCooldownError,
  HandleTakenError,
} from "../domain/player-profile";
import { getHandleChangeState, updateHandle } from "../server/handle";
import { createPlayerProfile, updatePlayerProfile } from "../server/player-profile";
import { uploadAvatar } from "../server/avatar";

const ENABLED = process.env.G1_TEST_MODE === "g1-7";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t7_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}_${who}`;
const PASSWORD = `T7st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

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
let idA = "";
let idB = "";
let handleA = "";
let handleB = "";
let handleA2 = "";

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
  "owner settings lifecycle integration (G1-7, real RLS + DEFINER)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(anon, emailFor("a")));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(anon, emailFor("b")));
      handleA = handleFor("a");
      handleB = handleFor("b");
      handleA2 = `${handleA}2`.slice(0, 20);

      await createPlayerProfile(authedClient(tokenA), {
        handle: handleA,
        display_name: `${RUN_ID} Alice`,
        bio: `${RUN_ID} alice bio`,
      });
      await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "AliceScout",
        region_code: "india",
      });
      await createPlayerProfile(authedClient(tokenB), {
        handle: handleB,
        display_name: `${RUN_ID} Bob`,
      });
      await createGameProfile(authedClient(tokenB), {
        game_key: "bgmi",
        ign: "BobIGL",
        region_code: "asia",
      });
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      for (const uid of trackedUserIds) {
        await admin.storage.from("public-avatars").remove([
          `${uid}/avatar.png`,
          `${uid}/avatar.jpg`,
          `${uid}/avatar.jpeg`,
          `${uid}/avatar.webp`,
        ]);
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

    it("consent defaults off; owner can enable and disable", async () => {
      // Fresh profiles default to undiscoverable (creation forces false).
      await expect(getDiscoverabilityState(authedClient(tokenA))).resolves.toEqual({
        is_discoverable: false,
      });
      const enabled = await setDiscoverability(authedClient(tokenA), {
        is_discoverable: true,
      });
      expect(enabled.user_id).toBe(idA);
      expect(enabled.is_discoverable).toBe(true);
      await expect(getDiscoverabilityState(authedClient(tokenA))).resolves.toEqual({
        is_discoverable: true,
      });
      const disabled = await setDiscoverability(authedClient(tokenA), {
        is_discoverable: false,
      });
      expect(disabled.is_discoverable).toBe(false);
      await setDiscoverability(authedClient(tokenA), { is_discoverable: true });
    });

    it("direct PostgREST writes to consent/handle are denied (bypass closed)", async () => {
      // Column-level grants deny direct writes even though the RLS row
      // predicate would match. The DEFINER functions are the only path.
      const consentDirect = await authedClient(tokenA)
        .from("player_profiles")
        .update({ is_discoverable: false })
        .eq("user_id", idA);
      expect(consentDirect.error).not.toBeNull();
      const handleDirect = await authedClient(tokenA)
        .from("player_profiles")
        .update({ handle: `${handleA}x` })
        .eq("user_id", idA);
      expect(handleDirect.error).not.toBeNull();
      // Stored values are untouched.
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("handle,is_discoverable")
        .eq("user_id", idA);
      expect(data?.[0]?.handle).toBe(handleA);
      expect(data?.[0]?.is_discoverable).toBe(true);
      // Approved generic columns still write (no regression from tightening).
      const patched = await updatePlayerProfile(authedClient(tokenA), {
        display_name: `${RUN_ID} Alice Prime`,
      });
      expect(patched.display_name).toBe(`${RUN_ID} Alice Prime`);
    });

    it("consent withdrawal hides public rows on the next call; re-enable restores", async () => {
      const anon = anonClient();
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).toContain(handleA);
      await setDiscoverability(authedClient(tokenA), { is_discoverable: false });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anon, handleA)).toBeNull();
      await setDiscoverability(authedClient(tokenA), { is_discoverable: true });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).toContain(handleA);
    });

    it("per-game visibility works independently; master off overrides on", async () => {
      const anon = anonClient();
      await setGameProfileVisibility(authedClient(tokenA), "bgmi", { is_visible: false });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anon, handleA)).toBeNull();
      await updateGameProfile(authedClient(tokenA), "bgmi", { is_visible: true });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).toContain(handleA);
      // Master off suppresses even a visible game row.
      await setDiscoverability(authedClient(tokenA), { is_discoverable: false });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).not.toContain(handleA);
      await setDiscoverability(authedClient(tokenA), { is_discoverable: true });
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).toContain(handleA);
    });

    it("another user cannot change consent or visibility", async () => {
      // B toggles only B's own state; A's stored flags are unaffected.
      await setDiscoverability(authedClient(tokenB), { is_discoverable: true });
      await setGameProfileVisibility(authedClient(tokenB), "bgmi", { is_visible: false });
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("is_discoverable")
        .eq("user_id", idA);
      expect(data?.[0]?.is_discoverable).toBe(true);
      const { data: games } = await admin
        .from("player_game_profiles")
        .select("is_visible")
        .eq("player_user_id", idA)
        .eq("game_key", "bgmi");
      expect(games?.[0]?.is_visible).toBe(true);
      // Restore B to a visible baseline for the public regression below.
      await setGameProfileVisibility(authedClient(tokenB), "bgmi", { is_visible: true });
    });

    it("first handle change succeeds and stamps the cooldown", async () => {
      const changed = await updateHandle(authedClient(tokenA), { handle: handleA2 });
      expect(changed.user_id).toBe(idA);
      expect(changed.handle).toBe(handleA2);
      expect(changed.handle_changed_at).not.toBeNull();
      const state = await getHandleChangeState(authedClient(tokenA));
      expect(state.handle).toBe(handleA2);
      expect(state.nextEligibleAt).not.toBeNull();
      // Generic patch still rejects handle.
      await expect(
        updatePlayerProfile(authedClient(tokenA), {
          display_name: "X",
          handle: "rejected",
        }),
      ).rejects.toThrow();
    });

    it("second change before cooldown is rejected; failures do not advance it", async () => {
      const admin = adminClient();
      const before = await admin
        .from("player_profiles")
        .select("handle_changed_at")
        .eq("user_id", idA);
      const stampBefore = before.data?.[0]?.handle_changed_at as string;
      const failure = await updateHandle(authedClient(tokenA), {
        handle: `${handleA2}x`,
      }).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(HandleCooldownError);
      const after = await admin
        .from("player_profiles")
        .select("handle_changed_at")
        .eq("user_id", idA);
      expect(after.data?.[0]?.handle_changed_at).toBe(stampBefore);
      // Collision does not advance the cooldown either: B targets A's handle.
      const collision = await updateHandle(authedClient(tokenB), {
        handle: handleA2,
      }).catch((e: unknown) => e);
      expect(collision).toBeInstanceOf(HandleTakenError);
      const bRow = await admin
        .from("player_profiles")
        .select("handle,handle_changed_at")
        .eq("user_id", idB);
      expect(bRow.data?.[0]?.handle).toBe(handleB);
      expect(bRow.data?.[0]?.handle_changed_at).toBeNull();
    });

    it("change after the cooldown window succeeds (test-owned backdate only)", async () => {
      // The 30-day wait is simulated by backdating ONLY this run's own row
      // via the privileged test client — production logic is untouched.
      const admin = adminClient();
      const backdated = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const set = await admin
        .from("player_profiles")
        .update({ handle_changed_at: backdated })
        .eq("user_id", idA);
      expect(set.error).toBeNull();
      const changed = await updateHandle(authedClient(tokenA), { handle: handleA });
      expect(changed.handle).toBe(handleA);
      expect(Date.parse(changed.handle_changed_at as string)).toBeGreaterThan(
        Date.parse(backdated),
      );
    });

    it("suspended users cannot change handle or consent (directory already hides them)", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idB);
      expect(susp.error).toBeNull();
      await expect(
        updateHandle(authedClient(tokenB), { handle: `${handleB}x` }),
      ).rejects.toBeInstanceOf(SuspendedError);
      await expect(
        setDiscoverability(authedClient(tokenB), { is_discoverable: false }),
      ).rejects.toBeInstanceOf(SuspendedError);
      // Suspension alone suppresses public rows (no consent write needed).
      expect((await searchDirectory(anonClient(), {})).map((c) => c.handle)).not.toContain(
        handleB,
      );
      const restore = await admin
        .from("app_users")
        .update({ status: "active", suspended_at: null })
        .eq("id", idB);
      expect(restore.error).toBeNull();
    });

    it("concurrent handle changes cannot bypass cooldown or uniqueness", async () => {
      // Fresh identity: two parallel changes race the same row lock.
      const anon = anonClient();
      const { id, accessToken } = await signUpIdentity(anon, emailFor("d"));
      const clientD = authedClient(accessToken);
      await createPlayerProfile(clientD, {
        handle: `${RUN_ID}_d`,
        display_name: `${RUN_ID} Dee`,
      });
      const settled = await Promise.allSettled([
        updateHandle(clientD, { handle: `${RUN_ID}d1`.slice(0, 20) }),
        updateHandle(clientD, { handle: `${RUN_ID}d2`.slice(0, 20) }),
      ]);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      const reason = (rejected[0] as PromiseRejectedResult).reason as Error;
      expect(
        reason instanceof HandleCooldownError || reason instanceof HandleTakenError,
      ).toBe(true);
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("handle")
        .eq("user_id", id);
      expect((data ?? []).length).toBe(1);
    });

    it("game-profile removal deletes only the selected row", async () => {
      // Cross-user isolation: removing A's row leaves B's row, both
      // canonical profiles and the catalogue entry intact.
      await expect(removeGameProfile(authedClient(tokenA), "bgmi")).resolves.toEqual({
        game_key: "bgmi",
      });
      const admin = adminClient();
      const { data: aGames } = await admin
        .from("player_game_profiles")
        .select("game_key")
        .eq("player_user_id", idA);
      expect(aGames ?? []).toEqual([]);
      const { data: bGames } = await admin
        .from("player_game_profiles")
        .select("game_key")
        .eq("player_user_id", idB);
      expect((bGames ?? []).map((g) => g.game_key)).toContain("bgmi");
      const { data: canon } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect((canon ?? []).length).toBe(1);
      const { data: catalogue } = await admin
        .from("games")
        .select("key")
        .eq("key", "bgmi");
      expect((catalogue ?? []).length).toBe(1);
      // Missing selector is a safe not-found (idempotent retry shape).
      await expect(removeGameProfile(authedClient(tokenA), "bgmi")).rejects.toThrow();
      // Last-game removal leaves the canonical profile incomplete (D-G1-08).
      const completeness = getProfileCompleteness(
        { handle: handleA, displayName: "Alice", avatarPath: null, bio: "bio" },
        0,
      );
      expect(completeness.complete).toBe(false);
      expect(completeness.missing).toContain("game_profile");
    });

    it("canonical deletion removes profile, games and avatar; preserves account", async () => {
      // Give A an avatar so storage cleanup is exercised live.
      const png = new Uint8Array(64).fill(7);
      const uploaded = await uploadAvatar(authedClient(tokenA), {
        bytes: png,
        mimeType: "image/png",
      });
      expect(uploaded.avatar_path).toBe(`${idA}/avatar.png`);
      // Recreate A's game row (removed above) so cascade is exercised.
      await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "AliceReturn",
        region_code: "india",
      });
      await deletePlayerProfile(authedClient(tokenA));
      const admin = adminClient();
      const { data: canon } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect(canon ?? []).toEqual([]);
      const { data: games } = await admin
        .from("player_game_profiles")
        .select("id")
        .eq("player_user_id", idA);
      expect(games ?? []).toEqual([]);
      const listed = await admin.storage.from("public-avatars").list(idA);
      expect((listed.data ?? []).map((o) => o.name)).toEqual([]);
      // Freed handle is immediately reusable by a new owner.
      const anon = anonClient();
      const fresh = await signUpIdentity(anon, emailFor("c"));
      const reused = await createPlayerProfile(authedClient(fresh.accessToken), {
        handle: handleA,
        display_name: `${RUN_ID} Cara`,
      });
      expect(reused.handle).toBe(handleA);
      // Account anchor + Auth identity survive (not account deletion).
      const { data: anchor } = await admin.from("app_users").select("id").eq("id", idA);
      expect((anchor ?? []).length).toBe(1);
      const { data: identity } = await admin.auth.admin.getUserById(idA);
      expect(identity.user?.id).toBe(idA);
      // Other users and catalogue rows survive.
      const { data: bCanon } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idB);
      expect((bCanon ?? []).length).toBe(1);
      const { data: catalogue } = await admin.from("games").select("key");
      expect((catalogue ?? []).map((g) => g.key)).toContain("bgmi");
    });

    it("anonymous and cross-user deletion are denied", async () => {
      const anon = anonClient();
      await expect(removeGameProfile(anon, "bgmi")).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
      await expect(deletePlayerProfile(anon)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
      const del = await anon.from("player_profiles").delete().eq("user_id", idB);
      expect(del.error !== null || (del.data as unknown) === null).toBe(true);
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idB);
      expect((data ?? []).length).toBe(1);
    });

    it("suspended-user canonical deletion is blocked and documented", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idB);
      expect(susp.error).toBeNull();
      await expect(deletePlayerProfile(authedClient(tokenB))).rejects.toBeInstanceOf(
        SuspendedError,
      );
      // Row survives the blocked attempt; restore for clean residue.
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idB);
      expect((data ?? []).length).toBe(1);
      const restore = await admin
        .from("app_users")
        .update({ status: "active", suspended_at: null })
        .eq("id", idB);
      expect(restore.error).toBeNull();
    });

    it("public regression: frozen 12 columns, no leaks, withdrawn stays hidden", async () => {
      const anon = anonClient();
      // Deleted profile is absent from the directory and 404-equivalent.
      expect((await searchDirectory(anon, {})).map((c) => c.handle)).not.toContain(handleA);
      expect(await getPlayerByHandle(anon, handleA)).toBeNull();
      // B remains discoverable with the exact frozen projection.
      const cards = await searchDirectory(anon, {});
      const mine = cards.find((c) => c.handle === handleB);
      expect(mine).toBeDefined();
      expect(Object.keys(mine as unknown as Record<string, unknown>)).toEqual(FROZEN_KEYS);
      const serialized = JSON.stringify(cards);
      expect(serialized).not.toContain("game_user_id");
      expect(serialized).not.toContain(idB);
      expect(serialized).not.toContain("suspended");
    });
  },
);
