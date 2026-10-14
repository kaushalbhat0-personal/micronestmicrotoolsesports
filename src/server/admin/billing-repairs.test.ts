import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/server/admin/audit", () => ({
  recordAdminAudit: vi.fn(async () => ({ id: "audit-1" })),
}));

const PAY_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ORG = "44444444-4444-4444-8444-444444444444";

function payRow(over: Record<string, unknown> = {}) {
  return {
    id: PAY_ID,
    order_id: ORDER_ID,
    organization_id: ORG_ID,
    amount_minor: 99900,
    currency: "INR",
    status: "captured",
    razorpay_payment_id: "pay_test_1",
    ...over,
  };
}

function orderRow(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    organization_id: ORG_ID,
    plan_id: "55555555-5555-4555-8555-555555555555",
    status: "created",
    amount_minor: 99900,
    currency: "INR",
    ...over,
  };
}

// Minimal thenable query-chain mock: every link returns the chain, terminal
// methods resolve from a per-table handler.
function chain(terminal: Record<string, (...args: unknown[]) => unknown>) {
  const c: Record<string, unknown> = {};
  for (const k of ["select", "eq", "in", "lt", "order", "limit", "update", "insert"]) {
    c[k] = vi.fn(() => c);
  }
  Object.assign(c, terminal);
  return c;
}

function buildAdmin(opts: {
  payment?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  afterOrder?: Record<string, unknown> | null;
  afterPayment?: Record<string, unknown> | null;
  rpcError?: { message: string } | null;
  updateResult?: Array<{ id: string }>;
  rereadStatus?: string | null;
  entitlement?: Record<string, unknown> | null;
  onInsert?: (table: string) => void;
}) {
  let orderReads = 0;
  const rpc = vi.fn(async () => (opts.rpcError ? { data: null, error: opts.rpcError } : { data: { order_status: "paid" }, error: null }));
  const admin = {
    rpc,
    from: vi.fn((table: string) => {
      if (table === "payments") {
        return chain({
          maybeSingle: async () => {
            if (orderReads > 0 && opts.afterPayment !== undefined) return { data: opts.afterPayment, error: null };
            return { data: opts.payment ?? null, error: null };
          },
          single: async () => ({ data: opts.payment ?? null, error: null }),
          insert: (v: unknown) => {
            opts.onInsert?.(table);
            return { select: () => ({ single: async () => ({ data: v, error: null }) }) };
          },
        });
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: async () => ({ data: null, error: null }) })),
              maybeSingle: async () => {
                orderReads += 1;
                // First read = pre-check, subsequent reads = post-condition re-read
                if (orderReads > 1 && opts.afterOrder !== undefined) return { data: opts.afterOrder, error: null };
                if (orderReads > 1 && opts.rereadStatus !== undefined) {
                  return {
                    data: opts.rereadStatus === null ? null : { ...(opts.order ?? orderRow()), status: opts.rereadStatus },
                    error: null,
                  };
                }
                return { data: opts.order ?? null, error: null };
              },
              single: async () => ({ data: opts.order ?? null, error: null }),
            })),
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(async () => ({ data: opts.updateResult ?? [{ id: ORDER_ID }], error: null })),
              })),
              select: vi.fn(async () => ({ data: opts.updateResult ?? [{ id: ORDER_ID }], error: null })),
            })),
          })),
        };
      }
      if (table === "tool_entitlements") {
        return chain({
          maybeSingle: async () => ({ data: opts.entitlement ?? { expires_at: "2026-12-01T00:00:00.000Z" }, error: null }),
        });
      }
      return chain({ maybeSingle: async () => ({ data: null, error: null }) });
    }),
  };
  return { admin, rpc };
}

async function mockedAdmin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return vi.mocked(createAdminClient);
}

async function mockedAudit() {
  const { recordAdminAudit } = await import("@/server/admin/audit");
  return vi.mocked(recordAdminAudit);
}

