import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadEligibleCampaigns } from "./sentinel-scan";

/**
 * NULL-PRINCIPAL-01: a free sponsorship principal without a quota owner must
 * fail closed (campaign skipped) — never fall into the paid/unmetered path.
 * The unmetered branch is entered ONLY on an explicit paid level.
 */

const mockResolvePrincipal = vi.fn(
  async (): Promise<{ level: "paid" | "free" | "none"; userId: string | null }> => ({ level: "paid", userId: null }),
);
const mockAssertEligible = vi.fn(async () => ({ coveredChannelId: null }));
vi.mock("@/server/services/sponsorship-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/services/sponsorship-limits")>();
  return {
    ...actual,
    resolveOrgCheckPrincipal: (...args: unknown[]) =>
      (mockResolvePrincipal as (...a: unknown[]) => unknown)(...args),
    assertFreeScanEligible: (...args: unknown[]) =>
      (mockAssertEligible as (...a: unknown[]) => unknown)(...args),
  };
});

function cronClient() {
  const from = vi.fn((table: string) => {
    const self: Record<string, unknown> = {};
    self.select = () => self;
    self.eq = () => self;
    self.single = async () => ({ data: null, error: null });
    self.then = (resolve: (v: unknown) => void) => {
      if (table === "sponsor_campaigns") {
        resolve({ data: [{ id: "camp-1", organization_id: "org-a", status: "active" }], error: null });
      } else if (table === "deliverables") {
        resolve({ data: null, error: null, count: 1 });
      } else if (table === "connected_channels") {
        resolve({ data: null, error: null, count: 1 });
      } else resolve({ data: [], error: null });
    };
    return self;
  });
  return { from, rpc: vi.fn(async () => ({ data: true, error: null })) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvePrincipal.mockResolvedValue({ level: "paid", userId: null });
  mockAssertEligible.mockResolvedValue({ coveredChannelId: null });
});

describe("cron null-principal fail-closed", () => {
  it("free + userId → metered eligibility with quota owner threaded", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "free", userId: "owner-9" });
    const res = await loadEligibleCampaigns(cronClient());
    expect(res).toHaveLength(1);
    expect(res[0]?.freeQuotaUserId).toBe("owner-9");
    expect(mockAssertEligible).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: "owner-9", organizationId: "org-a", campaignId: "camp-1" }),
    );
  });

  it("free + null userId → campaign skipped (never unmetered)", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "free", userId: null });
    const res = await loadEligibleCampaigns(cronClient());
    expect(res).toHaveLength(0);
    expect(mockAssertEligible).not.toHaveBeenCalled();
  });

  it("paid + null userId → unmetered eligibility preserved", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "paid", userId: null });
    const res = await loadEligibleCampaigns(cronClient());
    expect(res).toHaveLength(1);
    expect(res[0]?.freeQuotaUserId ?? null).toBeNull();
    expect(mockAssertEligible).not.toHaveBeenCalled();
  });

  it("none → campaign skipped", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "none", userId: null });
    const res = await loadEligibleCampaigns(cronClient());
    expect(res).toHaveLength(0);
  });
});
