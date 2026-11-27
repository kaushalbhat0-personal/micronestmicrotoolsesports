// P10 moderation schema tests (no database).
// Covers: report intake bounds, protected-key rejection, review/decision
// reason requirements, verification-submit minimalism.

import { describe, expect, it } from "vitest";
import {
  moderationDecisionInputSchema,
  reviewReportInputSchema,
  submitReportInputSchema,
  verificationSubmitInputSchema,
} from "../schemas/report";

const validReport = {
  entityType: "tournament",
  entitySlug: "monsoon-showdown-cup",
  category: "incorrect_details",
  description: "The listed prize pool does not match the organizer announcement.",
};

describe("report intake schemas", () => {
  it("accepts a well-formed report", () => {
    expect(() => submitReportInputSchema.parse(validReport)).not.toThrow();
  });

  it("bounds the description on both sides", () => {
    expect(() =>
      submitReportInputSchema.parse({ ...validReport, description: "too short" })
    ).toThrow();
    expect(() =>
      submitReportInputSchema.parse({ ...validReport, description: "x".repeat(501) })
    ).toThrow();
  });

  it("rejects protected keys instead of dropping them", () => {
    for (const extra of [
      { reporterId: "11111111-1111-4111-8111-111111111111" },
      { reviewerId: "11111111-1111-4111-8111-111111111111" },
      { status: "resolved" },
      { createdAt: "2026-01-01T00:00:00.000Z" },
      { resolution: "action_taken" },
    ]) {
      expect(() => submitReportInputSchema.parse({ ...validReport, ...extra })).toThrow();
    }
  });

  it("accepts organizer targets and rejects unknown entity kinds", () => {
    expect(() =>
      submitReportInputSchema.parse({ ...validReport, entityType: "organizer" })
    ).not.toThrow();
    expect(() =>
      submitReportInputSchema.parse({ ...validReport, entityType: "player" })
    ).toThrow();
  });
});

describe("review and decision schemas", () => {
  it("requires a reason for every review resolution", () => {
    const base = { reportId: "11111111-1111-4111-8111-111111111111", resolution: "duplicate" };
    expect(() => reviewReportInputSchema.parse({ ...base, reason: "Same listing as #41." })).not.toThrow();
    expect(() => reviewReportInputSchema.parse({ ...base, reason: "ok" })).toThrow();
    expect(() => reviewReportInputSchema.parse(base)).toThrow();
  });

  it("requires a reason for every moderation decision", () => {
    const base = {
      tournamentId: "11111111-1111-4111-8111-111111111111",
      decision: "return_to_draft",
    };
    expect(() =>
      moderationDecisionInputSchema.parse({ ...base, reason: "Prize pool unverifiable; resubmit with proof." })
    ).not.toThrow();
    expect(() => moderationDecisionInputSchema.parse({ ...base, reason: "no" })).toThrow();
    // Lifecycle values are never accepted as input — the decision implies the transition.
    expect(() =>
      moderationDecisionInputSchema.parse({ ...base, reason: "Valid reason here.", lifecycle: "published" })
    ).toThrow();
  });

  it("keeps verification submission minimal: id only, no trust states", () => {
    expect(() =>
      verificationSubmitInputSchema.parse({ organizerId: "11111111-1111-4111-8111-111111111111" })
    ).not.toThrow();
    expect(() =>
      verificationSubmitInputSchema.parse({
        organizerId: "11111111-1111-4111-8111-111111111111",
        trustState: "confirmed",
      })
    ).toThrow();
  });
});
