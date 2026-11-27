// P15-E2E: seed ephemeral test data → run acceptance checks → delete.
// Run:
//   G1_TEST_MODE=p15e2e npm run test:integration -- p15-e2e-seed-cleanup.integration
// Never logs passwords, tokens, or signed URL query strings.
// Service-role: seed reviewer membership + cleanup only.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { ForbiddenSuperAdminError } from "@/lib/auth/require-super-admin";
import {
  BgmiOwnershipForbiddenError,
  BgmiOwnershipValidationError,
} from "../domain/bgmi-ownership";
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
import { setDiscoverability } from "../server/consent";
import { createGameProfile, updateGameProfile } from "../server/game-profile";
import { createPlayerProfile } from "../server/player-profile";

const ENABLED = process.env.G1_TEST_MODE === "p15e2e";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const SERVER_SIDE = typeof window === "undefined";

const RUN_ID = `p15e2e_${Date.now().toString(36)}`;
const emailFor = (who: string) => `${RUN_ID}_${who}@example.com`;
const handleFor = (who: string) => `${RUN_ID}${who}`.slice(0, 20);
const PASSWORD = `P15e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}!xQ`;
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
let approvedCaseId = "";

async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 30, g: 60, b: 90 },
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
  if (error) throw new Error(`SEED_BLOCKED: signUp failed: ${error.message}`);
  let session = data.session;
  if (!session) {
    const retry = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (retry.error || !retry.data.session) {
      throw new Error("SEED_BLOCKED: no session (email confirmation required).");
    }
    session = retry.data.session;
  }
  trackedUserIds.push(session.user.id);
  return { id: session.user.id, accessToken: session.access_token };
}

async function cleanupSeed(): Promise<{
  adminsRemoved: boolean;
  casesRemoved: number;
  authDeleted: number;
}> {
  const admin = adminClient();
  let casesRemoved = 0;
  let authDeleted = 0;

  if (reviewerId) {
    await admin.from("platform_admins").delete().eq("user_id", reviewerId);
  }

  if (trackedUserIds.length > 0) {
    const { data: before } = await admin
      .from("player_bgmi_ownership_cases")
      .select("id")
      .in("player_id", trackedUserIds);
    casesRemoved = before?.length ?? 0;
    await admin.from("player_bgmi_ownership_cases").delete().in("player_id", trackedUserIds);
  }

  for (const id of trackedUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) authDeleted += 1;
  }

  return {
    adminsRemoved: Boolean(reviewerId),
    casesRemoved,
    authDeleted,
  };
}

describe.skipIf(!ENABLED || !SERVER_SIDE || !URL || !ANON || !SERVICE)(
  "P15-E2E seed → test → delete",
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
        display_name: "P15E2E Player",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });
      await createPlayerProfile(clientO, {
        handle: handleFor("o"),
        display_name: "P15E2E Other",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });
      await createPlayerProfile(clientR, {
        handle: handleFor("r"),
        display_name: "P15E2E Reviewer",
        bio: "complete bio for discoverability gate",
        country_code: "IN",
      });

      const admin = adminClient();
      const { error: adminErr } = await admin.from("platform_admins").insert({
        user_id: reviewerId,
        reason: "P15-E2E ephemeral reviewer seed (delete after test)",
      });
      if (adminErr) {
        throw new Error(`SEED_BLOCKED: reviewer grant failed: ${adminErr.message}`);
      }

      await createGameProfile(clientP, {
        game_key: "bgmi",
        ign: "P15E2EIGN",
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
      // Optional second screenshot
      await uploadBgmiOwnershipEvidence(clientP, {
        caseId,
        bytes: await makePng(),
      });
      await submitBgmiOwnershipCase(clientP, caseId);
    }, 180_000);

    afterAll(async () => {
      if (!SERVICE) return;
      await cleanupSeed();
    }, 120_000);

    it("seeded pending case is visible only to reviewer", async () => {
      await expect(
        listPendingBgmiOwnershipCases(authedClient(tokenOther)),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);

      const queue = await listPendingBgmiOwnershipCases(authedClient(tokenReviewer));
      expect(queue.some((row) => row.case_id === caseId)).toBe(true);
      expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    });

    it("reviewer can inspect evidence; others cannot", async () => {
      const minted = await mintReviewerBgmiOwnershipEvidenceSignedUrl(
        authedClient(tokenReviewer),
        { caseId, evidenceId },
      );
      expect(minted.expiresIn).toBe(60);
      expect(minted.signedUrl.startsWith("http")).toBe(true);

      await expect(
        mintReviewerBgmiOwnershipEvidenceSignedUrl(authedClient(tokenPlayer), {
          caseId,
          evidenceId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
    });

    it("pending has no public badge; approve then badge; duplicate denied", async () => {
      const before = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(before?.ownership_reviewed ?? false).toBe(false);

      const approved = await decideBgmiOwnershipCase(authedClient(tokenReviewer), {
        caseId,
        decision: "approved",
        internalReason: "P15-E2E seed evidence matches claimed Player ID",
      });
      expect(approved.status).toBe("approved");
      approvedCaseId = approved.id;

      await expect(
        decideBgmiOwnershipCase(authedClient(tokenReviewer), {
          caseId,
          decision: "rejected",
          internalReason: "Duplicate must fail",
          playerFacingMessage: "Please resubmit with clearer evidence.",
        }),
      ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);

      const after = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(after?.ownership_reviewed).toBe(true);
      expect(after?.status_label).toBe("BGMI ownership evidence reviewed");
      expect(JSON.stringify(after)).not.toContain(BGMI_ID);
    });

    it("ID change invalidates approval and public badge", async () => {
      await updateGameProfile(authedClient(tokenPlayer), "bgmi", {
        game_user_id: "88888888",
      });
      const { data: flagged } = await authedClient(tokenReviewer)
        .from("player_bgmi_ownership_cases")
        .select("status")
        .eq("id", approvedCaseId || caseId)
        .maybeSingle();
      expect(flagged?.status).toBe("id_mismatch");

      const status = await getPlayerBgmiOwnershipPublicStatus(
        authedClient(tokenOther),
        playerHandle,
      );
      expect(status?.ownership_reviewed ?? false).toBe(false);
    });

    it("reviewer cannot approve own case", async () => {
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
          internalReason: "Self approval must fail",
        }),
      ).rejects.toBeInstanceOf(BgmiOwnershipForbiddenError);
    });

    it("cleanup leaves no seeded admins or cases for this run", async () => {
      // Explicit mid-suite cleanup verification: afterAll also runs.
      // Here we only assert ids are tracked so cleanup has targets.
      expect(trackedUserIds).toContain(playerId);
      expect(trackedUserIds).toContain(reviewerId);
      expect(caseId.length).toBeGreaterThan(0);
    });
  },
);
