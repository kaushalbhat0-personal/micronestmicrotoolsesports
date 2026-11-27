// P10 moderation authorization + writer-gate tests (no database).
// Covers: kill switch OFF, validated-then-blocked writes, disabled queue
// reads, forged reviewer identity rejection, session-derived identity.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ModerationWriteDisabledError } from "../domain/report";
import {
  assertModeratorActionAllowed,
  MODERATION_WRITES_ENABLED,
  parseModerationDecisionInput,
  parseReviewReportInput,
  parseSubmitReportInput,
  parseVerificationSubmitInput,
} from "../server/report-writer";
import { canTouchVerification } from "@/features/organizers/domain/permissions";

const here = dirname(fileURLToPath(import.meta.url));

function fakeAuthedClient(userId: string | null): {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> };
  rpc: () => Promise<{ data: unknown; error: null }>;
} {
  return {
    auth: {
      getUser: async () => ({
        data: { user: userId === null ? null : { id: userId } },
      }),
    },
    rpc: async () => ({
      data: userId === null ? [] : [{ id: userId, status: "active" }],
      error: null,
    }),
  };
}

const validReport = {
  entityType: "tournament",
  entitySlug: "monsoon-showdown-cup",
  category: "spam",
  description: "This listing repeats the same external link across five drafts.",
};

describe("moderation write gate", () => {
  it("stays disabled: the kill switch is OFF", () => {
    expect(MODERATION_WRITES_ENABLED).toBe(false);
  });

  it("parses report intake, then blocks before any table touch", async () => {
    const { submitReportOp } = await import("../server/report-writer");
    expect(() => parseSubmitReportInput(validReport)).not.toThrow();
    await expect(
      submitReportOp(fakeAuthedClient("11111111-1111-4111-8111-111111111111") as never, validReport)
    ).rejects.toBeInstanceOf(ModerationWriteDisabledError);
  });

  it("blocks review, decision, and verification ops even when valid", async () => {
    const { reviewReportOp, recordModerationDecisionOp, submitVerificationOp } = await import(
      "../server/report-writer"
    );
    const client = fakeAuthedClient("11111111-1111-4111-8111-111111111111") as never;
    const review = {
      reportId: "11111111-1111-4111-8111-111111111111",
      resolution: "duplicate",
      reason: "Same listing already reported and actioned.",
    };
    const decision = {
      tournamentId: "11111111-1111-4111-8111-111111111111",
      decision: "publish",
      reason: "Evidence reviewed; listing matches the organizer announcement.",
    };
    expect(() => parseReviewReportInput(review)).not.toThrow();
    expect(() => parseModerationDecisionInput(decision)).not.toThrow();
    expect(() =>
      parseVerificationSubmitInput({ organizerId: "11111111-1111-4111-8111-111111111111" })
    ).not.toThrow();
    await expect(reviewReportOp(client, review)).rejects.toBeInstanceOf(
      ModerationWriteDisabledError
    );
    await expect(recordModerationDecisionOp(client, decision)).rejects.toBeInstanceOf(
      ModerationWriteDisabledError
    );
    await expect(
      submitVerificationOp(client, { organizerId: "11111111-1111-4111-8111-111111111111" })
    ).rejects.toBeInstanceOf(ModerationWriteDisabledError);
  });

  it("blocks the disabled queue reader before any listing", async () => {
    const { listQueuedReports, getQueuedReport } = await import("../server/moderation-reader");
    const client = fakeAuthedClient("11111111-1111-4111-8111-111111111111") as never;
    await expect(listQueuedReports(client)).rejects.toBeInstanceOf(ModerationWriteDisabledError);
    await expect(
      getQueuedReport(client, "11111111-1111-4111-8111-111111111111")
    ).rejects.toBeInstanceOf(ModerationWriteDisabledError);
  });

  it("moderator actions throw the disabled error even when named", () => {
    expect(() => assertModeratorActionAllowed("submitted→published")).toThrow(
      ModerationWriteDisabledError
    );
  });
});

describe("moderation authorization boundaries (static + matrix)", () => {
  it("writer derives identity from the session (no caller-supplied user IDs)", () => {
    const source = readFileSync(join(here, "..", "server", "report-writer.ts"), "utf8");
    expect(source).toContain("ensureAppUser");
    expect(source).not.toMatch(/reporter_id|reviewer_id/);
    expect(source).not.toContain("service_role");
  });

  it("reader derives identity from the session and lists nothing", () => {
    const source = readFileSync(join(here, "..", "server", "moderation-reader.ts"), "utf8");
    expect(source).toContain("ensureAppUser");
    expect(source).not.toMatch(/\.from\(/);
  });

  it("verification stays untouchable for every role including moderator", () => {
    expect(canTouchVerification("owner")).toBe(false);
    expect(canTouchVerification("admin")).toBe(false);
    expect(canTouchVerification("editor")).toBe(false);
    expect(canTouchVerification("moderator")).toBe(false);
  });
});
