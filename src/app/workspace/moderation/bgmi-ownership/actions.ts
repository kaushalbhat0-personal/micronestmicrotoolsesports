"use server";

import { revalidatePath } from "next/cache";
import {
  BgmiOwnershipForbiddenError,
  BgmiOwnershipNotFoundError,
  BgmiOwnershipReviewError,
  BgmiOwnershipValidationError,
} from "@/features/player-profile/domain/bgmi-ownership";
import {
  decideBgmiOwnershipCase,
  mintReviewerBgmiOwnershipEvidenceSignedUrl,
} from "@/features/player-profile/server/bgmi-ownership";
import {
  ForbiddenSuperAdminError,
  UnauthenticatedError,
} from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";

export interface ReviewActionState {
  ok: boolean;
  message: string;
}

function mapError(error: unknown, fallback: string): ReviewActionState {
  if (error instanceof UnauthenticatedError) {
    return { ok: false, message: "Sign in required." };
  }
  if (error instanceof ForbiddenSuperAdminError || error instanceof BgmiOwnershipForbiddenError) {
    return { ok: false, message: "Not allowed." };
  }
  if (error instanceof BgmiOwnershipValidationError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof BgmiOwnershipNotFoundError) {
    return { ok: false, message: "Case not found." };
  }
  if (error instanceof BgmiOwnershipReviewError) {
    return { ok: false, message: fallback };
  }
  return { ok: false, message: fallback };
}

export async function approveBgmiOwnershipAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const caseId = formData.get("case_id");
  const reason = formData.get("internal_reason");
  if (typeof caseId !== "string" || typeof reason !== "string") {
    return { ok: false, message: "Case and internal reason are required." };
  }
  const client = await createClient();
  try {
    await decideBgmiOwnershipCase(client, {
      caseId,
      decision: "approved",
      internalReason: reason,
    });
    revalidatePath("/workspace/moderation/bgmi-ownership");
    revalidatePath("/settings/profile");
    return { ok: true, message: "Case approved." };
  } catch (error) {
    return mapError(error, "Could not approve this case.");
  }
}

export async function rejectBgmiOwnershipAction(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const caseId = formData.get("case_id");
  const reason = formData.get("internal_reason");
  const facing = formData.get("player_facing_message");
  if (
    typeof caseId !== "string" ||
    typeof reason !== "string" ||
    typeof facing !== "string"
  ) {
    return {
      ok: false,
      message: "Case, internal reason, and player-facing message are required.",
    };
  }
  const client = await createClient();
  try {
    await decideBgmiOwnershipCase(client, {
      caseId,
      decision: "rejected",
      internalReason: reason,
      playerFacingMessage: facing,
    });
    revalidatePath("/workspace/moderation/bgmi-ownership");
    revalidatePath("/settings/profile");
    return { ok: true, message: "Case rejected." };
  } catch (error) {
    return mapError(error, "Could not reject this case.");
  }
}

export async function mintReviewerEvidencePreviewAction(
  caseId: string,
  evidenceId: string,
): Promise<{ ok: true; url: string; expiresIn: number } | { ok: false; message: string }> {
  const client = await createClient();
  try {
    const minted = await mintReviewerBgmiOwnershipEvidenceSignedUrl(client, {
      caseId,
      evidenceId,
    });
    return { ok: true, url: minted.signedUrl, expiresIn: minted.expiresIn };
  } catch (error) {
    const mapped = mapError(error, "Could not open evidence.");
    return { ok: false, message: mapped.message };
  }
}
