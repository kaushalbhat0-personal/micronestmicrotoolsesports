/**
 * Dodo international V1 — focused security + flow tests.
 *
 * Covers: India INR regression, international USD Sponsorship Tracking,
 * every fail-closed attack case, and USD catalog isolation.
 *
 * USD amounts below (1900/19000) mirror the APPROVED V1 commercial prices
 * ($19.00 monthly, $190.00 yearly; see migration 20251120000001). Dodo and
 * catalog doubles stand in for the live API/DB; no network is touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── auth mocks (shared) ──────────────────────────────────────────────
let orgRoleImpl: (orgId: string, roles: string[]) => Promise<unknown> = async (orgId: string) => ({
  user: { id: "user-1", email: "buyer@example.com" },
  membership: { id: "mem-1", organization_id: orgId, user_id: "user-1", role: "owner" },
  organization: { id: orgId, name: "Test Org", slug: "test-org", owner_id: "user-1" },
});

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "buyer@example.com" })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: vi.fn(async (orgId: string) => orgRoleImpl(orgId, ["owner"])),
  requireOrganizationRole: vi.fn(async (orgId: string, roles: string[]) => orgRoleImpl(orgId, roles)),
}));

// ── admin mock (shared) ──────────────────────────────────────────────
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom, rpc: mockAdminRpc })),
}));

// ── dodo integration config mock ─────────────────────────────────────
const PRODUCT_BY_SLUG: Record<string, string> = {
  "sponsorship-tracking-monthly": "pdt_test_sponsorship_tracking_monthly",
  "sponsorship-tracking-yearly": "pdt_test_sponsorship_tracking_yearly",
  "sponsorship-tracking-monthly-usd": "pdt_test_sponsorship_tracking_monthly_usd",
  "sponsorship-tracking-yearly-usd": "pdt_test_sponsorship_tracking_yearly_usd",
  "prize-pool-splitter-monthly": "pdt_test_prize_pool_splitter_monthly",
};
let productOverride: ((slug: string) => string | null) | null = null;

vi.mock("@/server/integrations/dodo/client", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/integrations/dodo/client")>);
  return {
    ...actual,
    getDodoConfig: vi.fn(() => ({
      apiKey: "dodo_test_key",
      webhookKey: WEBHOOK_KEY,
      environment: "test_mode",
      returnUrl: "https://example.com/billing/return",
    })),
    getDodoProductIdForPlanSlug: vi.fn((slug: string) =>
      productOverride ? productOverride(slug) : (PRODUCT_BY_SLUG[slug] ?? null)
    ),
  };
});

// NOTE: ./dodo is NOT mocked here — the real adapter (validation + session
// construction) runs against injected fake clients. No network is touched.
import { DODO_METADATA_KEYS, type DodoClientLike } from "./dodo";
import { createCheckoutOrder } from "./checkout-service";

const WEBHOOK_KEY = `whsec_${Buffer.from("dodo-intl-test-secret-0123456789").toString("base64")}`;

// ── fixtures ─────────────────────────────────────────────────────────
const SPONSOR_TOOL_ID = "tool-sponsor-sentinel";

function planRow(overrides: Record<string, unknown>) {
  return {
    id: "plan-x",
    tool_id: SPONSOR_TOOL_ID,
    billing_period: "monthly",
    amount_minor: 149900,
    currency: "INR",
    is_active: true,
    slug: "sponsorship-tracking-monthly",
    name: "Sponsorship Tracking — Monthly",
    ...overrides,
  };
}

/** Fake Dodo client whose products.retrieve serves an explicit product table. */
function fakeDodoClient(products: Record<string, { currency: string; price: number; type?: string; recurring?: boolean; pwyw?: boolean }>): DodoClientLike {
  const sessionsCreate = vi.fn(async (params: { product_cart: Array<{ product_id: string }> }) => ({
    session_id: `cks_${params.product_cart[0]?.product_id ?? "x"}`,
    checkout_url: "https://checkout.dodopayments.com/session/cks_test",
  }));
  return {
    checkoutSessions: { create: sessionsCreate },
    payments: {
      retrieve: vi.fn(async () => {
        throw new Error("not used in checkout tests");
      }),
    },
    products: {
      retrieve: vi.fn(async (productId: string) => {
        const p = products[productId];
        if (!p) throw new Error("product not found");
        return {
          product_id: productId,
          is_recurring: p.recurring ?? false,
          price: {
            type: p.type ?? "one_time_price",
            currency: p.currency,
            price: p.price,
            ...(p.pwyw ? { pay_what_you_want: true } : {}),
          },
        };
      }),
    },
    webhooks: { unwrap: vi.fn() },
  };
}

