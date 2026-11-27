// FRAGIX-C1A: registry ownership gate vs ungated handle lookup.
// Run (after migration 20261128000006 is applied on Esports):
//   G1_TEST_MODE=c1a npm run test:integration -- registry-ownership-eligibility.integration
// Fail closed without G1_TEST_MODE=c1a (+ URL/anon/service env).
// Never logs passwords, tokens, or BGMI IDs in assertions beyond fixture constants.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import {
  createBgmiOwnershipDraftCase,
  decideBgmiOwnershipCase,
  getPlayerBgmiOwnershipPublicStatus,
  submitBgmiOwnershipCase,
  uploadBgmiOwnershipEvidence,
  withdrawBgmiOwnershipCase,
} from "../server/bgmi-ownership";
import { setDiscoverability } from "../server/consent";
import { getPlayerByHandle, searchDirectory } from "../server/directory-reader";
import { createGameProfile, updateGameProfile } from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";
import { buildPlayerShareSpec, toPlayerShareInput } from "../share/player-card-model";

const ENABLED = process.env.G1_TEST_MODE === "c1a";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `c1a_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}${who}`.slice(0, 20);
const PASSWORD = `C1a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;
const BGMI_ID = "00123456";

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
let tokenPlayer = "";
let tokenReviewer = "";
let reviewerId = "";
let playerHandle = "";
let playerClient: SupabaseClient;
let reviewerClient: SupabaseClient;
let anon: SupabaseClient;

async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 40, g: 80, b: 120 },
    },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

async function signUp(email: string): Promise<{ id: string; accessToken: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`SEED_BLOCKED: ${error.message}`);
  let session = data.session;
  if (!session) {
    const retry = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (retry.error || !retry.data.session) {
      throw new Error("SEED_BLOCKED: no session");
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

async function searchIncludes(handle: string): Promise<boolean> {
  const rows = await searchDirectory(anon, { query: handle, limit: 48, offset: 0 });
  return rows.some((row) => row.handle.toLowerCase() === handle.toLowerCase());
}

async function handleAccessible(handle: string): Promise<boolean> {
  const card = await getPlayerByHandle(anon, handle);
  return card !== null;
}

async function submitPendingCase(client: SupabaseClient): Promise<string> {
  const draft = await createBgmiOwnershipDraftCase(client);
  await uploadBgmiOwnershipEvidence(client, {
    caseId: draft.id,
    bytes: await makePng(),
  });
  await submitBgmiOwnershipCase(client, draft.id);
  return draft.id;
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "FRAGIX-C1A registry ownership eligibility",
  () => {
    beforeAll(async () => {
      anon = anonClient();
      const player = await signUp(emailFor("p"));
      const reviewer = await signUp(emailFor("r"));
      reviewerId = reviewer.id;
      tokenPlayer = player.accessToken;
      tokenReviewer = reviewer.accessToken;
      playerHandle = handleFor("p");
      playerClient = authedClient(tokenPlayer);
      reviewerClient = authedClient(tokenReviewer);

      await createPlayerProfile(playerClient, {
        handle: playerHandle,
        display_name: "C1A Player",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });
      await createPlayerProfile(reviewerClient, {
        handle: handleFor("r"),
        display_name: "C1A Reviewer",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });

      const admin = adminClient();
      const { error } = await admin.from("platform_admins").insert({
        user_id: reviewerId,
        reason: "C1A registry eligibility test reviewer",
      });
      if (error) throw new Error(`SEED_BLOCKED: ${error.message}`);

      await createGameProfile(playerClient, {
        game_key: "bgmi",
        ign: "C1AIGN",
        game_user_id: BGMI_ID,
      });
      await setDiscoverability(playerClient, { is_discoverable: true });
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE || trackedUserIds.length === 0) return;
      const admin = adminClient();
      await admin.from("platform_admins").delete().eq("user_id", reviewerId);
      await admin
        .from("player_bgmi_ownership_cases")
        .delete()
        .in("player_id", trackedUserIds);
      for (const id of trackedUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    }, 120_000);

    it("complete + consented + no verification: hidden from registry, handle accessible, PNG model ok", async () => {
      expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
      expect(await searchIncludes(playerHandle)).toBe(false);
      expect(await handleAccessible(playerHandle)).toBe(true);

      const card = await getPlayerByHandle(anon, playerHandle);
      expect(card).not.toBeNull();
      expect(JSON.stringify(card)).not.toContain(BGMI_ID);
      expect(JSON.stringify(card)).not.toContain("claimed_game_user_id");
      expect(JSON.stringify(card)).not.toContain("storage_path");

      const share = toPlayerShareInput(card!, `https://example.test/players/${playerHandle}`);
      expect(share).not.toBeNull();
      const spec = buildPlayerShareSpec(share!);
      expect(spec.rows.some((r) => r.value.includes(BGMI_ID))).toBe(false);
    });

    it("pending review: hidden from registry, handle accessible", async () => {
      await submitPendingCase(playerClient);
      expect(await searchIncludes(playerHandle)).toBe(false);
      expect(await handleAccessible(playerHandle)).toBe(true);
      // Withdraw so later cases can be created cleanly.
      const { data: pending } = await playerClient
        .from("player_bgmi_ownership_cases")
        .select("id")
        .eq("status", "pending_review")
        .maybeSingle();
      if (pending?.id) {
        await withdrawBgmiOwnershipCase(playerClient, pending.id);
      }
    });

    it("approved matching ID: visible in registry + badge; projection still 12", async () => {
      const caseId = await submitPendingCase(playerClient);
      await decideBgmiOwnershipCase(reviewerClient, {
        caseId,
        decision: "approved",
        internalReason: "C1A evidence matches claimed Player ID",
      });

      expect(await searchIncludes(playerHandle)).toBe(true);
      expect(await handleAccessible(playerHandle)).toBe(true);

      const badge = await getPlayerBgmiOwnershipPublicStatus(anon, playerHandle);
      expect(badge?.ownership_reviewed).toBe(true);
      expect(JSON.stringify(badge)).not.toContain(BGMI_ID);
      expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    });

    it("ID change after approve: registry hidden, handle accessible, badge false, consent intact", async () => {
      await updateGameProfile(playerClient, "bgmi", { game_user_id: "99999999" });
      expect(await searchIncludes(playerHandle)).toBe(false);
      expect(await handleAccessible(playerHandle)).toBe(true);
      const badge = await getPlayerBgmiOwnershipPublicStatus(anon, playerHandle);
      expect(badge?.ownership_reviewed ?? false).toBe(false);

      const { data: profile } = await playerClient
        .from("player_profiles")
        .select("is_discoverable")
        .maybeSingle();
      expect(profile?.is_discoverable).toBe(true);
    });

    it("restored ID + approved: visible again; consent off hides registry and handle", async () => {
      // Need a fresh approved case after id_mismatch.
      await updateGameProfile(playerClient, "bgmi", { game_user_id: BGMI_ID });
      const caseId = await submitPendingCase(playerClient);
      await decideBgmiOwnershipCase(reviewerClient, {
        caseId,
        decision: "approved",
        internalReason: "C1A re-approve after ID restore",
      });
      expect(await searchIncludes(playerHandle)).toBe(true);

      await setDiscoverability(playerClient, { is_discoverable: false });
      expect(await searchIncludes(playerHandle)).toBe(false);
      expect(await handleAccessible(playerHandle)).toBe(false);
    });
  },
);
