// P15-M2B.3C live two-JWT Storage authorization tests.
// Lane: real anon/authenticated JWTs against Esports project only.
// Service-role confined to optional cleanup of THIS run's users.
// Run:
//   G1_TEST_MODE=m2b3c npm run test:integration -- bgmi-ownership-storage.integration
// Fail closed: without G1_TEST_MODE=m2b3c (+ URL/anon/service env) the suite skips.
// Never logs passwords, tokens, or signed URL query strings.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  createBgmiOwnershipDraftCase,
  submitBgmiOwnershipCase,
  uploadBgmiOwnershipEvidence,
  withdrawBgmiOwnershipCase,
} from "../server/bgmi-ownership";
import { createGameProfile } from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";
import { BGMI_OWNERSHIP_BUCKET } from "../domain/bgmi-ownership";

const ENABLED = process.env.G1_TEST_MODE === "m2b3c";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `m2b3c_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}${who}`.slice(0, 20);
const PASSWORD = `M2b3c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;

function anonClient(): SupabaseClient {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
let idB = "";
let pathA = "";
let caseIdA = "";

async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
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
        "BLOCKED: no session (email confirmation likely required); cannot run two-JWT tests without weakening security.",
      );
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "M2B.3C two-user private-verification Storage boundary",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      const a = await signUpIdentity(anon, emailFor("a"));
      const b = await signUpIdentity(anon, emailFor("b"));
      idB = b.id;
      tokenA = a.accessToken;
      tokenB = b.accessToken;

      const clientA = authedClient(tokenA);
      const clientB = authedClient(tokenB);

      await createPlayerProfile(clientA, {
        handle: handleFor("a"),
        display_name: "M2B3C Player A",
        bio: "test bio for completeness",
        country_code: "IN",
      });
      await createPlayerProfile(clientB, {
        handle: handleFor("b"),
        display_name: "M2B3C Player B",
        bio: "test bio for completeness",
        country_code: "IN",
      });
      await createGameProfile(clientA, {
        game_key: "bgmi",
        ign: "PlayerA",
        game_user_id: "00112233",
        primary_role: "Scout",
        play_modes: ["squad", "tpp"],
        region_code: "india",
        availability: ["weekend"],
      });
      await createGameProfile(clientB, {
        game_key: "bgmi",
        ign: "PlayerB",
        game_user_id: "99887766",
        primary_role: "Scout",
        play_modes: ["squad", "tpp"],
        region_code: "india",
        availability: ["weekend"],
      });

      const draft = await createBgmiOwnershipDraftCase(clientA);
      caseIdA = draft.id;
      const evidence = await uploadBgmiOwnershipEvidence(clientA, {
        caseId: caseIdA,
        bytes: await makePng(),
      });
      pathA = evidence.storage_path;
    }, 180_000);

    afterAll(async () => {
      const admin = adminClient();
      for (const uid of [...trackedUserIds].reverse()) {
        await admin.storage.from(BGMI_OWNERSHIP_BUCKET).remove([
          // best-effort; exact paths may already be withdrawn
        ]);
        // Prefix sweep for this uid only
        const { data: folders } = await admin.storage
          .from(BGMI_OWNERSHIP_BUCKET)
          .list(`${uid}/bgmi-ownership`, { limit: 50 });
        for (const folder of folders ?? []) {
          const prefix = `${uid}/bgmi-ownership/${folder.name}`;
          const { data: files } = await admin.storage
            .from(BGMI_OWNERSHIP_BUCKET)
            .list(prefix, { limit: 20 });
          const paths = (files ?? [])
            .map((f) => (f.name ? `${prefix}/${f.name}` : null))
            .filter((p): p is string => p !== null);
          if (paths.length > 0) {
            await admin.storage.from(BGMI_OWNERSHIP_BUCKET).remove(paths);
          }
        }
        await admin.from("player_bgmi_ownership_cases").delete().eq("player_id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }, 180_000);

    it("Player A can read own object; Player B cannot download A's object", async () => {
      const a = authedClient(tokenA);
      const b = authedClient(tokenB);
      const own = await a.storage.from(BGMI_OWNERSHIP_BUCKET).download(pathA);
      expect(own.error).toBeNull();
      expect(own.data).not.toBeNull();

      const cross = await b.storage.from(BGMI_OWNERSHIP_BUCKET).download(pathA);
      expect(cross.error).not.toBeNull();
      expect(cross.data).toBeNull();
    });

    it("Player B cannot overwrite or delete Player A's object", async () => {
      const b = authedClient(tokenB);
      const upload = await b.storage.from(BGMI_OWNERSHIP_BUCKET).upload(pathA, await makePng(), {
        contentType: "image/png",
        upsert: true,
      });
      expect(upload.error).not.toBeNull();

      const del = await b.storage.from(BGMI_OWNERSHIP_BUCKET).remove([pathA]);
      // remove may return empty error set; verify object still readable by A
      void del;
      const still = await authedClient(tokenA)
        .storage.from(BGMI_OWNERSHIP_BUCKET)
        .download(pathA);
      expect(still.error).toBeNull();
    });

    it("Player A cannot access Player B evidence metadata rows", async () => {
      const a = authedClient(tokenA);
      const { data, error } = await a
        .from("player_bgmi_ownership_evidence")
        .select("id,player_id")
        .eq("player_id", idB);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });

    it("anonymous access is denied", async () => {
      const anon = anonClient();
      const down = await anon.storage.from(BGMI_OWNERSHIP_BUCKET).download(pathA);
      expect(down.error).not.toBeNull();
      const meta = await anon.from("player_bgmi_ownership_cases").select("id");
      expect((meta.data ?? []).length).toBe(0);
    });

    it("submitted evidence cannot be directly deleted by owner until withdraw", async () => {
      const a = authedClient(tokenA);
      await submitBgmiOwnershipCase(a, caseIdA);
      const blocked = await a.storage.from(BGMI_OWNERSHIP_BUCKET).remove([pathA]);
      // After pending, Storage DELETE policy blocks bgmi-ownership paths.
      const still = await a.storage.from(BGMI_OWNERSHIP_BUCKET).download(pathA);
      expect(still.error).toBeNull();
      void blocked;

      // Client cannot set status via update
      const spoof = await a
        .from("player_bgmi_ownership_cases")
        .update({ status: "withdrawn" })
        .eq("id", caseIdA)
        .select("id");
      expect((spoof.data ?? []).length).toBe(0);

      const result = await withdrawBgmiOwnershipCase(a, caseIdA);
      expect(result.alreadyWithdrawn).toBe(false);
      expect(result.storageDeleteFailures).toBe(0);
      expect(result.deletedObjectCount).toBeGreaterThan(0);

      // Evidence metadata must be gone after withdraw.
      const meta = await a
        .from("player_bgmi_ownership_evidence")
        .select("id")
        .eq("case_id", caseIdA);
      expect(meta.data ?? []).toEqual([]);

      // Prefer listing over download (download can lag on Storage).
      const prefix = pathA.split("/").slice(0, -1).join("/");
      const deadline = Date.now() + 15_000;
      let remaining = -1;
      for (;;) {
        const listed = await a.storage.from(BGMI_OWNERSHIP_BUCKET).list(prefix, {
          limit: 20,
        });
        remaining = (listed.data ?? []).length;
        if (remaining === 0) break;
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      expect(remaining).toBe(0);
    });

    it("team-owner context does not grant member evidence access (no membership policy)", async () => {
      // There is no team-based Storage policy on private-verification.
      // Player B acting as a "team owner" still only has their own JWT.
      const b = authedClient(tokenB);
      const cross = await b.storage.from(BGMI_OWNERSHIP_BUCKET).download(pathA);
      // Object may already be withdrawn/deleted; either denial or missing is fine —
      // success would be a failure.
      expect(cross.error !== null || cross.data === null).toBe(true);
    });
  },
);
