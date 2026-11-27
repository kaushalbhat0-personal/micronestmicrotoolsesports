// Super-admin BGMI ownership review operations (P15-M2B.4).
// Every sensitive call starts with requireSuperAdmin(). Signed URLs for
// evidence use service-role only AFTER that gate (Storage RLS stays owner-only).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ForbiddenSuperAdminError,
  UnauthenticatedError,
  requireSuperAdmin,
} from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/server/supabase-admin";
import {
  BGMI_OWNERSHIP_BUCKET,
  BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
  BgmiOwnershipForbiddenError,
  BgmiOwnershipNotFoundError,
  BgmiOwnershipOperationError,
  BgmiOwnershipReviewError,
  BgmiOwnershipValidationError,
  isBgmiOwnershipStatus,
  type BgmiOwnershipCase,
  type BgmiOwnershipEvidenceSummary,
  type BgmiOwnershipPublicStatus,
  type BgmiOwnershipReviewQueueItem,
} from "../../domain/bgmi-ownership";
import { bgmiOwnershipCaseIdSchema, bgmiOwnershipEvidenceIdSchema } from "../../schemas/bgmi-ownership";

interface CaseRow {
  id: string;
  player_id: string;
  status: string;
  claimed_game_user_id: string | null;
  identity_mismatch: boolean;
  evidence_count: number;
  submitted_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
  player_facing_message?: string | null;
}

function toCase(row: CaseRow): BgmiOwnershipCase {
  if (!isBgmiOwnershipStatus(row.status)) {
    throw new BgmiOwnershipOperationError();
  }
  return {
    id: row.id,
    player_id: row.player_id,
    status: row.status,
    claimed_game_user_id: row.claimed_game_user_id,
    identity_mismatch: row.identity_mismatch,
    evidence_count: row.evidence_count,
    submitted_at: row.submitted_at,
    withdrawn_at: row.withdrawn_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listPendingBgmiOwnershipCases(
  client: SupabaseClient,
  limit = 50,
): Promise<BgmiOwnershipReviewQueueItem[]> {
  await requireSuperAdmin(client);
  const { data, error } = await client.rpc("list_pending_bgmi_ownership_cases", {
    p_limit: limit,
  });
  if (error) {
    if (error.message?.toLowerCase().includes("forbidden")) {
      throw new ForbiddenSuperAdminError();
    }
    throw new BgmiOwnershipReviewError();
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const status = row.status;
    if (!isBgmiOwnershipStatus(status)) {
      throw new BgmiOwnershipReviewError();
    }
    return {
      case_id: String(row.case_id),
      player_id: String(row.player_id),
      handle: String(row.handle),
      display_name: String(row.display_name),
      ign: typeof row.ign === "string" ? row.ign : null,
      claimed_game_user_id: String(row.claimed_game_user_id),
      submitted_at: typeof row.submitted_at === "string" ? row.submitted_at : null,
      evidence_count: Number(row.evidence_count),
      status,
      identity_mismatch: Boolean(row.identity_mismatch),
    };
  });
}

export async function listCaseEvidenceForReview(
  client: SupabaseClient,
  caseId: string,
): Promise<BgmiOwnershipEvidenceSummary[]> {
  await requireSuperAdmin(client);
  const parsed = bgmiOwnershipCaseIdSchema.safeParse(caseId);
  if (!parsed.success) {
    throw new BgmiOwnershipValidationError("Invalid case.");
  }

  const { data: caseRow, error: caseError } = await client
    .from("player_bgmi_ownership_cases")
    .select("id,status")
    .eq("id", parsed.data)
    .maybeSingle();

  if (caseError) {
    throw new BgmiOwnershipReviewError();
  }
  if (!caseRow) {
    throw new BgmiOwnershipNotFoundError();
  }

  const { data, error } = await client
    .from("player_bgmi_ownership_evidence")
    .select("id,sort_order,content_type,width,height,byte_size")
    .eq("case_id", parsed.data)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new BgmiOwnershipReviewError();
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const contentType = row.content_type;
    const sortOrder = row.sort_order;
    if (
      (contentType !== "image/jpeg" &&
        contentType !== "image/png" &&
        contentType !== "image/webp") ||
      (sortOrder !== 1 && sortOrder !== 2)
    ) {
      throw new BgmiOwnershipReviewError();
    }
    return {
      id: String(row.id),
      sort_order: sortOrder,
      content_type: contentType,
      width: Number(row.width),
      height: Number(row.height),
      byte_size: Number(row.byte_size),
    };
  });
}

/**
 * Reviewer-only signed URL. Authz first; service-role mint only after gate.
 * Never logs the URL. Expiry 60s.
 */
