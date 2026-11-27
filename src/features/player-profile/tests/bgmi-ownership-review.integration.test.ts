// P15-M2B.4 live JWT review authorization + public reader tests.
// Run:
//   G1_TEST_MODE=m2b4 npm run test:integration -- bgmi-ownership-review.integration
// Fail closed without G1_TEST_MODE=m2b4 (+ URL/anon/service env).
// Never logs passwords, tokens, or signed URL query strings.
// Service-role confined to platform_admins bootstrap/cleanup for THIS run.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";
import {
  createBgmiOwnershipDraftCase,
  decideBgmiOwnershipCase,
  getPlayerBgmiOwnershipPublicStatus,
  listPendingBgmiOwnershipCases,
  mintReviewerBgmiOwnershipEvidenceSignedUrl,
  submitBgmiOwnershipCase,
  uploadBgmiOwnershipEvidence,
} from "../server/bgmi-ownership";
import { createGameProfile, updateGameProfile } from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";
import { setDiscoverability } from "../server/consent";
import { ForbiddenSuperAdminError } from "@/lib/auth/require-super-admin";
import {
  BgmiOwnershipForbiddenError,
  BgmiOwnershipValidationError,
} from "../domain/bgmi-ownership";

const ENABLED = process.env.G1_TEST_MODE === "m2b4";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `m2b4_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}${who}`.slice(0, 20);
const PASSWORD = `M2b4-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;
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
let tokenOther = "";
let tokenReviewer = "";
let playerId = "";
let reviewerId = "";
let caseId = "";
let evidenceId = "";
let playerHandle = "";

async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
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
    const retry = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (retry.error || !retry.data.session) {
      throw new Error(
        "BLOCKED: no session (email confirmation likely required); cannot run JWT boundary tests.",
      );
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "M2B.4 BGMI ownership review security boundaries",
  () => {
    beforeAll(async () => {
      const anon = anonClient();
      const player = await signUpIdentity(anon, emailFor("player"));
      const other = await signUpIdentity(anon, emailFor("other"));
      const reviewer = await signUpIdentity(anon, emailFor("reviewer"));
      playerId = player.id;
      reviewerId = reviewer.id;
      tokenPlayer = player.accessToken;
      tokenOther = other.accessToken;
      tokenReviewer = reviewer.accessToken;
      playerHandle = handleFor("p");

      const clientP = authedClient(tokenPlayer);
      const clientO = authedClient(tokenOther);
      const clientR = authedClient(tokenReviewer);

      await createPlayerProfile(clientP, {
        handle: playerHandle,
        display_name: "M2B4 Player",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });
      await createPlayerProfile(clientO, {
        handle: handleFor("o"),
        display_name: "M2B4 Other",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });
      await createPlayerProfile(clientR, {
        handle: handleFor("r"),
        display_name: "M2B4 Reviewer",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });

      // Bootstrap reviewer AFTER app_users row exists (FK on platform_admins).
      const admin = adminClient();
      const { error: adminErr } = await admin.from("platform_admins").insert({
        user_id: reviewerId,
        reason: "M2B4 integration test reviewer bootstrap",
      });
      if (adminErr) {
        throw new Error(`BLOCKED: could not bootstrap test reviewer: ${adminErr.message}`);
      }

      await createGameProfile(clientP, {
        game_key: "bgmi",
        ign: "M2B4IGN",
        game_user_id: BGMI_ID,
      });
      await setDiscoverability(clientP, { is_discoverable: true });

      const draft = await createBgmiOwnershipDraftCase(clientP);
      caseId = draft.id;
      const uploaded = await uploadBgmiOwnershipEvidence(clientP, {
        caseId,
        bytes: await makePng(),
      });
      evidenceId = uploaded.id;
      await submitBgmiOwnershipCase(clientP, caseId);
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE || trackedUserIds.length === 0) return;
      const admin = adminClient();
      // Remove membership and case rows before auth delete — auth.admin.deleteUser
      // does not always cascade app_users/cases in this environment.
      await admin.from("platform_admins").delete().eq("user_id", reviewerId);
      // Delete cases first. Do not delete app_users rows: ON DELETE SET NULL on
      // admin_audit_logs.actor_user_id is blocked by the append-only trigger.
      await admin
        .from("player_bgmi_ownership_cases")
        .delete()
        .in("player_id", trackedUserIds);
      for (const id of trackedUserIds) {
        await admin.auth.admin.deleteUser(id);
      }
    }, 120_000);

    it("ordinary user cannot list reviewer queue", async () => {
      await expect(
        listPendingBgmiOwnershipCases(authedClient(tokenOther)),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
    });

    it("ordinary user cannot approve or reject", async () => {
      await expect(
        decideBgmiOwnershipCase(authedClient(tokenOther), {
          caseId,
          decision: "approved",
          internalReason: "Should not work for ordinary users",
        }),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
    });

    it("player cannot inspect queue or mint reviewer evidence URL for own case", async () => {
      await expect(
        listPendingBgmiOwnershipCases(authedClient(tokenPlayer)),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);

      await expect(
        mintReviewerBgmiOwnershipEvidenceSignedUrl(authedClient(tokenPlayer), {
          caseId,
          evidenceId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
    });

    it("reviewer can mint short-lived signed URL; unauthorized mint denied", async () => {
      const minted = await mintReviewerBgmiOwnershipEvidenceSignedUrl(
        authedClient(tokenReviewer),
        { caseId, evidenceId },
      );
      expect(minted.expiresIn).toBe(60);
      expect(minted.signedUrl.startsWith("http")).toBe(true);

      await expect(
        mintReviewerBgmiOwnershipEvidenceSignedUrl(authedClient(tokenOther), {
          caseId,
          evidenceId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
    });

    it("ordinary user cannot forge admin_audit_logs rows", async () => {
      const { error } = await authedClient(tokenOther).from("admin_audit_logs").insert({
        actor_user_id: playerId,
        action: "bgmi_ownership.approve",
        target_type: "bgmi_ownership_case",
        target_id: caseId,
        reason: "forged",
      });
      expect(error).not.toBeNull();
    });

    it("pending case does not produce a public badge; projection stays 12 fields", async () => {
      expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
      const status = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(status?.ownership_reviewed ?? false).toBe(false);
      expect(status?.status_label ?? null).toBeNull();
    });

    it("approval fails on identity mismatch; succeeds when IDs match; duplicate rejected", async () => {
      const clientP = authedClient(tokenPlayer);
      const clientR = authedClient(tokenReviewer);

      await updateGameProfile(clientP, "bgmi", {
        game_user_id: "99999999",
      });

      // ID change should flag pending → id_mismatch via trigger.
      const { data: flagged } = await clientR
        .from("player_bgmi_ownership_cases")
        .select("status")
        .eq("id", caseId)
        .maybeSingle();
      expect(flagged?.status).toBe("id_mismatch");

      // Restore ID; create a fresh pending case for the approve path.
      await updateGameProfile(clientP, "bgmi", {
        game_user_id: BGMI_ID,
      });
      const draft2 = await createBgmiOwnershipDraftCase(clientP);
      await uploadBgmiOwnershipEvidence(clientP, {
        caseId: draft2.id,
        bytes: await makePng(),
      });
      await submitBgmiOwnershipCase(clientP, draft2.id);

      const approved = await decideBgmiOwnershipCase(clientR, {
        caseId: draft2.id,
        decision: "approved",
        internalReason: "Evidence matches claimed Player ID",
      });
      expect(approved.status).toBe("approved");

      await expect(
        decideBgmiOwnershipCase(clientR, {
          caseId: draft2.id,
          decision: "rejected",
          internalReason: "Duplicate decision must fail",
          playerFacingMessage: "Please resubmit with clearer evidence.",
        }),
      ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);

      const publicStatus = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(publicStatus?.ownership_reviewed).toBe(true);
      expect(publicStatus?.status_label).toBe("BGMI ownership evidence reviewed");
      expect(JSON.stringify(publicStatus)).not.toContain(BGMI_ID);
      expect(JSON.stringify(publicStatus)).not.toContain("internal");

      // Changed BGMI ID invalidates public approval.
      await updateGameProfile(clientP, "bgmi", {
        game_user_id: "88888888",
      });
      const afterChange = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(afterChange?.ownership_reviewed ?? false).toBe(false);
    });

    it("reviewer cannot approve their own case", async () => {
      const clientR = authedClient(tokenReviewer);
      await createGameProfile(clientR, {
        game_key: "bgmi",
        ign: "ReviewerIGN",
        game_user_id: "11223344",
      });
      const draft = await createBgmiOwnershipDraftCase(clientR);
      await uploadBgmiOwnershipEvidence(clientR, {
        caseId: draft.id,
        bytes: await makePng(),
      });
      await submitBgmiOwnershipCase(clientR, draft.id);

      await expect(
        decideBgmiOwnershipCase(clientR, {
          caseId: draft.id,
          decision: "approved",
          internalReason: "Self approval must be rejected",
        }),
      ).rejects.toBeInstanceOf(BgmiOwnershipForbiddenError);
    });
  },
);
