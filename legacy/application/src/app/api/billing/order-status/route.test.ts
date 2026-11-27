import { describe, it, expect, vi, beforeEach } from "vitest";
import { forbiddenError } from "@/lib/errors";

const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: vi.fn(async (orgId: string) => {
    if (orgId === "org-forbidden") throw forbiddenError("not member");
    return { organization: { id: orgId } };
  }),
}));

import { GET } from "./route";

function req(orderId: string | null) {
  const url = orderId
    ? `https://example.com/api/billing/order-status?orderId=${orderId}`
    : "https://example.com/api/billing/order-status";
  return new Request(url, { method: "GET" });
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    organization_id: "org-a",
    plan_id: "plan-1",
    tool_id: "tool-1",
    is_all_access: false,
    status: "created",
    provider: "dodo",
    ...overrides,
  };
}

// Chainable eq mock supporting up to 3 filters (org + tool + all-access)
function eqChain(final: unknown): never {
  const terminal = { maybeSingle: vi.fn(async () => final), single: vi.fn(async () => final) };
  const level3 = { eq: vi.fn(() => terminal), ...terminal };
  const level2 = { eq: vi.fn(() => level3), ...terminal };
  return { eq: vi.fn(() => level2), ...terminal } as never;
}

function fromMock(orderData: unknown, entData: unknown) {
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "orders") {
      return { select: vi.fn(() => eqChain({ data: orderData, error: null })) } as never;
    }
    if (table === "tool_entitlements") {
      return { select: vi.fn(() => eqChain({ data: entData, error: null })) } as never;
    }
    return { select: vi.fn(() => eqChain({ data: null, error: null })) } as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/billing/order-status — member-scoped read-only", () => {
  it("returns created status for a member of the order org", async () => {
    fromMock(orderRow(), null);
    const res = await GET(req("11111111-1111-1111-1111-111111111111"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; provider?: string };
    expect(body.status).toBe("created");
    expect(body.provider).toBe("dodo");
  });

  it("returns paid status with entitlement expiry", async () => {
    fromMock(orderRow({ status: "paid" }), { expires_at: "2026-11-18T00:00:00.000Z" });
    const res = await GET(req("11111111-1111-1111-1111-111111111111"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; expiresAt?: string | null };
    expect(body.status).toBe("paid");
    expect(body.expiresAt).toBe("2026-11-18T00:00:00.000Z");
  });

  it("rejects non-members (cross-org order lookup)", async () => {
    fromMock(orderRow({ organization_id: "org-forbidden" }), null);
    const res = await GET(req("11111111-1111-1111-1111-111111111111"));
    expect(res.status).toBe(403);
  });

  it("rejects missing order id", async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown orders (no org leak)", async () => {
    fromMock(null, null);
    const res = await GET(req("22222222-2222-2222-2222-222222222222"));
    expect(res.status).toBe(400);
  });
});
