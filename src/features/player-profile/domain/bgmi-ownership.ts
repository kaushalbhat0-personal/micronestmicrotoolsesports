// BGMI ownership evidence domain types + safe errors (P15-M2B.3B).
// Messages never include BGMI IDs, storage paths with foreign uids, or file bytes.

export const BGMI_OWNERSHIP_BUCKET = "private-verification" as const;
export const BGMI_OWNERSHIP_PATH_PREFIX = "bgmi-ownership" as const;
export const BGMI_OWNERSHIP_MAX_EVIDENCE = 2 as const;
export const BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
export const BGMI_OWNERSHIP_SIGNED_URL_TTL_SECONDS = 60 as const;

export const BGMI_OWNERSHIP_STATUSES = [
  "draft",
  "pending_review",
  "withdrawn",
  "id_mismatch",
  "approved",
  "rejected",
] as const;

export type BgmiOwnershipStatus = (typeof BGMI_OWNERSHIP_STATUSES)[number];

export type BgmiOwnershipContentType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface BgmiOwnershipCase {
  id: string;
  player_id: string;
  status: BgmiOwnershipStatus;
  claimed_game_user_id: string | null;
  identity_mismatch: boolean;
  evidence_count: number;
  submitted_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Player-safe DTO — never add reviewer notes here. */
export interface BgmiOwnershipCaseStatusView {
  id: string;
  status: BgmiOwnershipStatus;
  identity_mismatch: boolean;
  evidence_count: number;
  submitted_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  /** Owner-visible snapshot only (never public). Null for draft/withdrawn. */
  claimed_game_user_id: string | null;
  /** True when live ID differs from snapshot (pending/id_mismatch). */
  live_id_matches_claim: boolean | null;
  /** Safe player-facing rejection copy only (never internal reviewer notes). */
  player_facing_message: string | null;
  decided_at: string | null;
}

export interface BgmiOwnershipPublicStatus {
  handle: string;
  ownership_reviewed: boolean;
  status_label: string | null;
}

export interface BgmiOwnershipReviewQueueItem {
  case_id: string;
  player_id: string;
  handle: string;
  display_name: string;
  ign: string | null;
  claimed_game_user_id: string;
  submitted_at: string | null;
  evidence_count: number;
  status: BgmiOwnershipStatus;
  identity_mismatch: boolean;
}

export class BgmiOwnershipReviewError extends Error {
  constructor(message = "Could not complete review.") {
    super(message);
    this.name = "BgmiOwnershipReviewError";
  }
}

/** Safe evidence card for owner UI — no storage paths. */
export interface BgmiOwnershipEvidenceSummary {
  id: string;
  sort_order: 1 | 2;
  content_type: BgmiOwnershipContentType;
  width: number;
  height: number;
  byte_size: number;
}

export interface BgmiOwnershipEvidence {
  id: string;
  case_id: string;
  player_id: string;
  storage_bucket: typeof BGMI_OWNERSHIP_BUCKET;
  storage_path: string;
  content_type: BgmiOwnershipContentType;
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  sort_order: 1 | 2;
  created_at: string;
}

export class BgmiOwnershipValidationError extends Error {
  constructor(message = "Invalid verification evidence.") {
    super(message);
    this.name = "BgmiOwnershipValidationError";
  }
}

export class BgmiOwnershipOperationError extends Error {
  constructor(message = "Could not complete verification evidence operation.") {
    super(message);
    this.name = "BgmiOwnershipOperationError";
  }
}

export class BgmiOwnershipRateLimitError extends Error {
  constructor() {
    super("Too many verification attempts. Please try again later.");
    this.name = "BgmiOwnershipRateLimitError";
  }
}

export class BgmiOwnershipNotFoundError extends Error {
  constructor() {
    super("Verification case not found.");
    this.name = "BgmiOwnershipNotFoundError";
  }
}

export class BgmiOwnershipForbiddenError extends Error {
  constructor() {
    super("Not allowed.");
    this.name = "BgmiOwnershipForbiddenError";
  }
}

export function isBgmiOwnershipStatus(value: unknown): value is BgmiOwnershipStatus {
  return (
    typeof value === "string" &&
    (BGMI_OWNERSHIP_STATUSES as readonly string[]).includes(value)
  );
}