describe("Billing exceptions + repairs — RCCF-SUPERADMIN-V1-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("detection covers all four exception states, bounded", () => {
    const svc = readFileSync("src/server/admin/billing-exceptions.ts", "utf8");
    expect(svc).toContain("requireSuperAdmin");
    expect(svc).toContain("getBillingExceptions");
    expect(svc).toContain("stuckOrders");
    expect(svc).toContain("replayCandidates");
    expect(svc).toContain("orphanWebhooks");
    expect(svc).toContain("amountMismatches");
    expect(svc).toContain("LIMIT = 50");
    expect(svc).not.toContain("razorpay_signature");
    expect(svc).not.toContain("payload");
  });

  it("exactly three mutations exist — no generic editors", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("expireStuckOrder");
    expect(svc).toContain("replayPaymentCompletion");
    expect(svc).toContain("revokeFreeGrant");
    expect(svc).toContain("recordAdminAudit");
    expect(svc).toContain("billing.order_expire");
    expect(svc).toContain("billing.payment_completion_replay");
    expect(svc).toContain("entitlement.free_revoke");
    expect(svc).not.toMatch(/deleteEntitlement/);
    expect(svc).not.toMatch(/updatePlan/);
    expect(svc).not.toMatch(/refund/);
  });

  it("F-01: replay uses the dedicated repair RPC, never the canonical insert path", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("repair_billing_completion");
    // the canonical insert path cannot repair (idempotent no-op on existing
    // payments) — it must not be invoked for replay
    expect(svc).not.toMatch(/rpc\("complete_billing_payment"/);
    expect(svc).not.toMatch(/from\("payments"\)[\s\S]{0,400}?\.insert\(/);
    // signature is never even loaded server-side anymore (RPC reads stored state)
    expect(svc).not.toContain("razorpay_signature");
    expect(svc).toContain("amount mismatch");
    expect(svc).toContain("Linked order not found");
    expect(svc).toContain("not eligible for replay");
  });

  it("F-02 cross-org: payment/order organization mismatch is rejected", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("organization mismatch");
  });

  it("post-condition: audit is built from re-read state, never hardcoded paid", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("not found after repair");
    expect(svc).toContain("did not complete the order");
    // no hardcoded paid verdict in the after-state construction
    expect(svc).not.toMatch(/after = \{ orderStatus: "paid"/);
  });

  it("eligible payment/order completes truthfully via the repair RPC", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const recordAdminAudit = await mockedAudit();
    const inserted: string[] = [];
    const { admin, rpc } = buildAdmin({
      payment: payRow(),
      order: orderRow(),
      afterOrder: { ...orderRow(), tool_id: null, is_all_access: true, status: "paid" },
      afterPayment: { id: PAY_ID, status: "captured" },
      onInsert: (t) => inserted.push(t),
    });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await replayPaymentCompletion(PAY_ID, "verified captured, order stuck created", true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("repair_billing_completion", { p_payment_id: PAY_ID });
    expect(inserted).not.toContain("payments");
    expect(res.mutated).toBe(true);
    if (!res.mutated) throw new Error("expected mutation");
    expect(res.idempotent).toBe(false);
    // post-condition reflects the re-read DB state
    expect(res.after.orderStatus).toBe("paid");
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
    const auditArg = recordAdminAudit.mock.calls[0]?.[0] as unknown as { before: { orderStatus: string }; after: { orderStatus: string } };
    expect(auditArg.before.orderStatus).toBe("created");
    expect(auditArg.after.orderStatus).toBe("paid");
  });

  it("already-paid order is idempotent with no new audit", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const recordAdminAudit = await mockedAudit();
    const { admin, rpc } = buildAdmin({ payment: payRow(), order: orderRow({ status: "paid" }) });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await replayPaymentCompletion(PAY_ID, "already paid replay attempt", true);
    expect(res.mutated).toBe(true);
    if (!res.mutated) throw new Error("expected mutation");
    expect(res.idempotent).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("payment/order org mismatch is rejected before any RPC", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const { admin, rpc } = buildAdmin({ payment: payRow(), order: orderRow({ organization_id: OTHER_ORG }) });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    await expect(replayPaymentCompletion(PAY_ID, "cross-org attempt here", true)).rejects.toThrow(/organization mismatch/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("amount and currency mismatches are rejected before any RPC", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const adminMock = await mockedAdmin();
    const a = buildAdmin({ payment: payRow({ amount_minor: 100 }), order: orderRow({ amount_minor: 200 }) });
    adminMock.mockReturnValueOnce(a.admin as never);
    await expect(replayPaymentCompletion(PAY_ID, "amount mismatch review", true)).rejects.toThrow(/amount mismatch/);
    expect(a.rpc).not.toHaveBeenCalled();

    const b = buildAdmin({ payment: payRow({ currency: "USD" }), order: orderRow({ currency: "INR" }) });
    adminMock.mockReturnValueOnce(b.admin as never);
    await expect(replayPaymentCompletion(PAY_ID, "currency mismatch rev", true)).rejects.toThrow(/amount mismatch/);
    expect(b.rpc).not.toHaveBeenCalled();
  });

  it("missing payment row is handled truthfully", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const { admin } = buildAdmin({ payment: null, order: orderRow() });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    await expect(replayPaymentCompletion(PAY_ID, "missing payment review", true)).rejects.toThrow(/Payment not found/);
  });

  it("RPC no-op cannot produce a false paid audit — actual state is audited", async () => {
    const { replayPaymentCompletion } = await import("./billing-repairs");
    const recordAdminAudit = await mockedAudit();
    // RPC reports success but the re-read shows the order is still created
    const { admin } = buildAdmin({
      payment: payRow(),
      order: orderRow(),
      afterOrder: { ...orderRow(), tool_id: null, is_all_access: true, status: "created" },
      afterPayment: { id: PAY_ID, status: "captured" },
    });
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    await expect(replayPaymentCompletion(PAY_ID, "stale rpc no-op review", true)).rejects.toThrow(/did not complete the order/);
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
    const auditArg = recordAdminAudit.mock.calls[0]?.[0] as unknown as { after: { orderStatus: string } };
    // truthful: the unchanged state, never "paid"
    expect(auditArg.after.orderStatus).toBe("created");
  });

  it("expire guards: only created → expired, idempotent on expired", async () => {
    const { expireStuckOrder } = await import("./billing-repairs");
    const adminMock = await mockedAdmin();
    const recordAdminAudit = await mockedAudit();

    adminMock.mockReturnValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: ORDER_ID, organization_id: ORG_ID, status: "paid", amount_minor: 100, currency: "INR", razorpay_order_id: null, created_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
      }),
    } as never);
    await expect(expireStuckOrder(ORDER_ID, "test reason here", true)).rejects.toThrow(/not eligible/);

    recordAdminAudit.mockClear();
    adminMock.mockReturnValueOnce({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: ORDER_ID, organization_id: ORG_ID, status: "expired", amount_minor: 100, currency: "INR", razorpay_order_id: null, created_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
      }),
    } as never);
    const res = await expireStuckOrder(ORDER_ID, "test reason here", true);
    expect(res.mutated).toBe(true);
    if (res.mutated) expect(res.idempotent).toBe(true);
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("expire success audits the actual change", async () => {
    const { expireStuckOrder } = await import("./billing-repairs");
    const adminMock = await mockedAdmin();
    const recordAdminAudit = await mockedAudit();
    recordAdminAudit.mockClear();
    const { admin } = buildAdmin({
      order: { ...orderRow(), razorpay_order_id: null, created_at: new Date().toISOString() },
      updateResult: [{ id: ORDER_ID }],
    });
    adminMock.mockReturnValueOnce(admin as never);
    const res = await expireStuckOrder(ORDER_ID, "stuck order cleanup here", true);
    expect(res.mutated).toBe(true);
    if (!res.mutated) throw new Error("expected mutation");
    expect(res.idempotent).toBe(false);
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
    const auditArg = recordAdminAudit.mock.calls[0]?.[0] as unknown as { before: { status: string }; after: { status: string } };
    expect(auditArg.before.status).toBe("created");
    expect(auditArg.after.status).toBe("expired");
  });

  it("F-06: concurrent expiry audits only once — loser re-reads truthfully", async () => {
    const { expireStuckOrder } = await import("./billing-repairs");
    const adminMock = await mockedAdmin();
    const recordAdminAudit = await mockedAudit();
    recordAdminAudit.mockClear();
    // pre-read says created, but OUR update changes 0 rows (lost the race),
    // and the re-read shows expired → idempotent, no second audit
    let reads = 0;
    adminMock.mockReturnValueOnce({
      from: (table: string) => {
        if (table !== "orders") return {};
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                reads += 1;
                const status = reads === 1 ? "created" : "expired";
                return {
                  data: { id: ORDER_ID, organization_id: ORG_ID, status, amount_minor: 100, currency: "INR", razorpay_order_id: null, created_at: new Date().toISOString() },
                  error: null,
                };
              },
            }),
          }),
          update: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) }),
        };
      },
    } as never);
    const res = await expireStuckOrder(ORDER_ID, "concurrent expiry review", true);
    expect(res.mutated).toBe(true);
    if (res.mutated) expect(res.idempotent).toBe(true);
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("free revoke guards: only free org grants of released tools", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("source");
    expect(svc).toContain("is_all_access");
    expect(svc).toContain("SIX_TOOL_SLUGS");
    expect(svc).toContain("User-scoped grants cannot be revoked");
    expect(svc).toContain("All Access grants cannot be revoked");
    expect(svc).toContain("already expired");
    expect(svc).not.toMatch(/\.delete\(\)/);
    expect(svc).toContain("expires_at");
  });

  it("mutations require reason and confirmation, secrets stay out of audits", () => {
    const svc = readFileSync("src/server/admin/billing-repairs.ts", "utf8");
    expect(svc).toContain("requireReason");
    expect(svc).toContain("confirmed");
    expect(svc).toContain("preview");
    expect(svc).toContain("before = { orderStatus");
    // 4 audit sites: expire, replay success, replay truthful-failure, free revoke
    const auditBlocks = [...svc.matchAll(/recordAdminAudit\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
    expect(auditBlocks.length).toBe(4);
    for (const block of auditBlocks) {
      expect(block).not.toMatch(/signature/i);
      expect(block).not.toMatch(/secret/i);
      expect(block).not.toMatch(/payload/i);
    }
  });
});
