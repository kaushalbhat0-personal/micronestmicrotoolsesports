// G1-2 live adversarial tests (12 section 3).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/verification/cleanup below (12 section 6). Run:
//   G1_TEST_MODE=g1-2 npm run test:integration
// Fail closed: without G1_TEST_MODE=g1-2 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY rows/users created by this
// run (exact tracked ids, reverse dependency order). Never truncate, never
// reset, never touch non-test records.
//
// NOTE: creating `g1t2_*` auth users + app_users rows + player_profiles rows
// and deleting them afterwards is an intentional, authorized write to the
// single project. No other writes occur.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../domain/app-user";
import {
  HandleTakenError,
  ProfileAlreadyExistsError,
} from "../domain/player-profile";
import {
  createPlayerProfile,
  getOwnProfile,
  updatePlayerProfile,
} from "../server/player-profile";

const ENABLED = process.env.G1_TEST_MODE === "g1-2";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t2_${Date.now().toString(36)}`;
const emailFor = (who: "a" | "b") => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: "a" | "b") => `${RUN_ID}_${who}`;
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
  "playerProfile integration (G1-2, real RLS)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(anon, emailFor("a")));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(anon, emailFor("b")));
    }, 120_000);

    afterAll(async () => {
      // Best-effort, ownership-verified cleanup: only tracked ids, exact
      // match, reverse dependency order (profile -> app_users -> auth).
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      for (const uid of trackedUserIds) {
        await admin.from("player_profiles").delete().eq("user_id", uid);
        await admin.from("app_users").delete().eq("id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }, 120_000);

    it("creates no profile rows at signup (explicit creation required)", async () => {
      const admin = adminClient();
      const { data, error } = await admin
        .from("player_profiles")
        .select("user_id")
        .in("user_id", [idA, idB]);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it("unauthenticated profile access is rejected", async () => {
      const anon = anonClient();
      await expect(getOwnProfile(anon)).rejects.toBeInstanceOf(
        UnauthenticatedError,
      );
      await expect(
        createPlayerProfile(anon, {
          handle: handleFor("a"),
          display_name: "Anon",
        }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
      await expect(
        updatePlayerProfile(anon, { display_name: "Anon" }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it("anonymous base-table reads reach nothing", async () => {
      const anon = anonClient();
      const read = await anon
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect(read.data ?? []).toEqual([]);
    });

    it("owner creates a profile; discoverability defaults false", async () => {
      const profile = await createPlayerProfile(authedClient(tokenA), {
        handle: handleFor("a"),
        display_name: "G1T2 Alice",
        bio: "BGMI scout.",
        country_code: "in",
      });
      expect(profile.user_id).toBe(idA);
      expect(profile.handle).toBe(handleFor("a"));
      expect(profile.display_name).toBe("G1T2 Alice");
      expect(profile.bio).toBe("BGMI scout.");
      expect(profile.country_code).toBe("IN");
      expect(profile.avatar_path).toBeNull();
      expect(profile.is_discoverable).toBe(false);

      // Privileged read confirms the stored default (not just the echo).
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("is_discoverable")
        .eq("user_id", idA);
      expect(data?.[0]?.is_discoverable).toBe(false);
    });

    it("handle uniqueness is case-insensitive (ABC vs abc collide)", async () => {
      const taken = await createPlayerProfile(authedClient(tokenB), {
        handle: handleFor("a").toUpperCase(),
        display_name: "G1T2 Bob",
      }).catch((e: unknown) => e);
      expect(taken).toBeInstanceOf(HandleTakenError);
      // B still has no profile after the conflict.
      await expect(getOwnProfile(authedClient(tokenB))).resolves.toBeNull();
    });

    it("duplicate profile creation is a predictable domain error", async () => {
      const dup = await createPlayerProfile(authedClient(tokenA), {
        handle: `${RUN_ID}_a2`,
        display_name: "G1T2 Alice Again",
      }).catch((e: unknown) => e);
      expect(dup).toBeInstanceOf(ProfileAlreadyExistsError);
      // Exactly one row for A.
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect((data ?? []).length).toBe(1);
    });

    it("concurrent creation for one user cannot create duplicates", async () => {
      // Unlike idempotent bootstrap (ON CONFLICT DO NOTHING), profile
      // creation is NOT idempotent by design: the second create is a
      // 409-domain error (09: "second create -> 409/unique"). Concurrent
      // first-creates therefore converge on exactly one row while losers
      // receive a predictable domain error. The load-bearing property is
      // the row count, not which 409-domain error a loser observes (the
      // owner-SELECT disambiguation can race the winner's commit).
      const client = authedClient(tokenB);
      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          createPlayerProfile(client, {
            handle: handleFor("b"),
            display_name: "G1T2 Bob",
          }),
        ),
      );
      const fulfilled = settled.filter(
        (s): s is PromiseFulfilledResult<
          Awaited<ReturnType<typeof createPlayerProfile>>
        > => s.status === "fulfilled",
      );
      const rejected = settled.filter(
        (s): s is PromiseRejectedResult => s.status === "rejected",
      );
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length + rejected.length).toBe(5);
      for (const r of rejected) {
        expect(
          r.reason instanceof ProfileAlreadyExistsError ||
            r.reason instanceof HandleTakenError,
        ).toBe(true);
      }
      for (const r of fulfilled) {
        expect(r.value.user_id).toBe(idB);
        expect(r.value.handle).toBe(handleFor("b"));
        expect(r.value.is_discoverable).toBe(false);
      }
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idB);
      expect((data ?? []).length).toBe(1);
    });

    it("user A cannot create a profile for user B", async () => {
      const clientA = authedClient(tokenA);
      // No user_id parameter exists; the direct-DB forgery is denied.
      const { error } = await clientA.from("player_profiles").insert({
        user_id: idB,
        handle: `${RUN_ID}_x1`,
        display_name: "Forgery",
      });
      expect(error).not.toBeNull();
      // B's row is untouched (still B's own handle).
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("handle")
        .eq("user_id", idB);
      expect(data?.[0]?.handle).toBe(handleFor("b"));
    });

    it("user A cannot read user B's private profile", async () => {
      const other = await authedClient(tokenA)
        .from("player_profiles")
        .select("user_id,handle")
        .eq("user_id", idB);
      expect(other.error).toBeNull();
      expect(other.data ?? []).toEqual([]);
      // Owner still reads their own row (appeal/export path intact).
      const own = await getOwnProfile(authedClient(tokenB));
      expect(own?.user_id).toBe(idB);
    });

    it("user A cannot update user B's profile", async () => {
      const upd = await authedClient(tokenA)
        .from("player_profiles")
        .update({ display_name: "Hijacked" })
        .eq("user_id", idB)
        .select("user_id");
      expect((upd.data ?? []) as unknown[]).toEqual([]);
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("display_name")
        .eq("user_id", idB);
      expect(data?.[0]?.display_name).toBe("G1T2 Bob");
    });

    it("a user cannot change their own user_id (ownership transfer denied)", async () => {
      const upd = await authedClient(tokenA)
        .from("player_profiles")
        .update({ user_id: idB })
        .eq("user_id", idA);
      // Denied at grant/RLS layer: either an error or zero rows affected.
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect((data ?? []).length).toBe(1);
      expect(upd.error !== null || ((upd.data ?? []) as unknown[]).length === 0).toBe(
        true,
      );
    });

    it("owner UPDATE of another user's row via app operation is unexpressible", async () => {
      // updatePlayerProfile takes (client, patch): no target selector exists.
      expect(updatePlayerProfile.length).toBe(2);
      const updated = await updatePlayerProfile(authedClient(tokenA), {
        display_name: "G1T2 Alice Prime",
      });
      expect(updated.user_id).toBe(idA);
      expect(updated.display_name).toBe("G1T2 Alice Prime");
      // B's row is unaffected by A's update call.
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("display_name")
        .eq("user_id", idB);
      expect(data?.[0]?.display_name).toBe("G1T2 Bob");
    });

    it("invalid country codes are rejected at Zod and CHECK layers", async () => {
      // App layer (Zod): ONLINE and malformed codes never reach the DB.
      await expect(
        updatePlayerProfile(authedClient(tokenA), { country_code: "ONLINE" }),
      ).rejects.toThrow();
      await expect(
        createPlayerProfile(authedClient(tokenA), {
          handle: `${RUN_ID}_a2`,
          display_name: "X",
          country_code: "ONLINE",
        }),
      ).rejects.toThrow();
      // DB layer (CHECK): a non-allowlisted code is denied even if it passes
      // the format boundary (XX is well-formed but not ISO-assigned).
      const bad = await authedClient(tokenB)
        .from("player_profiles")
        .update({ country_code: "XX" })
        .eq("user_id", idB);
      expect(bad.error).not.toBeNull();
      // A genuinely allowlisted code (CM = Cameroon) passes the CHECK;
      // restore the original value afterwards.
      const valid = await authedClient(tokenB)
        .from("player_profiles")
        .update({ country_code: "CM" })
        .eq("user_id", idB);
      expect(valid.error).toBeNull();
      await authedClient(tokenB)
        .from("player_profiles")
        .update({ country_code: null })
        .eq("user_id", idB);
    });

    it("mass assignment of publish/identity fields is rejected", async () => {
      await expect(
        updatePlayerProfile(authedClient(tokenA), {
          display_name: "G1T2 Alice",
          is_discoverable: true,
        }),
      ).rejects.toThrow();
      await expect(
        updatePlayerProfile(authedClient(tokenA), {
          display_name: "G1T2 Alice",
          user_id: idB,
        }),
      ).rejects.toThrow();
      // Privileged read: the flag was not smuggled through.
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("is_discoverable")
        .eq("user_id", idA);
      expect(data?.[0]?.is_discoverable).toBe(false);
    });

    it("owner DELETE removes only the caller's row (D-G1-07 approved, G1-7)", async () => {
      // G1-7 approves hard deletion of the canonical profile: the owner's
      // DELETE succeeds for their own row only. B's row survives. The profile
      // is recreated afterwards so the lane stays tidy (handle reuse is
      // immediate after deletion).
      const del = await authedClient(tokenA)
        .from("player_profiles")
        .delete()
        .eq("user_id", idA)
        .select("user_id");
      expect(del.error).toBeNull();
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idA);
      expect(data ?? []).toEqual([]);
      const { data: other } = await admin
        .from("player_profiles")
        .select("user_id")
        .eq("user_id", idB);
      expect((other ?? []).length).toBe(1);
      const recreated = await createPlayerProfile(authedClient(tokenA), {
        handle: handleFor("a"),
        display_name: "G1T2 Alice",
      });
      expect(recreated.user_id).toBe(idA);
    });

    it("suspended accounts cannot write; own reads stay allowed", async () => {
      const admin = adminClient();
      const susp = await admin
        .from("app_users")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", idB);
      expect(susp.error).toBeNull();

      // Gate blocks all three operations with the generic account error.
      await expect(getOwnProfile(authedClient(tokenB))).resolves.toMatchObject({
        user_id: idB,
      });
      const createFailure = await createPlayerProfile(authedClient(tokenB), {
        handle: `${RUN_ID}_b2`,
        display_name: "G1T2 Bob Again",
      }).catch((e: unknown) => e);
      expect(createFailure).toBeInstanceOf(SuspendedError);
      const updateFailure = await updatePlayerProfile(authedClient(tokenB), {
        display_name: "Blocked",
      }).catch((e: unknown) => e);
      expect(updateFailure).toBeInstanceOf(SuspendedError);
      expect((updateFailure as Error).message).not.toContain(idB);

      // Direct-DB write is denied at RLS while the own read succeeds.
      const direct = await authedClient(tokenB)
        .from("player_profiles")
        .update({ display_name: "Hijacked While Suspended" })
        .eq("user_id", idB)
        .select("user_id");
      expect((direct.data ?? []) as unknown[]).toEqual([]);
      const { data } = await admin
        .from("player_profiles")
        .select("display_name")
        .eq("user_id", idB);
      expect(data?.[0]?.display_name).toBe("G1T2 Bob");
    });
  },
);
