// G1-5 live avatar tests (12 section 5 pattern).
// Lane: real anon/authenticated keys only; service-role confined to isolated
// setup/verification/cleanup below. Run:
//   G1_TEST_MODE=g1-5 npm run test:integration -- avatar.integration
// Fail closed: without G1_TEST_MODE=g1-5 (and all three env keys) the suite
// skips before any write. Cleanup deletes ONLY records/objects created by
// this run (exact tracked ids/paths, reverse dependency order). Never
// truncate, never reset, never touch non-test records.
//
// NOTE: creating `g1t5_*` auth users + app rows + profiles + avatar objects
// and deleting them afterwards is an intentional, authorized write to the
// single project. No migration is applied here (G1-5 needs none: the bucket,
// policies and CHECKs already exist). No other writes occur.
//
// Authoritative: 04 sections 2/5/6, 05 section 1, 06 sections 2-5,
// 07 sections 1-4, 08 T1/T2/T5/T6/T8, D-G1-06 Option A.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AvatarValidationError } from "../domain/avatar";
import { createGameProfile } from "../server/game-profile";
import { createPlayerProfile, getOwnProfile } from "../server/player-profile";
import { setDiscoverability } from "../server/consent";
import { removeAvatar, uploadAvatar } from "../server/avatar";
import {
  getPlayerByHandle,
  searchDirectory,
} from "../server/directory-reader";

