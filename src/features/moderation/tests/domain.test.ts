// P10 moderation domain tests (no database).
// Covers: report vocabulary, report status transitions, verification
// transition table shape, moderation decision mapping, self-approval guard.

import { describe, expect, it } from "vitest";
import {
  canTransitionReport,
  isReportCategory,
  isReportResolution,
  isReportStatus,
  isReportableEntityType,
  MAX_REPORT_DESCRIPTION_LENGTH,
  MIN_REPORT_DESCRIPTION_LENGTH,
  REPORT_CATEGORIES,
  REPORT_RESOLUTIONS,
  REPORT_STATUSES,
} from "../domain/report";
import {
  DECISION_LIFECYCLE,
  isModerationDecision,
  isSelfApproval,
  MODERATION_DECISIONS,
} from "../domain/decision";
import {
  findVerificationTransition,
  isVerificationEvidenceCategory,
  VERIFICATION_TRANSITIONS,
} from "../domain/verification";

describe("report vocabulary", () => {
  it("targets tournaments and organizers only", () => {
    expect(isReportableEntityType("tournament")).toBe(true);
    expect(isReportableEntityType("organizer")).toBe(true);
    expect(isReportableEntityType("player")).toBe(false);
    expect(isReportableEntityType("team")).toBe(false);
  });

  it("keeps a small closed category set", () => {
    expect(REPORT_CATEGORIES).toContain("impersonation");
    expect(REPORT_CATEGORIES).toContain("scam_or_fraud");
    expect(isReportCategory("free-text-topic")).toBe(false);
  });

  it("bounds descriptions against PII dumps", () => {
    expect(MIN_REPORT_DESCRIPTION_LENGTH).toBe(10);
    expect(MAX_REPORT_DESCRIPTION_LENGTH).toBe(500);
  });

  it("moves forward only: no reopening in v1", () => {
    expect(canTransitionReport("open", "under_review")).toBe(true);
    expect(canTransitionReport("open", "dismissed")).toBe(true);
    expect(canTransitionReport("under_review", "resolved")).toBe(true);
    expect(canTransitionReport("resolved", "open")).toBe(false);
    expect(canTransitionReport("dismissed", "under_review")).toBe(false);
    expect(canTransitionReport("open", "resolved")).toBe(false);
    expect(isReportStatus("resolved")).toBe(true);
    expect(isReportResolution("duplicate")).toBe(true);
    expect(REPORT_STATUSES).toHaveLength(4);
    expect(REPORT_RESOLUTIONS).toHaveLength(3);
  });
});

describe("moderation decisions", () => {
  it("maps every decision to its lifecycle transition", () => {
    expect(DECISION_LIFECYCLE["publish"]).toEqual({ from: "submitted", to: "published" });
    expect(DECISION_LIFECYCLE["return_to_draft"]).toEqual({ from: "submitted", to: "draft" });
    expect(DECISION_LIFECYCLE["republish"]).toEqual({ from: "unpublished", to: "published" });
    expect(DECISION_LIFECYCLE["unpublish"]).toEqual({ from: "published", to: "unpublished" });
    expect(DECISION_LIFECYCLE["archive"]).toEqual({ from: "unpublished", to: "archived" });
    expect(MODERATION_DECISIONS).toHaveLength(5);
    expect(isModerationDecision("ban_user")).toBe(false);
  });

  it("rejection is a return to draft, never a stored state", () => {
    // No decision maps to a `rejected` lifecycle value: the public enum stays small.
    for (const decision of MODERATION_DECISIONS) {
      expect(DECISION_LIFECYCLE[decision].to).not.toBe("rejected");
    }
  });

  it("detects self-approval: members cannot decide on their own organizer", () => {
    expect(isSelfApproval(["org-1", "org-2"], "org-1")).toBe(true);
    expect(isSelfApproval(["org-1"], "org-9")).toBe(false);
    expect(isSelfApproval([], "org-1")).toBe(false);
  });
});

describe("verification workflow", () => {
  it("keeps every transition disabled while policy is unapproved", () => {
    for (const transition of VERIFICATION_TRANSITIONS) {
      expect(transition.disabledReason).not.toBeNull();
    }
  });

  it("routes submission through owner/admin and review through moderators", () => {
    expect(findVerificationTransition("not_submitted", "submitted")?.allowedBy).toBe("submitter");
    expect(findVerificationTransition("under_review", "confirmed")?.allowedBy).toBe("moderator");
    expect(findVerificationTransition("confirmed", "expired")?.allowedBy).toBe("moderator");
    // No direct path to confirmed: review is mandatory.
    expect(findVerificationTransition("submitted", "confirmed")).toBeNull();
    expect(findVerificationTransition("not_submitted", "confirmed")).toBeNull();
  });

  it("supports re-verification without rewriting history", () => {
    expect(findVerificationTransition("rejected", "submitted")).not.toBeNull();
    expect(findVerificationTransition("expired", "submitted")).not.toBeNull();
  });

  it("declares evidence categories without implying domain ownership counts", () => {
    expect(isVerificationEvidenceCategory("business_registration")).toBe(true);
    expect(isVerificationEvidenceCategory("website_reachable")).toBe(false);
  });
});
