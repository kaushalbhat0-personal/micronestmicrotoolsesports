import { describe, expect, it, vi, beforeEach } from "vitest";
import { runCampaignScans } from "@/server/cron/sentinel-scan";
import { handleSentinelWebhookEvent } from "@/server/events/sentinel-handler";
import type { CanonicalWebhookEvent } from "@/features/sponsor-sentinel/types/events";

/**
 * FIX-06 H2: background paths thread the server-derived principal into
 * executeScan (so the database RPC performs the authoritative reservation),
 * and fail closed when coverage cannot be established.
 */

const mockExecuteScan = vi.fn(async () => ({ scan: { id: "s" } } as never));
vi.mock("@/server/scanner/scan-orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/scanner/scan-orchestrator")>();
  return {
    ...actual,
    executeScan: (...args: unknown[]) => (mockExecuteScan as (...a: unknown[]) => unknown)(...args),
  };
});

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

function chainClient(opts: {
  orgId?: string;
  campaigns?: Array<{ id: string; status: string }>;
  channels?: Array<{ connection_status: string }>;
}) {
  const orgId = opts.orgId ?? "org-a";
  const from = vi.fn((table: string) => {
    const self: Record<string, unknown> = {};
    self.select = () => self;
    self.eq = () => self;
    self.order = () => self;
    self.limit = () => self;
    self.in = () => self;
    self.maybeSingle = async () => {
      if (table === "connected_channels") return { data: { organization_id: orgId }, error: null };
      if (table === "scans") return { data: null, error: null };
      return { data: null, error: null };
    };
    self.single = async () => ({ data: null, error: null });
    self.then = (resolve: (v: unknown) => void) => {
      if (table === "sponsor_campaigns") {
        resolve({
          data: (opts.campaigns ?? [{ id: "camp-1", status: "active" }]).map((c) => ({ ...c, organization_id: orgId })),
          error: null,
        });
      } else if (table === "connected_channels") {
        resolve({
          data: (opts.channels ?? [{ connection_status: "connected" }]).map((c, i) => ({
            id: `ch-${i}`,
            organization_id: orgId,
            platform: "twitch",
            ...c,
          })),
          error: null,
        });
      } else if (table === "deliverables") {
        resolve({ data: [{ id: "del-1", rule: { type: "required_title_contains" } }], error: null });
      } else if (table === "scans") {
        resolve({ data: [], error: null });
      } else resolve({ data: [], error: null });
    };
    return self;
  });
  return { from, rpc: vi.fn(async () => ({ data: true, error: null })) } as never;
}

function twitchEvent(): CanonicalWebhookEvent {
  return {
    provider: "twitch",
    externalEventId: "evt-1",
    eventType: "stream.online",
    occurredAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    externalChannelId: "chan-123",
    externalContentId: null,
    payload: {},
  } as CanonicalWebhookEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolvePrincipal.mockResolvedValue({ level: "paid", userId: null });
  mockAssertEligible.mockResolvedValue({ coveredChannelId: null });
  mockExecuteScan.mockResolvedValue({ scan: { id: "s" } } as never);
});

describe("cron threads the server-derived principal", () => {
  it("free principal userId reaches executeScan input (atomic path engaged)", async () => {
    await runCampaignScans({} as never, [
      { campaign: { id: "c1" } as never, organizationId: "org-a", freeQuotaUserId: "owner-9" },
    ]);
    expect(mockExecuteScan).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ campaignId: "c1", userId: "owner-9" }) }),
    );
  });

  it("paid campaigns carry no userId (direct unmetered path)", async () => {
    await runCampaignScans({} as never, [{ campaign: { id: "c1" } as never, organizationId: "org-a" }]);
    const input = (mockExecuteScan.mock.calls[0] as unknown as Array<{ input: Record<string, unknown> }>)[0]?.input;
    expect(input).not.toHaveProperty("userId");
  });
});

describe("webhook threads the server-derived principal and fails closed", () => {
  it("free principal userId reaches executeScan input", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "free", userId: "owner-9" });
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("SCAN_COMPLETED");
    expect(mockExecuteScan).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ organizationId: "org-a", campaignId: "camp-1", userId: "owner-9" }),
      }),
    );
  });

  it("paid principal scans without userId (direct path)", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "paid", userId: null });
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("SCAN_COMPLETED");
    const input = (mockExecuteScan.mock.calls[0] as unknown as Array<{ input: Record<string, unknown> }>)[0]?.input;
    expect(input).not.toHaveProperty("userId");
  });

  it("free + null userId → NO_ACTION, never unmetered (fail closed)", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "free", userId: null });
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("NO_ACTION");
    expect(mockExecuteScan).not.toHaveBeenCalled();
  });

  it("none → NO_ACTION, zero provider traffic", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "none", userId: null });
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("NO_ACTION");
    expect(mockExecuteScan).not.toHaveBeenCalled();
  });

  it("unresolvable principal → NO_ACTION, zero provider traffic (fail closed)", async () => {
    mockResolvePrincipal.mockRejectedValueOnce(new Error("db exploded"));
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("NO_ACTION");
    expect(mockExecuteScan).not.toHaveBeenCalled();
  });

  it("quota-exhausted free campaign → skipped quietly, no scan", async () => {
    mockResolvePrincipal.mockResolvedValue({ level: "free", userId: "owner-9" });
    // The pre-filter skips on any eligibility throw (freeQuotaError or
    // otherwise) — over-quota campaigns never reach the scan loop.
    mockAssertEligible.mockRejectedValueOnce(
      Object.assign(new Error("You've used all 10 free checks this month."), { code: "VALIDATION_ERROR" }),
    );
    const res = await handleSentinelWebhookEvent(chainClient({}), twitchEvent());
    expect(res.status).toBe("NO_ACTION");
    expect(mockExecuteScan).not.toHaveBeenCalled();
  });
});
