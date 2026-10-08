import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateCheckoutOrder = vi.fn();

vi.mock("@/server/billing/checkout-service", () => ({
  createCheckoutOrder: (...args: unknown[]) => (mockCreateCheckoutOrder as (...a: unknown[]) => unknown)(...args),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://example.com/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateCheckoutOrder.mockResolvedValue({ orderId: "order-1", razorpayOrderId: "rzp-1", amountMinor: 100, currency: "INR", keyId: "rzp_test" });
});

describe("POST /api/billing/checkout — buyer identity cannot come from the client", () => {
  it("25+2. buyer_user_id in body → 400, service never called", async () => {
    const res = await POST(req({ planId: "a1b2c3d4-1234-1234-1234-000000000001", organizationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", buyer_user_id: "attacker-chosen" }));
    expect(res.status).toBe(400);
    expect(mockCreateCheckoutOrder).not.toHaveBeenCalled();
  });

  it("buyerUserId / buyerId / user_id variants → 400", async () => {
    for (const key of ["buyerUserId", "buyerId", "user_id"]) {
      const res = await POST(req({ planId: "a1b2c3d4-1234-1234-1234-000000000001", organizationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", [key]: "attacker-chosen" }));
      expect(res.status).toBe(400);
    }
    expect(mockCreateCheckoutOrder).not.toHaveBeenCalled();
  });

  it("clean body → service called with plan + org only (no buyer field exists)", async () => {
    const res = await POST(req({ planId: "a1b2c3d4-1234-1234-1234-000000000001", organizationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }));
    expect(res.status).toBe(200);
    expect(mockCreateCheckoutOrder).toHaveBeenCalledWith({
      planId: "a1b2c3d4-1234-1234-1234-000000000001",
      organizationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    // No buyer key can even be expressed: CheckoutInput has no buyer field.
    const call = mockCreateCheckoutOrder.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(call)).toEqual(["planId", "organizationId"]);
  });
});
