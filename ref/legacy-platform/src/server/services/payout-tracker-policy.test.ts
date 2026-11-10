import { describe, expect, it, vi } from "vitest";
import {
  FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH,
  FREE_PAYOUT_TRACKER_RECIPIENTS_MAX,
  PAID_PAYOUT_TRACKER_RECIPIENTS_MAX,
  assertPayoutTrackerCovered,
  getPayoutWorkspaceMonthKey,
  isPayoutTrackerQuotaError,
  mapConsumePayoutPublishError,
  mapCreatePayoutRecipientError,
  payoutTrackerQuotaError,
  recipientsMaxForLevel,
  resolvePayoutTrackerAccessLevel,
} from "./payout-tracker-policy";
import { AppError } from "@/lib/errors";

function mockSupabase(toolId: string | null, grants: unknown[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === "tools") {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: toolId ? { id: toolId } : null, error: toolId ? null : new Error("missing") })) };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn(async () => ({ data: grants, error: null })) };
    }),
  } as never;
}

describe("payout-tracker policy", () => {
  it("exposes the approved V1 limits", () => {
    expect(FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH).toBe(1);
    expect(FREE_PAYOUT_TRACKER_RECIPIENTS_MAX).toBe(20);
    expect(PAID_PAYOUT_TRACKER_RECIPIENTS_MAX).toBe(200);
  });

  it("resolves paid before free, none when uncovered or unregistered", async () => {
    const paid = await resolvePayoutTrackerAccessLevel(
      mockSupabase("tool-1", [{ is_all_access: false, tool_id: "tool-1", source: "subscription", expires_at: null }]),
      { organizationId: "org-1" },
    );
    expect(paid).toBe("paid");

    const free = await resolvePayoutTrackerAccessLevel(
      mockSupabase("tool-1", [{ is_all_access: false, tool_id: "tool-1", source: "free", expires_at: null }]),
      { organizationId: "org-1" },
    );
    expect(free).toBe("free");

    const none = await resolvePayoutTrackerAccessLevel(mockSupabase("tool-1", []), { organizationId: "org-1" });
    expect(none).toBe("none");

    const unregistered = await resolvePayoutTrackerAccessLevel(mockSupabase(null, []), { organizationId: "org-1" });
    expect(unregistered).toBe("none");
  });

  it("treats expired grants as absent", async () => {
    const level = await resolvePayoutTrackerAccessLevel(
      mockSupabase("tool-1", [{ is_all_access: false, tool_id: "tool-1", source: "subscription", expires_at: "2020-01-01T00:00:00Z" }]),
      { organizationId: "org-1" },
    );
    expect(level).toBe("none");
  });

  it("caps recipients by level", () => {
    expect(recipientsMaxForLevel("paid")).toBe(200);
    expect(recipientsMaxForLevel("free")).toBe(20);
    expect(recipientsMaxForLevel("none")).toBe(20);
  });

  it("keys workspace months in org timezone (DST-safe)", () => {
    expect(getPayoutWorkspaceMonthKey(new Date("2026-11-15T12:00:00Z"), "Asia/Kolkata")).toBe("2026-11");
    expect(() => getPayoutWorkspaceMonthKey(new Date(), "IST")).toThrow();
  });

  it("maps publish RPC SQLSTATEs onto domain errors", () => {
    const quota = mapConsumePayoutPublishError({ code: "PTPQ1", message: "quota_exceeded" });
    expect(isPayoutTrackerQuotaError(quota)).toBe(true);
    expect(payoutTrackerQuotaError()).toBeInstanceOf(AppError);

    const noAccess = mapConsumePayoutPublishError({ code: "PTPN1", message: "no_access: nope" });
    expect(noAccess).toBeInstanceOf(AppError);
    expect((noAccess as AppError).code).toBe("ENTITLEMENT_REQUIRED");

    const invalid = mapConsumePayoutPublishError({ code: "PTPD1", message: "invalid: add recipient" });
    expect((invalid as AppError).code).toBe("VALIDATION_ERROR");
  });

  it("fails closed on level none, passes paid and free", () => {
    expect(() => assertPayoutTrackerCovered("none")).toThrowError(AppError);
    try {
      assertPayoutTrackerCovered("none");
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("ENTITLEMENT_REQUIRED");
    }
    expect(() => assertPayoutTrackerCovered("paid")).not.toThrow();
    expect(() => assertPayoutTrackerCovered("free")).not.toThrow();
  });

  it("maps create-recipient RPC errors onto domain errors", () => {
    const freeCap = mapCreatePayoutRecipientError(new Error("recipient_limit: maxed"), "free");
    expect((freeCap as AppError).code).toBe("VALIDATION_ERROR");
    expect((freeCap as AppError).safeMessage).toMatch(/at most 20/);

    const paidCap = mapCreatePayoutRecipientError(new Error("recipient_limit: maxed"), "paid");
    expect((paidCap as AppError).safeMessage).toMatch(/at most 200/);

    const notMember = mapCreatePayoutRecipientError(
      { code: "PTPN1", message: "no_access: user is not a member of organization" },
      "free",
    );
    expect((notMember as AppError).code).toBe("FORBIDDEN");

    const noCoverage = mapCreatePayoutRecipientError({ code: "PTPN1", message: "no_access: nope" }, "free");
    expect((noCoverage as AppError).code).toBe("ENTITLEMENT_REQUIRED");
  });
});
