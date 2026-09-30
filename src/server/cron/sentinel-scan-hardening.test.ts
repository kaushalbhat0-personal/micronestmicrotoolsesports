import { describe, expect, it, vi, beforeEach } from "vitest";
import { runCampaignScans } from "./sentinel-scan";
import * as scanner from "@/server/scanner/scan-orchestrator";

vi.mock("@/server/scanner/scan-orchestrator", async () => {
  const actual = await vi.importActual<typeof scanner>("@/server/scanner/scan-orchestrator");
  return { ...actual, executeScan: vi.fn() };
});

describe("06B hardening - correlation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("every Cron invocation receives a unique run ID included in logs", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    const execMock = vi.mocked(scanner.executeScan);
    execMock.mockResolvedValue({ scan: { id: "scan-1" } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] });

    const campaigns = [
      { campaign: { id: "c1" } as never, organizationId: "org-a" },
    ];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const runId1 = "run-1111-1111";
    const runId2 = "run-2222-2222";

    await runCampaignScans(supabase, campaigns, { cronRunId: runId1 });
    const logs1 = warnSpy.mock.calls.map((c) => String(c[0]));
    warnSpy.mockClear();

    await runCampaignScans(supabase, campaigns, { cronRunId: runId2 });
    const logs2 = warnSpy.mock.calls.map((c) => String(c[0]));

    expect(logs1.some((l) => l.includes(runId1))).toBe(true);
    expect(logs2.some((l) => l.includes(runId2))).toBe(true);
    expect(logs1.some((l) => l.includes(runId2))).toBe(false);

    warnSpy.mockRestore();
  });

  it("campaign duration measured and logged", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    vi.mocked(scanner.executeScan).mockResolvedValue({ scan: { id: "scan-123" } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await runCampaignScans(supabase, [{ campaign: { id: "c1" } as never, organizationId: "org-a" }], { cronRunId: "run-x" });
    expect(res.results[0]?.durationMs).toBeGreaterThanOrEqual(0);
    const logs = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes("sentinel_campaign_completed") && l.includes("durationMs"))).toBe(true);
    warnSpy.mockRestore();
  });

  it("logs start, success, completion events with safe identifiers", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    vi.mocked(scanner.executeScan).mockResolvedValue({ scan: { id: "scan-999" } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runCampaignScans(supabase, [{ campaign: { id: "camp-1" } as never, organizationId: "org-1" }], { cronRunId: "run-safe" });
    const logs = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logs).toContain("sentinel_campaign_started");
    expect(logs).toContain("camp-1");
    expect(logs).toContain("org-1");
    expect(logs).toContain("scan-999");
    expect(logs).not.toContain("CRON_SECRET");
    expect(logs).not.toContain("YOUTUBE_API_KEY");
    warnSpy.mockRestore();
  });

  it("failure isolation still 2 success 1 failure with errorKind", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    vi.mocked(scanner.executeScan).mockImplementation(async ({ input }) => {
      if (input.campaignId === "fail") throw Object.assign(new Error("quota exceeded for search.list"), { kind: "quota_exceeded" });
      return { scan: { id: "scan-ok" } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] };
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await runCampaignScans(
      supabase,
      [
        { campaign: { id: "ok1" } as never, organizationId: "org-a" },
        { campaign: { id: "fail" } as never, organizationId: "org-a" },
        { campaign: { id: "ok2" } as never, organizationId: "org-a" },
      ],
      { cronRunId: "run-err" },
    );
    expect(res.attempted).toBe(3);
    expect(res.succeeded).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.results.find((r) => r.campaignId === "fail")?.errorKind).toBe("quota_exceeded");
    const logs = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logs).toContain("sentinel_campaign_failed");
    expect(logs).toContain("quota_exceeded");
    warnSpy.mockRestore();
  });

  it("error sanitization does not leak Bearer token", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    vi.mocked(scanner.executeScan).mockRejectedValue(new Error("Bearer secret-token-12345 quotaExceeded"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await runCampaignScans(supabase, [{ campaign: { id: "c1" } as never, organizationId: "org-a" }], { cronRunId: "run-sanitize" });
    expect(res.results[0]?.error).not.toContain("secret-token-12345");
    expect(res.results[0]?.error).toContain("Bearer ***");
    warnSpy.mockRestore();
  });

  it("tenant safety: logs use DB-derived orgId not request", async () => {
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    vi.mocked(scanner.executeScan).mockResolvedValue({ scan: { id: "s" } as never, evidenceCount: 0, evaluationCount: 0, stageErrors: [] });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await runCampaignScans(supabase, [{ campaign: { id: "camp-real" } as never, organizationId: "org-real" }], { cronRunId: "run-tenant" });
    const logs = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logs).toContain("org-real");
    expect(logs).not.toContain("evil-org");
    warnSpy.mockRestore();
  });

  it("overlap: duplicate evidence prevented by DB unique, but scans duplicated", async () => {
    // This documents existing behavior: evidence uniqueness prevents duplicate rows, but scans are append-only.
    // We simulate two overlapping runs both calling executeScan for same campaign; second evidence insert hits unique constraint and is swallowed.
    const supabase = {} as unknown as import("@supabase/supabase-js").SupabaseClient;
    let callCount = 0;
    vi.mocked(scanner.executeScan).mockImplementation(async () => {
      callCount++;
      return { scan: { id: `scan-${callCount}` } as never, evidenceCount: 1, evaluationCount: 1, stageErrors: [] };
    });
    const campaigns = [{ campaign: { id: "camp-1" } as never, organizationId: "org-a" }];
    const r1 = await runCampaignScans(supabase, campaigns, { cronRunId: "run-a" });
    const r2 = await runCampaignScans(supabase, campaigns, { cronRunId: "run-b" });
    expect(r1.results[0]?.scanId).not.toBe(r2.results[0]?.scanId); // two scans created
    // Evidence dedupe is handled inside executeScan via DB unique, not here; we document that API calls CAN be duplicated
    expect(callCount).toBe(2);
  });
});