const INR_PRODUCTS = {
  pdt_test_sponsorship_tracking_monthly: { currency: "INR", price: 149900 },
  pdt_test_sponsorship_tracking_yearly: { currency: "INR", price: 1499000 },
  pdt_test_prize_pool_splitter_monthly: { currency: "INR", price: 69900 },
};
const USD_PRODUCTS = {
  pdt_test_sponsorship_tracking_monthly_usd: { currency: "USD", price: 1900 },
  pdt_test_sponsorship_tracking_yearly_usd: { currency: "USD", price: 19000 },
};

function mockAdminForCheckout(plan: Record<string, unknown>) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const mockInsert = vi.fn((row: unknown) => {
    inserts.push(row);
    return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "order-test" }, error: null })) })) };
  });
  const mockUpdate = vi.fn((row: unknown) => {
    updates.push(row);
    return { eq: vi.fn(async () => ({ error: null })) };
  });
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "orders") return { insert: mockInsert, update: mockUpdate } as never;
    if (table === "plans") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: plan, error: null })),
            single: vi.fn(async () => ({ data: plan, error: null })),
          })),
        })),
      } as never;
    }
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
  });
  return { inserts, updates, mockInsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  productOverride = null;
  orgRoleImpl = async (orgId: string) => ({
    user: { id: "user-1", email: "buyer@example.com" },
    membership: { id: "mem-1", organization_id: orgId, user_id: "user-1", role: "owner" },
    organization: { id: orgId, name: "Test Org", slug: "test-org", owner_id: "user-1" },
  });
  mockAdminRpc.mockResolvedValue({ data: { expires_at: "2026-11-18T00:00:00.000Z" }, error: null });
});

// ── India INR regression ─────────────────────────────────────────────
describe("dodo international V1 — India INR checkout (regression)", () => {
  it("sponsorship INR monthly: server snapshot, IN address, UPI+cards, INR product", async () => {
    const plan = planRow({});
    const { inserts } = mockAdminForCheckout(plan);
    const client = fakeDodoClient(INR_PRODUCTS);
    const result = await createCheckoutOrder({ planId: "plan-inr-m", organizationId: "org-a" }, { dodoClient: client });

    expect(result).toMatchObject({ orderId: "order-test", provider: "dodo", amountMinor: 149900, currency: "INR" });
    expect(inserts[0]).toMatchObject({
      amount_minor: 149900,
      currency: "INR",
      tool_id: SPONSOR_TOOL_ID,
      is_all_access: false,
      provider: "dodo",
    });
    const create = client.checkoutSessions.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: "pdt_test_sponsorship_tracking_monthly", quantity: 1 }],
        billing_address: { country: "IN" },
        billing_currency: "INR",
        metadata: expect.objectContaining({
          [DODO_METADATA_KEYS.orderId]: "order-test",
          [DODO_METADATA_KEYS.organizationId]: "org-a",
          [DODO_METADATA_KEYS.planSlug]: "sponsorship-tracking-monthly",
        }),
      })
    );
    expect((create.mock.calls[0]?.[0] as { allowed_payment_method_types: string[] }).allowed_payment_method_types).toEqual(
      expect.arrayContaining(["upi_collect", "upi_intent", "credit", "debit"])
    );
  });

  it("sponsorship INR yearly + prize-splitter monthly regression", async () => {
    mockAdminForCheckout(planRow({ id: "plan-inr-y", slug: "sponsorship-tracking-yearly", billing_period: "yearly", amount_minor: 1499000 }));
    const r1 = await createCheckoutOrder({ planId: "plan-inr-y", organizationId: "org-a" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) });
    expect(r1).toMatchObject({ amountMinor: 1499000, currency: "INR" });

    mockAdminForCheckout(
      planRow({ id: "plan-prize-m", slug: "prize-pool-splitter-monthly", tool_id: "tool-prize", billing_period: "monthly", amount_minor: 69900 })
    );
    const r2 = await createCheckoutOrder({ planId: "plan-prize-m", organizationId: "org-a" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) });
    expect(r2).toMatchObject({ amountMinor: 69900, currency: "INR" });
  });
});

