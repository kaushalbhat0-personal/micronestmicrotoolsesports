// P10 moderation report domain — intake vocabulary, statuses, and review
// invariants. Reports cover tournaments and organizers only. Reporter
// identity and private report details are never public; there is no
// unrestricted public report listing. All persistence and all reviewer
// actions stay DISABLED until the moderation authority (P10-04) and the
// queue retention/visibility rule are approved.

/** Entity kinds a report may target. Never extended implicitly. */
export const REPORTABLE_ENTITY_TYPES = ["tournament", "organizer"] as const;

export type ReportableEntityType = (typeof REPORTABLE_ENTITY_TYPES)[number];

export function isReportableEntityType(value: unknown): value is ReportableEntityType {
  return (
    typeof value === "string" &&
    (REPORTABLE_ENTITY_TYPES as ReadonlyArray<string>).includes(value)
  );
}

/** Report categories — small, closed vocabulary. No free-form topics. */
export const REPORT_CATEGORIES = [
  "spam",
  "impersonation",
  "incorrect_details",
  "inappropriate_content",
  "scam_or_fraud",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isReportCategory(value: unknown): value is ReportCategory {
  return (
    typeof value === "string" && (REPORT_CATEGORIES as ReadonlyArray<string>).includes(value)
  );
}

/** Report lifecycle. Terminal states are append-only history. */
export const REPORT_STATUSES = ["open", "under_review", "resolved", "dismissed"] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: unknown): value is ReportStatus {
  return (
    typeof value === "string" && (REPORT_STATUSES as ReadonlyArray<string>).includes(value)
  );
}

/** User-supplied description bounds: enough for a useful report, too small for PII dumps. */
export const MAX_REPORT_DESCRIPTION_LENGTH = 500;
export const MIN_REPORT_DESCRIPTION_LENGTH = 10;

/** Resolution reason bounds (reviewer-written, stored in the audit trail). */
export const MAX_RESOLUTION_REASON_LENGTH = 500;
export const MIN_RESOLUTION_REASON_LENGTH = 5;

/**
 * Allowed status transitions. Reporters cannot move a report; only
 * moderators move it, and only forward. Reopening is not permitted in v1 —
 * a new report must be filed so each decision has exactly one audit entry.
 */
const REPORT_TRANSITIONS: Readonly<Record<ReportStatus, ReadonlyArray<ReportStatus>>> = {
  open: ["under_review", "dismissed"],
  under_review: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return (REPORT_TRANSITIONS[from] ?? []).includes(to);
}

/** Resolutions that close a report. `dismissed` = no violation found. */
export const REPORT_RESOLUTIONS = ["action_taken", "no_violation", "duplicate"] as const;

export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

export function isReportResolution(value: unknown): value is ReportResolution {
  return (
    typeof value === "string" && (REPORT_RESOLUTIONS as ReadonlyArray<string>).includes(value)
  );
}

export class ReportValidationError extends Error {
  constructor() {
    super("Invalid report submission. Check the highlighted fields and try again.");
    this.name = "ReportValidationError";
  }
}

export class ReportOperationError extends Error {
  constructor() {
    super("Could not load the moderation queue. Please retry.");
    this.name = "ReportOperationError";
  }
}

/** Thrown before any table touch while moderation writes are disabled. */
export class ModerationWriteDisabledError extends Error {
  constructor() {
    super(
      "Moderation actions are disabled in this phase: reviewer authority, queue retention and verification policy are awaiting decisions. Nothing was saved."
    );
    this.name = "ModerationWriteDisabledError";
  }
}
