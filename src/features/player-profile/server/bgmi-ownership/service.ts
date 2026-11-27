// Private BGMI ownership evidence server operations (P15-M2B.3B).
// Call sites: Server Actions / Route Handlers with AUTHENTICATED OWNER client.
// Identity exclusively from client.auth.getUser(). No caller-supplied user ids.
// Paths built server-side. No public URLs. No service-role for owner flows.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SuspendedError,
  UnauthenticatedError,
} from "../../domain/app-user";
import {
  BGMI_OWNERSHIP_BUCKET,
  BGMI_OWNERSHIP_MAX_EVIDENCE,
  BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
  BgmiOwnershipForbiddenError,
  BgmiOwnershipNotFoundError,
  BgmiOwnershipOperationError,
  BgmiOwnershipValidationError,
  isBgmiOwnershipStatus,
  type BgmiOwnershipCase,
  type BgmiOwnershipCaseStatusView,
  type BgmiOwnershipEvidence,
  type BgmiOwnershipEvidenceSummary,
} from "../../domain/bgmi-ownership";
import {
  bgmiOwnershipCaseIdSchema,
  bgmiOwnershipSignedUrlInputSchema,
  bgmiOwnershipUploadInputSchema,
} from "../../schemas/bgmi-ownership";
import { ensureAppUser } from "../ensure-app-user";
import { buildBgmiOwnershipObjectPath } from "./paths";
import { assertBgmiOwnershipRateLimit } from "./rate-limit";
import { sanitizeBgmiOwnershipImage } from "./sanitize-image";

const CASE_COLUMNS =
  "id,player_id,status,claimed_game_user_id,identity_mismatch,evidence_count,submitted_at,withdrawn_at,created_at,updated_at,decided_at,player_facing_message";

const EVIDENCE_COLUMNS =
  "id,case_id,player_id,storage_bucket,storage_path,content_type,byte_size,width,height,sha256,sort_order,created_at";

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

