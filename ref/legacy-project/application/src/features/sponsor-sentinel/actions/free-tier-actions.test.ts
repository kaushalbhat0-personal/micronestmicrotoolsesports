import { describe, expect, it, vi, beforeEach } from "vitest";
import { claimFreeSponsorshipAction } from "./free-tier-actions";

/**
 * Claim alias equivalence (Phase 3): the legacy Sponsorship claim action
 * must delegate to the generic dispatch with the canonical slug.
 */

const mockClaimFreeTool = vi.fn();

vi.mock("@/server/services/tool-claim", () => ({
  claimFreeTool: (...args: unknown[]) => (mockClaimFreeTool as (...a: unknown[]) => unknown)(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockClaimFreeTool.mockResolvedValue({ ok: true });
});

describe("claimFreeSponsorshipAction alias", () => {
  it("delegates to claimFreeTool with the canonical slug, preserving behavior", async () => {
    const res = await claimFreeSponsorshipAction("acme");
    expect(mockClaimFreeTool).toHaveBeenCalledTimes(1);
    expect(mockClaimFreeTool).toHaveBeenCalledWith("sponsor-sentinel", "acme");
    expect(res).toEqual({ ok: true });
  });

  it("passes dispatch errors through unchanged", async () => {
    mockClaimFreeTool.mockResolvedValueOnce({ error: "Missing organization" });
    const res = await claimFreeSponsorshipAction("");
    expect(res).toEqual({ error: "Missing organization" });
  });
});