export async function mintReviewerBgmiOwnershipEvidenceSignedUrl(
  client: SupabaseClient,
  input: { caseId: string; evidenceId: string },
): Promise<{ signedUrl: string; expiresIn: number }> {
  const admin = await requireSuperAdmin(client);
  const caseId = bgmiOwnershipCaseIdSchema.parse(input.caseId);
  const evidenceId = bgmiOwnershipEvidenceIdSchema.parse(input.evidenceId);

  const { data: evidence, error } = await client
    .from("player_bgmi_ownership_evidence")
    .select("id,case_id,player_id,storage_bucket,storage_path")
    .eq("id", evidenceId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    throw new BgmiOwnershipReviewError();
  }
  if (!evidence) {
    throw new BgmiOwnershipForbiddenError();
  }

  const row = evidence as {
    storage_bucket: string;
    storage_path: string;
    player_id: string;
  };

  if (row.player_id === admin.userId) {
    throw new BgmiOwnershipForbiddenError();
  }
  if (row.storage_bucket !== BGMI_OWNERSHIP_BUCKET) {
    throw new BgmiOwnershipReviewError();
  }

  const adminClient = createAdminClient();
  const { data: signed, error: signError } = await adminClient.storage
    .from(BGMI_OWNERSHIP_BUCKET)
    .createSignedUrl(row.storage_path, BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw new BgmiOwnershipReviewError();
  }

  return {
    signedUrl: signed.signedUrl,
    expiresIn: BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
  };
}

export async function decideBgmiOwnershipCase(
  client: SupabaseClient,
  input: {
    caseId: string;
    decision: "approved" | "rejected";
    internalReason: string;
    playerFacingMessage?: string | null | undefined;
  },
): Promise<BgmiOwnershipCase> {
  await requireSuperAdmin(client);
  const caseId = bgmiOwnershipCaseIdSchema.parse(input.caseId);
  const reason = input.internalReason.trim();
  if (reason.length < 5 || reason.length > 500) {
    throw new BgmiOwnershipValidationError(
      "Internal reason must be 5–500 characters.",
    );
  }

  let facing: string | null = null;
  if (input.decision === "rejected") {
    facing = (input.playerFacingMessage ?? "").trim();
    if (facing.length < 5 || facing.length > 280) {
      throw new BgmiOwnershipValidationError(
        "Player-facing rejection message must be 5–280 characters.",
      );
    }
  }

  const { data, error } = await client.rpc("decide_player_bgmi_ownership_case", {
    p_case_id: caseId,
    p_decision: input.decision,
    p_internal_reason: reason,
    p_player_facing_message: facing,
  });

  if (error || data == null) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("forbidden")) {
      throw new ForbiddenSuperAdminError();
    }
    if (msg.includes("own case")) {
      throw new BgmiOwnershipForbiddenError();
    }
    if (msg.includes("not pending") || msg.includes("concurrent")) {
      throw new BgmiOwnershipValidationError(
        "This case is no longer pending review.",
      );
    }
    if (msg.includes("identity mismatch")) {
      throw new BgmiOwnershipValidationError(
        "Cannot approve: current Player ID does not match the submitted snapshot.",
      );
    }
    if (msg.includes("evidence")) {
      throw new BgmiOwnershipValidationError("Evidence is missing or invalid.");
    }
    if (msg.includes("not authenticated")) {
      throw new UnauthenticatedError();
    }
    if (msg.includes("not eligible") || msg.includes("case not found")) {
      throw new BgmiOwnershipValidationError("Case is not eligible for review.");
    }
    if (msg.includes("internal reason") || msg.includes("player facing")) {
      throw new BgmiOwnershipValidationError("Review reason validation failed.");
    }
    // Preserve a safe, non-sensitive RPC reason for diagnostics (no secrets).
    throw new BgmiOwnershipReviewError(
      msg ? `Could not complete review (${msg.slice(0, 120)}).` : undefined,
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new BgmiOwnershipReviewError();
  }
  return toCase(row as CaseRow);
}

export async function getPlayerBgmiOwnershipPublicStatus(
  client: SupabaseClient,
  handle: string,
): Promise<BgmiOwnershipPublicStatus | null> {
  const { data, error } = await client.rpc(
    "get_player_bgmi_ownership_public_status",
    { p_handle: handle },
  );
  if (error) {
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return null;
  }
  const rec = row as Record<string, unknown>;
  if (typeof rec.handle !== "string") {
    return null;
  }
  return {
    handle: rec.handle,
    ownership_reviewed: rec.ownership_reviewed === true,
    status_label:
      typeof rec.status_label === "string" ? rec.status_label : null,
  };
}