interface EvidenceRow {
  id: string;
  case_id: string;
  player_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  sort_order: number;
  created_at: string;
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

function toEvidence(row: EvidenceRow): BgmiOwnershipEvidence {
  if (
    row.storage_bucket !== BGMI_OWNERSHIP_BUCKET ||
    (row.content_type !== "image/jpeg" &&
      row.content_type !== "image/png" &&
      row.content_type !== "image/webp") ||
    (row.sort_order !== 1 && row.sort_order !== 2)
  ) {
    throw new BgmiOwnershipOperationError();
  }
  return {
    id: row.id,
    case_id: row.case_id,
    player_id: row.player_id,
    storage_bucket: BGMI_OWNERSHIP_BUCKET,
    storage_path: row.storage_path,
    content_type: row.content_type,
    byte_size: row.byte_size,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

async function requireActiveOwner(client: SupabaseClient): Promise<string> {
  const appUser = await ensureAppUser(client);
  if (appUser.status === "suspended") {
    throw new SuspendedError();
  }
  return appUser.id;
}

async function loadOwnCase(
  client: SupabaseClient,
  caseId: string,
  ownerId: string,
): Promise<BgmiOwnershipCase> {
  const parsed = bgmiOwnershipCaseIdSchema.safeParse(caseId);
  if (!parsed.success) {
    throw new BgmiOwnershipValidationError("Invalid case.");
  }

  const { data, error } = await client
    .from("player_bgmi_ownership_cases")
    .select(CASE_COLUMNS)
    .eq("id", parsed.data)
    .eq("player_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new BgmiOwnershipOperationError();
  }
  if (!data) {
    throw new BgmiOwnershipNotFoundError();
  }
  return toCase(data as CaseRow);
}

async function readLiveBgmiId(
  client: SupabaseClient,
  ownerId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("player_game_profiles")
    .select("game_user_id")
    .eq("player_user_id", ownerId)
    .eq("game_key", "bgmi")
    .maybeSingle();

  if (error) {
    throw new BgmiOwnershipOperationError();
  }
  const value = data?.game_user_id;
  if (typeof value !== "string" || value.trim().length < 4) {
    return null;
  }
  return value;
}

export async function createBgmiOwnershipDraftCase(
  client: SupabaseClient,
): Promise<BgmiOwnershipCase> {
  const ownerId = await requireActiveOwner(client);
  await assertBgmiOwnershipRateLimit(client, "create_case");

  const liveId = await readLiveBgmiId(client, ownerId);
  if (!liveId) {
    throw new BgmiOwnershipValidationError(
      "Save your BGMI Player ID before uploading verification evidence.",
    );
  }

  const { data: existing } = await client
    .from("player_bgmi_ownership_cases")
    .select("id,status")
    .eq("player_id", ownerId)
    .in("status", ["draft", "pending_review"])
    .maybeSingle();

  if (existing) {
    throw new BgmiOwnershipValidationError(
      "You already have an active verification submission.",
    );
  }

  const { data, error } = await client
    .from("player_bgmi_ownership_cases")
    .insert({
      player_id: ownerId,
      status: "draft",
    })
    .select(CASE_COLUMNS)
    .single();

  if (error || !data) {
    throw new BgmiOwnershipOperationError();
  }
  return toCase(data as CaseRow);
}

export async function uploadBgmiOwnershipEvidence(
  client: SupabaseClient,
  input: unknown,
): Promise<BgmiOwnershipEvidence> {
  const ownerId = await requireActiveOwner(client);
  await assertBgmiOwnershipRateLimit(client, "upload");

  const parsed = bgmiOwnershipUploadInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BgmiOwnershipValidationError();
  }

  const ownershipCase = await loadOwnCase(client, parsed.data.caseId, ownerId);
  if (ownershipCase.status !== "draft") {
    throw new BgmiOwnershipValidationError(
      "Submitted evidence cannot be replaced. Withdraw and submit again.",
    );
  }
  if (ownershipCase.evidence_count >= BGMI_OWNERSHIP_MAX_EVIDENCE) {
    throw new BgmiOwnershipValidationError(
      "A maximum of two evidence images is allowed.",
    );
  }

  const liveId = await readLiveBgmiId(client, ownerId);
  if (!liveId) {
    throw new BgmiOwnershipValidationError(
      "Save your BGMI Player ID before uploading verification evidence.",
    );
  }

  const sanitized = await sanitizeBgmiOwnershipImage(parsed.data.bytes);
  const evidenceId = randomUUID();
  const storagePath = buildBgmiOwnershipObjectPath({
    ownerUserId: ownerId,
    caseId: ownershipCase.id,
    evidenceId,
    contentType: sanitized.contentType,
  });
  const sortOrder = (ownershipCase.evidence_count + 1) as 1 | 2;

  const { error: uploadError } = await client.storage
    .from(BGMI_OWNERSHIP_BUCKET)
    .upload(storagePath, sanitized.bytes, {
      contentType: sanitized.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new BgmiOwnershipOperationError();
  }

  const { data: row, error: insertError } = await client
    .from("player_bgmi_ownership_evidence")
    .insert({
      id: evidenceId,
      case_id: ownershipCase.id,
      player_id: ownerId,
      storage_bucket: BGMI_OWNERSHIP_BUCKET,
      storage_path: storagePath,
      content_type: sanitized.contentType,
      byte_size: sanitized.bytes.byteLength,
      width: sanitized.width,
      height: sanitized.height,
      sha256: sanitized.sha256,
      sort_order: sortOrder,
    })
    .select(EVIDENCE_COLUMNS)
    .single();

  if (insertError || !row) {
    await client.storage.from(BGMI_OWNERSHIP_BUCKET).remove([storagePath]);
    throw new BgmiOwnershipOperationError();
  }

  return toEvidence(row as EvidenceRow);
}

export async function submitBgmiOwnershipCase(
  client: SupabaseClient,
  caseId: string,
): Promise<BgmiOwnershipCase> {
  const ownerId = await requireActiveOwner(client);
  await assertBgmiOwnershipRateLimit(client, "submit");

  const ownershipCase = await loadOwnCase(client, caseId, ownerId);
  if (ownershipCase.status !== "draft") {
    throw new BgmiOwnershipValidationError("Case is not submittable.");
  }
  if (
    ownershipCase.evidence_count < 1 ||
    ownershipCase.evidence_count > BGMI_OWNERSHIP_MAX_EVIDENCE
  ) {
    throw new BgmiOwnershipValidationError(
      "Submit between one and two evidence images.",
    );
  }

  const liveId = await readLiveBgmiId(client, ownerId);
  if (!liveId) {
    throw new BgmiOwnershipValidationError(
      "Save your BGMI Player ID before submitting verification.",
    );
  }

  const { data, error } = await client.rpc("submit_player_bgmi_ownership_case", {
    p_case_id: ownershipCase.id,
  });

  if (error || data == null) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("bgmi player id")) {
      throw new BgmiOwnershipValidationError(
        "Save your BGMI Player ID before submitting verification.",
      );
    }
    if (msg.includes("evidence")) {
      throw new BgmiOwnershipValidationError(
        "Submit between one and two evidence images.",
      );
    }
    throw new BgmiOwnershipOperationError();
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new BgmiOwnershipOperationError();
  }
  return toCase(row as CaseRow);
}

export interface WithdrawBgmiOwnershipResult {
  caseId: string;
  deletedObjectCount: number;
  storageDeleteFailures: number;
  alreadyWithdrawn: boolean;
}

export async function withdrawBgmiOwnershipCase(
  client: SupabaseClient,
  caseId: string,
): Promise<WithdrawBgmiOwnershipResult> {
  const ownerId = await requireActiveOwner(client);
  await assertBgmiOwnershipRateLimit(client, "withdraw");

  await loadOwnCase(client, caseId, ownerId);

  const { data, error } = await client.rpc("withdraw_player_bgmi_ownership_case", {
    p_case_id: caseId,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("not found")) {
      throw new BgmiOwnershipNotFoundError();
    }
    throw new BgmiOwnershipOperationError();
  }

  const rows = (data ?? []) as Array<{
    case_id: string;
    storage_path: string;
    already_withdrawn: boolean;
  }>;

  if (rows.length === 0) {
    return {
      caseId,
      deletedObjectCount: 0,
      storageDeleteFailures: 0,
      alreadyWithdrawn: true,
    };
  }

  const paths = rows.map((r) => r.storage_path).filter((p) => typeof p === "string" && p.length > 0);
  let storageDeleteFailures = 0;
  if (paths.length > 0) {
    const { error: removeError } = await client.storage
      .from(BGMI_OWNERSHIP_BUCKET)
      .remove(paths);
    if (removeError) {
      storageDeleteFailures = paths.length;
    }
  }

  return {
    caseId,
    deletedObjectCount: paths.length - storageDeleteFailures,
    storageDeleteFailures,
    alreadyWithdrawn: false,
  };
}

export async function getMyBgmiOwnershipCaseStatus(
  client: SupabaseClient,
  caseId?: string,
): Promise<BgmiOwnershipCaseStatusView | null> {
  const ownerId = await requireActiveOwner(client);

  let query = client
    .from("player_bgmi_ownership_cases")
    .select(CASE_COLUMNS)
    .eq("player_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (caseId) {
    const parsed = bgmiOwnershipCaseIdSchema.safeParse(caseId);
    if (!parsed.success) {
      throw new BgmiOwnershipValidationError("Invalid case.");
    }
    query = client
      .from("player_bgmi_ownership_cases")
      .select(CASE_COLUMNS)
      .eq("player_id", ownerId)
      .eq("id", parsed.data)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new BgmiOwnershipOperationError();
  }
  if (!data) {
    return null;
  }

  const ownershipCase = toCase(data as CaseRow);
  const liveId = await readLiveBgmiId(client, ownerId);

  let liveMatches: boolean | null = null;
  if (
    ownershipCase.claimed_game_user_id != null &&
    (ownershipCase.status === "pending_review" ||
      ownershipCase.status === "id_mismatch" ||
      ownershipCase.status === "approved")
  ) {
    liveMatches =
      liveId != null && liveId === ownershipCase.claimed_game_user_id;
  }

  const rowFull = data as CaseRow;
  return {
    id: ownershipCase.id,
    status: ownershipCase.status,
    identity_mismatch: ownershipCase.identity_mismatch,
    evidence_count: ownershipCase.evidence_count,
    submitted_at: ownershipCase.submitted_at,
    withdrawn_at: ownershipCase.withdrawn_at,
    created_at: ownershipCase.created_at,
    claimed_game_user_id: ownershipCase.claimed_game_user_id,
    live_id_matches_claim: liveMatches,
    player_facing_message: rowFull.player_facing_message ?? null,
    decided_at: rowFull.decided_at ?? null,
  };
}

export async function listMyBgmiOwnershipEvidenceSummary(
  client: SupabaseClient,
  caseId: string,
): Promise<BgmiOwnershipEvidenceSummary[]> {
  const rows = await listMyBgmiOwnershipEvidence(client, caseId);
  return rows.map((row) => ({
    id: row.id,
    sort_order: row.sort_order,
    content_type: row.content_type,
    width: row.width,
    height: row.height,
    byte_size: row.byte_size,
  }));
}

export async function listMyBgmiOwnershipEvidence(
  client: SupabaseClient,
  caseId: string,
): Promise<BgmiOwnershipEvidence[]> {
  const ownerId = await requireActiveOwner(client);
  await loadOwnCase(client, caseId, ownerId);

  const { data, error } = await client
    .from("player_bgmi_ownership_evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("case_id", caseId)
    .eq("player_id", ownerId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new BgmiOwnershipOperationError();
  }
  return (data as EvidenceRow[] | null)?.map(toEvidence) ?? [];
}

/**
 * Owner-only short-lived signed URL. Never logs the URL. Never public.
 */
export async function mintBgmiOwnershipEvidenceSignedUrl(
  client: SupabaseClient,
  input: unknown,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const ownerId = await requireActiveOwner(client);
  await assertBgmiOwnershipRateLimit(client, "signed_url");

  const parsed = bgmiOwnershipSignedUrlInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new BgmiOwnershipValidationError();
  }

  await loadOwnCase(client, parsed.data.caseId, ownerId);

  const { data: evidence, error } = await client
    .from("player_bgmi_ownership_evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("id", parsed.data.evidenceId)
    .eq("case_id", parsed.data.caseId)
    .eq("player_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new BgmiOwnershipOperationError();
  }
  if (!evidence) {
    throw new BgmiOwnershipForbiddenError();
  }

  const row = toEvidence(evidence as EvidenceRow);
  const { data: signed, error: signError } = await client.storage
    .from(BGMI_OWNERSHIP_BUCKET)
    .createSignedUrl(row.storage_path, BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    throw new BgmiOwnershipOperationError();
  }

  return {
    signedUrl: signed.signedUrl,
    expiresIn: BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS,
  };
}

export async function getSessionUserIdOrThrow(
  client: SupabaseClient,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    throw new UnauthenticatedError();
  }
  return user.id;
}