// ── International USD ────────────────────────────────────────────────
describe("dodo international V1 — USD sponsorship checkout", () => {
  it("USD monthly: correct product, currency, amount; no forced IN address; cards only", async () => {
    const plan = planRow({
      id: "plan-usd-m",
      slug: "sponsorship-tracking-monthly-usd",
      billing_period: "monthly",
      amount_minor: 1900,
      currency: "USD",
    });
    const { inserts } = mockAdminForCheckout(plan);
    const client = fakeDodoClient({ ...INR_PRODUCTS, ...USD_PRODUCTS });
    const result = await createCheckoutOrder({ planId: "plan-usd-m", organizationId: "org-a" }, { dodoClient: client });

    expect(result).toMatchObject({ amountMinor: 1900, currency: "USD", provider: "dodo" });
    expect(inserts[0]).toMatchObject({
      amount_minor: 1900,
      currency: "USD",
      tool_id: SPONSOR_TOOL_ID,
      is_all_access: false,
      provider: "dodo",
    });
    const create = client.checkoutSessions.create as ReturnType<typeof vi.fn>;
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params.product_cart).toEqual([{ product_id: "pdt_test_sponsorship_tracking_monthly_usd", quantity: 1 }]);
    expect(params.billing_currency).toBe("USD");
    expect(params).not.toHaveProperty("billing_address");
    const methods = params.allowed_payment_method_types as string[];
    expect(methods).toContain("credit");
    expect(methods).toContain("debit");
    expect(methods).not.toContain("upi_collect");
    expect(methods).not.toContain("upi_intent");
  });

  it("USD yearly: correct product + entitlement stays sponsor-sentinel (never All Access)", async () => {
    const plan = planRow({
      id: "plan-usd-y",
      slug: "sponsorship-tracking-yearly-usd",
      billing_period: "yearly",
      amount_minor: 19000,
      currency: "USD",
    });
    const { inserts } = mockAdminForCheckout(plan);
    const client = fakeDodoClient({ ...INR_PRODUCTS, ...USD_PRODUCTS });
    const result = await createCheckoutOrder({ planId: "plan-usd-y", organizationId: "org-a" }, { dodoClient: client });
    expect(result).toMatchObject({ amountMinor: 19000, currency: "USD" });
    expect(inserts[0]).toMatchObject({ tool_id: SPONSOR_TOOL_ID, is_all_access: false, currency: "USD" });
  });

  it("rejects All Access USD (V1 international is Sponsorship Tracking only)", async () => {
    const plan = planRow({ id: "plan-aa-usd", slug: "all-access-monthly-usd", tool_id: null, billing_period: "monthly", amount_minor: 4999, currency: "USD" });
    const { mockInsert } = mockAdminForCheckout(plan);
    await expect(
      createCheckoutOrder({ planId: "plan-aa-usd", organizationId: "org-a" }, { dodoClient: fakeDodoClient(USD_PRODUCTS) })
    ).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── Negative / attack cases ──────────────────────────────────────────
describe("dodo international V1 — fail-closed attacks", () => {
  it("client amount/currency/product/country fields cannot change the price (plan is authoritative)", async () => {
    const plan = planRow({});
    mockAdminForCheckout(plan);
    const client = fakeDodoClient(INR_PRODUCTS);
    // Attacker smuggles pricing fields — CheckoutInput ignores them entirely.
    const result = await createCheckoutOrder(
      { planId: "plan-inr-m", organizationId: "org-a", amountMinor: 1, currency: "USD", productId: "pdt_evil", country: "US" } as unknown as {
        planId: string;
        organizationId: string;
      },
      { dodoClient: client }
    );
    expect(result).toMatchObject({ amountMinor: 149900, currency: "INR" });
    const create = client.checkoutSessions.create as ReturnType<typeof vi.fn>;
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params.product_cart).toEqual([{ product_id: "pdt_test_sponsorship_tracking_monthly", quantity: 1 }]);
    expect(params.billing_currency).toBe("INR");
  });

  it("USD plan with INR product fails closed (no order created)", async () => {
    const plan = planRow({
      id: "plan-usd-m",
      slug: "sponsorship-tracking-monthly-usd",
      amount_minor: 1900,
      currency: "USD",
    });
    const { mockInsert } = mockAdminForCheckout(plan);
    // Mapping returns a product whose authoritative Dodo price is INR.
    productOverride = () => "pdt_test_sponsorship_tracking_monthly";
    await expect(
      createCheckoutOrder({ planId: "plan-usd-m", organizationId: "org-a" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) })
    ).rejects.toThrow("Payment not configured for this plan");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("INR plan with USD product fails closed (no order created)", async () => {
    const plan = planRow({});
    const { mockInsert } = mockAdminForCheckout(plan);
    productOverride = () => "pdt_test_sponsorship_tracking_monthly_usd";
    await expect(
      createCheckoutOrder({ planId: "plan-inr-m", organizationId: "org-a" }, { dodoClient: fakeDodoClient(USD_PRODUCTS) })
    ).rejects.toThrow("Payment not configured for this plan");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("unconfigured product mapping fails closed before any order", async () => {
    const plan = planRow({});
    const { mockInsert } = mockAdminForCheckout(plan);
    productOverride = () => null;
    await expect(
      createCheckoutOrder({ planId: "plan-inr-m", organizationId: "org-a" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) })
    ).rejects.toThrow("Payment not configured for this plan");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("cross-organization checkout is rejected (no order)", async () => {
    orgRoleImpl = async () => {
      throw Object.assign(new Error("not member"), { code: "FORBIDDEN", status: 403 });
    };
    const { mockInsert } = mockAdminForCheckout(planRow({}));
    await expect(
      createCheckoutOrder({ planId: "plan-inr-m", organizationId: "org-evil" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) })
    ).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("member role cannot checkout (owner/admin only)", async () => {
    orgRoleImpl = async () => {
      throw Object.assign(new Error("Requires role: owner | admin"), { code: "FORBIDDEN", status: 403 });
    };
    const { mockInsert } = mockAdminForCheckout(planRow({}));
    await expect(
      createCheckoutOrder({ planId: "plan-inr-m", organizationId: "org-a" }, { dodoClient: fakeDodoClient(INR_PRODUCTS) })
    ).rejects.toThrow(/owner | admin/);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── catalog isolation ────────────────────────────────────────────────
describe("dodo international V1 — USD plans never duplicate INR offers", () => {
  it("availableToAdd shows INR prices only when both INR and USD plans exist", async () => {
    const { buildBillingToolSections } = await import("@/server/services/billing-service");
    const sponsorToolId = "tool-sponsor-id";
    const plans: Array<{
      id: string;
      tool_id: string | null;
      billing_period: "monthly" | "yearly";
      amount_minor: number;
      currency: "INR" | "USD";
      is_active: boolean;
    }> = [
      { id: "p-inr-m", tool_id: sponsorToolId, billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true },
      { id: "p-inr-y", tool_id: sponsorToolId, billing_period: "yearly", amount_minor: 1499000, currency: "INR", is_active: true },
      { id: "p-usd-m", tool_id: sponsorToolId, billing_period: "monthly", amount_minor: 1900, currency: "USD", is_active: true },
      { id: "p-usd-y", tool_id: sponsorToolId, billing_period: "yearly", amount_minor: 19000, currency: "USD", is_active: true },
    ];
    const { availableToAdd } = buildBillingToolSections({
      entitlements: [],
      plans,
      tools: [
        { id: sponsorToolId, slug: "sponsor-sentinel", is_active: true },
        { id: "tool-prize-id", slug: "prize-splitter", is_active: true },
      ],
    });
    const card = availableToAdd.find((c) => c.toolSlug === "sponsor-sentinel");
    expect(card).toBeDefined();
    expect(card?.monthly).toMatchObject({ planId: "p-inr-m", amountMinor: 149900, currency: "INR" });
    expect(card?.yearly).toMatchObject({ planId: "p-inr-y", amountMinor: 1499000, currency: "INR" });
    // V1 USD offers: server-resolved, Sponsorship Tracking only.
    expect(card?.usdMonthly).toMatchObject({ planId: "p-usd-m", amountMinor: 1900, currency: "USD" });
    expect(card?.usdYearly).toMatchObject({ planId: "p-usd-y", amountMinor: 19000, currency: "USD" });
  });

  it("never surfaces USD offers for out-of-scope tools (sponsor gate)", async () => {
    const { buildBillingToolSections } = await import("@/server/services/billing-service");
    const { availableToAdd } = buildBillingToolSections({
      entitlements: [],
      plans: [
        { id: "p-prize-inr", tool_id: "tool-prize-id", billing_period: "monthly", amount_minor: 69900, currency: "INR", is_active: true },
        // Hypothetical USD row for another tool (migration scope guard forbids
        // this in production) must still never produce a USD offer.
        { id: "p-prize-usd", tool_id: "tool-prize-id", billing_period: "monthly", amount_minor: 999, currency: "USD", is_active: true },
      ],
      tools: [{ id: "tool-prize-id", slug: "prize-splitter", is_active: true }],
    });
    const card = availableToAdd.find((c) => c.toolSlug === "prize-splitter");
    expect(card).toBeDefined();
    expect(card?.monthly).toMatchObject({ amountMinor: 69900, currency: "INR" });
    expect(card?.usdMonthly).toBeNull();
    expect(card?.usdYearly).toBeNull();
  });
});

// ── webhook matrix ───────────────────────────────────────────────────
// Route-level fulfillment (USD success, cross-currency, wrong product,
// cross-org, duplicates, replays, forgeries, terminal events, unsupported
// subscription events) is covered in
// src/app/api/webhooks/dodo/route.usd.test.ts with isolated route doubles.

