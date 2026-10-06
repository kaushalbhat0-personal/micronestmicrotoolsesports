import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const _TEST_USER_EMAIL = "owner@example.com";

vi.mock("@/server/billing/live-test-service", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/billing/live-test-service")>);
  return {
    ...actual,
    createLiveTestCheckoutOrder: vi.fn(async ({ planId }: { planId: string }) => ({
      orderId: "order-live-1",
      razorpayOrderId: "order_razor_live_1",
      amountMinor: 100,
      currency: "INR",
      keyId: "rzp_test_123",
      planId,
      isLiveTest: true as const,
    })),
  };
});

import { POST } from "./route";
import { createLiveTestCheckoutOrder } from "@/server/billing/live-test-service";

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/billing/live-test/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/live-test/checkout — injection rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BILLING_LIVE_TEST_ENABLED = "true";
  });

  it("rejects client amountMinor injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", amountMinor: 1 }));
    expect(res.status).toBe(400);
    expect(createLiveTestCheckoutOrder).not.toHaveBeenCalled();
  });

  it("rejects client amount injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", amount: 100 }));
    expect(res.status).toBe(400);
    expect(createLiveTestCheckoutOrder).not.toHaveBeenCalled();
  });

  it("rejects client currency injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", currency: "USD" }));
    expect(res.status).toBe(400);
  });

  it("rejects client organizationId injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", organizationId: TEST_ORG_ID }));
    expect(res.status).toBe(400);
  });

  it("rejects client toolId injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", toolId: "tool-1" }));
    expect(res.status).toBe(400);
  });

  it("rejects client billingPeriod injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", billingPeriod: "monthly" }));
    expect(res.status).toBe(400);
  });

  it("rejects client isAllAccess injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", isAllAccess: true }));
    expect(res.status).toBe(400);
  });

  it("rejects client price injection", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001", price: 1 }));
    expect(res.status).toBe(400);
  });

  it("valid request passes", async () => {
    const res = await POST(makeReq({ planId: "a1b2c3d4-1234-1234-1234-000000000001" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.amountMinor).toBe(100);
    expect(json.isLiveTest).toBe(true);
    expect(createLiveTestCheckoutOrder).toHaveBeenCalledWith({ planId: "a1b2c3d4-1234-1234-1234-000000000001" });
  });

  it("missing planId → 400", async () => {
    const res = await POST(makeReq({} as never));
    expect(res.status).toBe(400);
  });

  it("invalid UUID → 400", async () => {
    const res = await POST(makeReq({ planId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });
});