const ENABLED = process.env.G1_TEST_MODE === "g1-5";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `g1t5_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}_${who}`;
const PASSWORD = `T5st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

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

// 1x1 transparent PNG (~70 bytes, well under 512 KB).
const PNG_BYTES = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
// Same bytes served as image/webp for the extension-change path (storage
// validates the content-type header, not magic bytes; the path logic is
// what this stage proves).
const WEBP_BYTES = PNG_BYTES;

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
const trackedAvatarPaths: string[] = [];
let tokenA = "";
let tokenB = "";
let idA = "";
let idB = "";
let handleA = "";
let handleB = "";

function trackAvatarPath(path: string): void {
  if (!trackedAvatarPaths.includes(path)) {
    trackedAvatarPaths.push(path);
  }
}

// Storage deletes may take a moment to propagate to anonymous public reads
// (public bucket is CDN-friendly per 06). Owner reads are strongly
// consistent; anonymous delete-visibility is asserted with bounded retries
// so the suite does not flake on propagation delay. Upload visibility is
// immediate in practice but uses the same helper for symmetry.
async function expectAnonDownload(
  path: string,
  bucket: string,
  want: "ok" | "missing",
): Promise<void> {
  const deadline = Date.now() + 12_000;
  for (;;) {
    const res = await anonClient().storage.from(bucket).download(path);
    if (want === "ok" && res.error === null) return;
    if (want === "missing" && res.error !== null) return;
    if (Date.now() >= deadline) {
      if (want === "ok") {
        expect(res.error).toBeNull();
      } else {
        expect(res.error).not.toBeNull();
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Single-file invariant via the owner's prefix listing, which reflects
// deletes immediately (unlike object downloads, which may serve a stale
// read briefly after a delete on the public bucket). Polled to tolerate
// listing propagation delay.
async function expectOwnerObjects(
  owner: SupabaseClient,
  uid: string,
  expectedNames: string[],
): Promise<void> {
  const deadline = Date.now() + 12_000;
  for (;;) {
    const res = await owner.storage.from("public-avatars").list(uid);
    expect(res.error).toBeNull();
    const names = ((res.data ?? []) as Array<{ name: string }>)
      .map((e) => e.name)
      .sort();
    if (JSON.stringify(names) === JSON.stringify([...expectedNames].sort())) {
      return;
    }
    if (Date.now() >= deadline) {
      expect(names).toEqual([...expectedNames].sort());
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

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
  // bypass closure).
  const profile = await setDiscoverability(client, {
    is_discoverable: value,
  });
  expect(profile.user_id).toBe(uid);
  expect(profile.is_discoverable).toBe(value);
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "avatar storage wiring (G1-5, real bucket + RLS + RPCs)",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      ({ id: idA, accessToken: tokenA } = await signUpIdentity(
        anon,
        emailFor("a"),
      ));
      ({ id: idB, accessToken: tokenB } = await signUpIdentity(
        anon,
        emailFor("b"),
      ));
      handleA = handleFor("a");
      handleB = handleFor("b");

      await createPlayerProfile(authedClient(tokenA), {
        handle: handleA,
        display_name: `${RUN_ID} Alpha`,
        bio: `${RUN_ID} alpha bio`,
        country_code: "IN",
      });
      await createPlayerProfile(authedClient(tokenB), {
        handle: handleB,
        display_name: `${RUN_ID} Bravo`,
      });
      // A is directory-eligible (master on + visible game row); B stays
      // private by default (negative control for consent tests).
      await setDiscoverable(authedClient(tokenA), idA, true);
      await createGameProfile(authedClient(tokenA), {
        game_key: "bgmi",
        ign: "AvatarScout",
        primary_role: "Scout",
        play_modes: ["squad", "tpp"],
        region_code: "india",
        availability: ["weekend"],
      });
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE || !URL) return;
      const admin = adminClient();
      // Exact-path storage sweep first (no broad prefix deletes).
      for (const path of trackedAvatarPaths) {
        await admin.storage.from("public-avatars").remove([path]);
      }
      await admin.storage
        .from("private-verification")
        .remove(trackedUserIds.map((uid) => `${uid}/g1t5-evidence.png`));
      for (const uid of trackedUserIds) {
        await admin.from("player_game_profiles").delete().eq("player_user_id", uid);
      }
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

    it("uploads a valid avatar to the caller's canonical path", async () => {
      const profile = await uploadAvatar(authedClient(tokenA), {
        bytes: PNG_BYTES,
        mimeType: "image/png",
      });
      const expected = `${idA}/avatar.png`;
      trackAvatarPath(expected);
      expect(profile.avatar_path).toBe(expected);

      // Privileged read confirms the stored relative path (not a URL).
      const admin = adminClient();
      const { data } = await admin
        .from("player_profiles")
        .select("avatar_path")
        .eq("user_id", idA);
      expect(data?.[0]?.avatar_path).toBe(expected);

      // Owner and anonymous clients can fetch the public object.
      const ownerDl = await authedClient(tokenA)
        .storage.from("public-avatars")
        .download(expected);
      expect(ownerDl.error).toBeNull();
      await expectAnonDownload(expected, "public-avatars", "ok");
    });

    it("rejects invalid MIME types before any storage write", async () => {
      const before = (await getOwnProfile(authedClient(tokenA)))?.avatar_path;
      const svg = new TextEncoder().encode("<svg xmlns='x'></svg>");
      await expect(
        uploadAvatar(authedClient(tokenB), {
          bytes: svg,
          mimeType: "image/svg+xml",
        }),
      ).rejects.toBeInstanceOf(AvatarValidationError);
      // B's row is untouched (still NULL) and A's row is unchanged.
      expect((await getOwnProfile(authedClient(tokenB)))?.avatar_path).toBeNull();
      expect((await getOwnProfile(authedClient(tokenA)))?.avatar_path).toBe(
        before ?? null,
      );
    });

    it("rejects oversized files before any storage write", async () => {
      const big = new Uint8Array(524289).fill(9);
      await expect(
        uploadAvatar(authedClient(tokenA), {
          bytes: big,
          mimeType: "image/png",
        }),
      ).rejects.toBeInstanceOf(AvatarValidationError);
    });

    it("rejects invalid paths at the DB CHECK layer", async () => {
      for (const bad of [
        "https://evil.example/avatar.png",
        "../admin.png",
        `${idA}/other.png`,
        `${idA}/avatar.svg`,
      ]) {
        const res = await authedClient(tokenA)
          .from("player_profiles")
          .update({ avatar_path: bad })
          .eq("user_id", idA);
        expect(res.error).not.toBeNull();
      }
      // Stored path still the valid canonical one.
      expect((await getOwnProfile(authedClient(tokenA)))?.avatar_path).toBe(
        `${idA}/avatar.png`,
      );
    });

    it("prevents one user from overwriting another user's avatar", async () => {
      // Direct storage forgery: B writes to A's object path → RLS denial.
      const forged = await authedClient(tokenB)
        .storage.from("public-avatars")
        .upload(`${idA}/avatar.png`, PNG_BYTES, {
          upsert: true,
          contentType: "image/png",
        });
      expect(forged.error).not.toBeNull();

      // B's own upload lands on B's prefix only; A's row/object are intact.
      const bProfile = await uploadAvatar(authedClient(tokenB), {
        bytes: PNG_BYTES,
        mimeType: "image/png",
      });
      const expectedB = `${idB}/avatar.png`;
      trackAvatarPath(expectedB);
      expect(bProfile.avatar_path).toBe(expectedB);
      expect((await getOwnProfile(authedClient(tokenA)))?.avatar_path).toBe(
        `${idA}/avatar.png`,
      );
      // Clean B's avatar so later NULL/consent assertions stay deterministic.
      const cleaned = await removeAvatar(authedClient(tokenB));
      expect(cleaned.avatar_path).toBeNull();
    });

    it("allows anonymous public reads of avatar objects but not verification evidence", async () => {
      const avatarPath = `${idA}/avatar.png`;
      const anonAvatar = await anonClient()
        .storage.from("public-avatars")
        .download(avatarPath);
      expect(anonAvatar.error).toBeNull();

      // Owner-only verification object (private bucket, no public read).
      const evidencePath = `${idA}/g1t5-evidence.png`;
      const up = await authedClient(tokenA)
        .storage.from("private-verification")
        .upload(evidencePath, PNG_BYTES, {
          upsert: true,
          contentType: "image/png",
        });
      expect(up.error).toBeNull();

      const anonEvidence = await anonClient()
        .storage.from("private-verification")
        .download(evidencePath);
      expect(anonEvidence.error).not.toBeNull();

      const otherEvidence = await authedClient(tokenB)
        .storage.from("private-verification")
        .download(evidencePath);
      expect(otherEvidence.error).not.toBeNull();
      expect(otherEvidence.data ?? null).toBeNull();
    });

    it("resolves the avatar through the directory with exactly 12 keys", async () => {
      const cards = await searchDirectory(anonClient(), {});
      const mine = cards.find((c) => c.handle === handleA);
      expect(mine).toBeDefined();
      expect(Object.keys(mine as unknown as Record<string, unknown>)).toEqual(
        FROZEN_KEYS,
      );
      expect(mine?.avatar_url).toContain(`${idA}/avatar.png`);
      expect(mine?.avatar_url).toContain("public-avatars");
      expect(mine?.avatar_url).not.toContain("token=");

      const byHandle = await getPlayerByHandle(anonClient(), handleA);
      expect(byHandle?.avatar_url).toBe(mine?.avatar_url);
      expect(Object.keys(byHandle as unknown as Record<string, unknown>)).toEqual(
        FROZEN_KEYS,
      );
    });

    it("replaces the avatar without leaving a stale object or URL", async () => {
      const oldPath = `${idA}/avatar.png`;
      const profile = await uploadAvatar(authedClient(tokenA), {
        bytes: WEBP_BYTES,
        mimeType: "image/webp",
      });
      const newPath = `${idA}/avatar.webp`;
      trackAvatarPath(newPath);
      expect(profile.avatar_path).toBe(newPath);

      // Old extension object is gone; new one is live (exact paths only).
      // The prefix listing is the strongly-consistent single-file proof;
      // object downloads are polled (stale reads may linger briefly).
      await expectOwnerObjects(authedClient(tokenA), idA, ["avatar.webp"]);
      await expectAnonDownload(oldPath, "public-avatars", "missing");
      await expectAnonDownload(newPath, "public-avatars", "ok");

      // Next directory response carries the new URL (no stale URL).
      const byHandle = await getPlayerByHandle(anonClient(), handleA);
      expect(byHandle?.avatar_url).toContain(newPath);
      expect(byHandle?.avatar_url).not.toContain(oldPath);
    });

    it("removes the avatar without leaving a stale public URL", async () => {
      const current = `${idA}/avatar.webp`;
      const removed = await removeAvatar(authedClient(tokenA));
      expect(removed.avatar_path).toBeNull();

      await expectOwnerObjects(authedClient(tokenA), idA, []);
      await expectAnonDownload(current, "public-avatars", "missing");

      // Directory still lists the eligible profile, now with NULL avatar.
      const byHandle = await getPlayerByHandle(anonClient(), handleA);
      expect(byHandle?.avatar_url).toBeNull();
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.find((c) => c.handle === handleA)?.avatar_url).toBeNull();

      // NULL avatar behavior for a fresh owner read.
      expect((await getOwnProfile(authedClient(tokenA)))?.avatar_path).toBeNull();
    });

    it("suppresses the entire profile (incl. avatar) on consent withdrawal", async () => {
      // Re-add an avatar so the suppression covers a non-NULL case.
      const restored = await uploadAvatar(authedClient(tokenA), {
        bytes: PNG_BYTES,
        mimeType: "image/png",
      });
      trackAvatarPath(`${idA}/avatar.png`);
      expect(restored.avatar_path).toBe(`${idA}/avatar.png`);
      expect(await getPlayerByHandle(anonClient(), handleA)).not.toBeNull();

      await setDiscoverable(authedClient(tokenA), idA, false);
      expect(await getPlayerByHandle(anonClient(), handleA)).toBeNull();
      const cards = await searchDirectory(anonClient(), {});
      expect(cards.map((c) => c.handle)).not.toContain(handleA);
      for (const card of cards) {
        expect(Object.keys(card)).toEqual(FROZEN_KEYS);
      }

      await setDiscoverable(authedClient(tokenA), idA, true);
      const back = await getPlayerByHandle(anonClient(), handleA);
      expect(back?.avatar_url).toContain(`${idA}/avatar.png`);
    });
  },
);
