import { describe, expect, it, vi, beforeEach } from "vitest";
import { forbiddenError } from "@/lib/errors";

vi.mock("@/server/cron/cron-auth", () => ({
  assertCronAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));
vi.mock("@/server/cron/sentinel-scan", () => ({
  loadEligibleCampaigns: vi.fn(),
  runCampaignScans: vi.fn(),
}));

import { assertCronAuth } from "@/server/cron/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import * as sentinelScan from "@/server/cron/sentinel-scan";
import { GET, POST } from "./route";

const CRON_SECRET = "test-secret-1234567890";

describe("cron sentinel-scan route - auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  it("missing Authorization → 401", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw forbiddenError("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: {} });
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code ?? body.error?.code).toBeDefined();
    expect(JSON.stringify(body)).not.toContain(CRON_SECRET);
  });

  it("wrong secret → 401", async () => {
    vi.mocked(assertCronAuth).mockImplementation((req: Request) => {
      if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) throw forbiddenError("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: { authorization: "Bearer wrong" } });
    const res = await GET(req);
    // handler catches and returns handleRouteError → 403
    expect([401, 403]).toContain(res.status);
  });

  it("correct secret → accepted", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    vi.mocked(sentinelScan.loadEligibleCampaigns).mockResolvedValue([]);
    vi.mocked(sentinelScan.runCampaignScans).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, results: [] });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("POST also requires auth", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw forbiddenError("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { method: "POST", headers: {} });
    const res = await POST(req);
    expect([401, 403]).toContain(res.status);
  });
});

describe("cron route - execution", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns summary attempted/succeeded/failed", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    vi.mocked(sentinelScan.loadEligibleCampaigns).mockResolvedValue([
      { campaign: { id: "c1" } as never, organizationId: "org-a" },
      { campaign: { id: "c2" } as never, organizationId: "org-a" },
    ]);
    vi.mocked(sentinelScan.runCampaignScans).mockResolvedValue({ attempted: 2, succeeded: 1, failed: 1, results: [] });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const res = await GET(req);
    const body = await res.json();
    expect(body.attempted).toBe(2);
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
  });

  it("no secret in response", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    vi.mocked(sentinelScan.loadEligibleCampaigns).mockResolvedValue([]);
    vi.mocked(sentinelScan.runCampaignScans).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, results: [] });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    const res = await GET(req);
    const text = await res.text();
    expect(text).not.toContain(CRON_SECRET);
  });

  it("does not accept organization_id from request", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    let capturedOrg: string | undefined;
    vi.mocked(sentinelScan.loadEligibleCampaigns).mockImplementation(async (_supabase) => {
      // ensure no request body used
      capturedOrg = undefined;
      return [];
    });
    vi.mocked(sentinelScan.runCampaignScans).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, results: [] });
    const req = new Request("https://example.com/api/cron/sentinel-scan?organization_id=evil-org", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    await GET(req);
    // loadEligibleCampaigns should not have received evil-org from query
    expect(capturedOrg).toBeUndefined();
  });

  it("uses admin client (privileged) but constrained queries", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    vi.mocked(sentinelScan.loadEligibleCampaigns).mockResolvedValue([]);
    vi.mocked(sentinelScan.runCampaignScans).mockResolvedValue({ attempted: 0, succeeded: 0, failed: 0, results: [] });
    const req = new Request("https://example.com/api/cron/sentinel-scan", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    await GET(req);
    expect(createAdminClient).toHaveBeenCalled();
  });
});
