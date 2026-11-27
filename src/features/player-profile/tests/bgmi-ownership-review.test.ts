import { describe, expect, it, vi, beforeEach } from "vitest";
import { ForbiddenSuperAdminError } from "@/lib/auth/require-super-admin";
import { BgmiOwnershipForbiddenError, BgmiOwnershipValidationError } from "../domain/bgmi-ownership";
import { PUBLIC_PROJECTION_COLUMNS } from "../domain/public-projection";

const requireSuperAdmin = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/auth/require-super-admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/require-super-admin")>(
    "@/lib/auth/require-super-admin",
  );
  return {
    ...actual,
    requireSuperAdmin: (...args: unknown[]) => requireSuperAdmin(...args),
  };
});

vi.mock("@/server/supabase-admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}));

import {
  decideBgmiOwnershipCase,
  listPendingBgmiOwnershipCases,
  mintReviewerBgmiOwnershipEvidenceSignedUrl,
} from "../server/bgmi-ownership/review";

const CASE_ID = "a1000000-0000-4000-8000-000000000001";
const EVIDENCE_ID = "a2000000-0000-4000-8000-000000000002";

describe("bgmi ownership review authorization", () => {
  beforeEach(() => {
    requireSuperAdmin.mockReset();
    createAdminClient.mockReset();
    requireSuperAdmin.mockResolvedValue({ userId: "admin-user" });
  });

  it("denies queue when requireSuperAdmin fails", async () => {
    requireSuperAdmin.mockRejectedValue(new ForbiddenSuperAdminError());
    await expect(
      listPendingBgmiOwnershipCases({} as never),
    ).rejects.toBeInstanceOf(ForbiddenSuperAdminError);
  });

  it("refuses reviewer signed URL for own player_id", async () => {
    requireSuperAdmin.mockResolvedValue({ userId: "player-a" });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: EVIDENCE_ID,
                  case_id: CASE_ID,
                  player_id: "player-a",
                  storage_bucket: "private-verification",
                  storage_path: "player-a/bgmi-ownership/x/y.jpg",
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    await expect(
      mintReviewerBgmiOwnershipEvidenceSignedUrl(client as never, {
        caseId: CASE_ID,
        evidenceId: EVIDENCE_ID,
      }),
    ).rejects.toBeInstanceOf(BgmiOwnershipForbiddenError);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("mints signed URL only after authz via admin client", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/signed?token=secret" },
      error: null,
    }));
    createAdminClient.mockReturnValue({
      storage: { from: () => ({ createSignedUrl }) },
    });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: EVIDENCE_ID,
                  case_id: CASE_ID,
                  player_id: "player-b",
                  storage_bucket: "private-verification",
                  storage_path: "player-b/bgmi-ownership/x/y.jpg",
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
    const out = await mintReviewerBgmiOwnershipEvidenceSignedUrl(client as never, {
      caseId: CASE_ID,
      evidenceId: EVIDENCE_ID,
    });
    expect(out.expiresIn).toBe(60);
    expect(createSignedUrl).toHaveBeenCalledWith(expect.any(String), 60);
  });

  it("maps identity mismatch approve failures", async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "identity mismatch" },
      })),
    };
    await expect(
      decideBgmiOwnershipCase(client as never, {
        caseId: CASE_ID,
        decision: "approved",
        internalReason: "Looks valid but ID drifted",
      }),
    ).rejects.toBeInstanceOf(BgmiOwnershipValidationError);
  });
});

describe("projection freeze", () => {
  it("keeps frozen G1 projection at 12 fields without verification internals", () => {
    expect(PUBLIC_PROJECTION_COLUMNS).toHaveLength(12);
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("claimed_game_user_id");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("decision_id");
    expect(PUBLIC_PROJECTION_COLUMNS).not.toContain("internal_reason");
  });
});
