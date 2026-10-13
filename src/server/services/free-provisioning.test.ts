import { describe, expect, it, vi, beforeEach } from "vitest";
import { provisionStarterFreeGrants, starterFreeToolSlugs } from "./free-provisioning";

/**
 * Starter Free provisioning (RCCF F1). The canonical claim dispatch is
 * mocked at the module boundary; eligibility derivation and best-effort
 * fan-out are asserted for real.
 */

const mockClaimFreeTool = vi.fn();

vi.mock("@/server/services/tool-claim", () => ({
  claimFreeTool: (...args: unknown[]) =>
    (mockClaimFreeTool as (...a: unknown[]) => unknown)(...args),
}));

beforeEach(() => {
  mockClaimFreeTool.mockReset();
  mockClaimFreeTool.mockResolvedValue({ ok: true });
});

describe("starterFreeToolSlugs", () => {
  it("covers exactly the six released Free-claimable tools", () => {
    expect(starterFreeToolSlugs().sort()).toEqual(
      [
        "draft-ban",
        "payout-tracker",
        "prize-splitter",
        "roster-builder",
        "sponsor-sentinel",
        "tie-breaker",
      ].sort()
    );
  });
});

describe("provisionStarterFreeGrants", () => {
  it("attempts every eligible tool through the canonical claim path", async () => {
    const res = await provisionStarterFreeGrants("acme");
    expect(mockClaimFreeTool).toHaveBeenCalledTimes(6);
    for (const slug of starterFreeToolSlugs()) {
      expect(mockClaimFreeTool).toHaveBeenCalledWith(slug, "acme");
    }
    expect(res.granted.sort()).toEqual(starterFreeToolSlugs().sort());
    expect(res.skipped).toEqual([]);
  });

  it("one tool failing never blocks the others (claim fallback remains)", async () => {
    mockClaimFreeTool.mockImplementation(async (slug: unknown) =>
      slug === "tie-breaker" ? { error: "boom" } : { ok: true }
    );
    const res = await provisionStarterFreeGrants("acme");
    expect(mockClaimFreeTool).toHaveBeenCalledTimes(6);
    expect(res.granted).not.toContain("tie-breaker");
    expect(res.granted).toHaveLength(5);
    expect(res.skipped).toEqual([{ toolSlug: "tie-breaker", reason: "boom" }]);
  });

  it("unexpected throw is captured as skipped, never raised", async () => {
    mockClaimFreeTool.mockRejectedValue(new Error("db down"));
    const res = await provisionStarterFreeGrants("acme");
    expect(res.granted).toEqual([]);
    expect(res.skipped).toHaveLength(6);
    expect(res.skipped[0]?.reason).toContain("db down");
  });
});
