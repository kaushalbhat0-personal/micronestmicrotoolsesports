import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/cron/cron-auth", () => ({
  assertCronAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) })) })),
}));
vi.mock("@/server/subscriptions/reconciler", () => ({
  reconcileAllSubscriptions: vi.fn(async () => ({ runId: "test-run", attempted: 0, created: 0, alreadyExists: 0, failed: 0, durationMs: 1, errors: [] })),
}));

import { assertCronAuth } from "@/server/cron/cron-auth";
import { GET } from "./route";
import { reconcileAllSubscriptions } from "@/server/subscriptions/reconciler";

describe("cron subscriptions route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("CRON_SECRET required — unauthorized rejected", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw new Error("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/subscriptions", { method: "GET" });
    const res = await GET(req);
    expect([401, 403, 500].includes(res.status)).toBe(true);
  });

  it("wrong secret → 401", async () => {
    vi.mocked(assertCronAuth).mockImplementation((req: Request) => {
      if (req.headers.get("authorization") !== "Bearer test-cron-secret-123456") throw new Error("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/subscriptions", { headers: { Authorization: "Bearer wrong" } });
    const res = await GET(req);
    expect([401, 403].includes(res.status)).toBe(true);
  });

  it("correct secret → accepted (even with no channels, bounded)", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {});
    vi.mocked(reconcileAllSubscriptions).mockResolvedValue({ runId: "test-run", attempted: 0, created: 0, alreadyExists: 0, failed: 0, durationMs: 1, errors: [] });
    const req = new Request("https://example.com/api/cron/subscriptions", { headers: { Authorization: "Bearer test-cron-secret-123456" } });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runId).toBe("test-run");
  });

  it("does not expose secrets in response", async () => {
    vi.mocked(assertCronAuth).mockImplementation(() => {
      throw new Error("Invalid cron secret");
    });
    const req = new Request("https://example.com/api/cron/subscriptions", { headers: { Authorization: "Bearer wrong-secret-value" } });
    const res = await GET(req);
    const body = await res.text();
    expect(body).not.toContain("wrong-secret-value");
  });
});
