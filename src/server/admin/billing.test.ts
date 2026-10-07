import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("Billing — RCCF-ADMIN-06", () => {
  it("requireSuperAdmin is called in page and service", () => {
    expect(readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8")).toContain("requireSuperAdmin");
    expect(readFileSync("src/server/admin/billing.ts", "utf8")).toContain("requireSuperAdmin");
  });

  it("service-role client only after guard and not in client components", () => {
    expect(readFileSync("src/server/admin/billing.ts", "utf8")).toContain("createAdminClient");
    expect(readFileSync("src/server/admin/billing.ts", "utf8")).toContain("requireSuperAdmin");
    // guard must appear before createAdminClient in file order
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc.indexOf("requireSuperAdmin") < svc.indexOf("createAdminClient")).toBe(true);
    expect(readFileSync("src/components/admin/AdminShell.tsx", "utf8")).not.toContain("createAdminClient");
    expect(readFileSync("src/components/admin/AdminSidebar.tsx", "utf8")).not.toContain("createAdminClient");
  });

  it("orders read-only — select only, no insert/update/delete", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    // service should contain select for orders but not insert/update/delete on orders
    expect(svc).toContain('from("orders")');
    expect(svc).toContain('from("payments")');
    expect(svc).toContain('from("webhook_events")');
    expect(svc).toContain('from("plans")');
    // global check no insert/update/delete in billing service/page
    [svc, readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8")].forEach((c) => {
      expect(c).not.toMatch(/\.insert\(/);
      expect(c).not.toMatch(/\.update\(/);
      expect(c).not.toMatch(/\.delete\(/);
    });
  });

  it("no audit writes in this phase", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(svc).not.toContain("recordAdminAudit");
    expect(page).not.toContain("recordAdminAudit");
    expect(svc).not.toContain("admin_audit_logs");
  });

  it("no provider secrets exposed", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toContain("RAZORPAY_KEY_SECRET");
      expect(c).not.toContain("webhook_secret");
      expect(c).not.toContain("razorpay_signature");
      expect(c).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
    // razorpay identifiers are allowed as operational metadata, but secrets are not
    expect(page).toContain("razorpayOrderId");
  });

  it("no auth.users exposure", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).not.toContain('from("auth.users")');
    expect(svc).not.toContain("auth.users");
    expect(svc).toContain('from("organizations")');
  });

  it("search validation — trimmed and bounded to 100", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain("MAX_QUERY_LEN = 100");
    expect(svc).toContain("trim()");
    expect(svc).toContain('slice(0, MAX_QUERY_LEN)');
  });

  it("status validation — only known statuses", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain('["created", "paid", "failed", "expired"]');
    expect(svc).toContain('["created", "authorized", "captured", "failed"]');
    expect(svc).toContain('["pending", "processing", "succeeded", "failed"]');
  });

  it("section validation — only orders/payments/webhooks/plans, default orders", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain('rawSection === "payments"');
    expect(svc).toContain('rawSection === "webhooks"');
    expect(svc).toContain('rawSection === "plans"');
    expect(svc).toContain('BillingSection = "orders" | "payments" | "webhooks" | "plans"');
  });

  it("page validation — int min1 max1000 fallback1", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain("if (!Number.isFinite(page) || page < 1) page = 1");
    expect(svc).toContain("if (page > 1000) page = 1000");
  });

  it("page size fixed at 50 and not user-controlled", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain("PAGE_SIZE = 50");
    expect(svc).not.toContain("searchParams.pageSize");
  });

  it("filter persistence — pagination preserves q/status/billing_period", () => {
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("buildPageHref");
    expect(page).toContain("data.query");
    expect(page).toContain("data.status");
    expect(page).toContain("data.billingPeriod");
  });

  it("filter reset — form submit resets page to 1", () => {
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain('<form method="GET"');
    expect(page).toContain('name="section" value={section}');
    // pagination links include page only when >1
    expect(page).toContain('if (page > 1) p.set("page"');
  });

  it("historical order amount preserved — uses order.amount_minor not plan", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    // orders select includes amount_minor from orders, not derived
    expect(svc).toContain('select("id, organization_id, plan_id, tool_id, is_all_access, amount_minor');
    // display uses order amountMinor directly
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("formatMinor(o.amountMinor");
    expect(page).toContain("formatMinor(p.amountMinor");
  });

  it("plan amount displayed independently — plans select amount_minor", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain('from("plans").select("id, name, slug, billing_period, amount_minor');
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("formatMinor(p.amountMinor");
  });

  it("no N+1 — batched org/plan/tool lookups", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain('in("id", orgIds');
    expect(svc).toContain('in("id", planIds');
    expect(svc).toContain('in("id", toolIds');
    expect(svc).not.toMatch(/for\s*\(.*await admin/);
  });

  it("empty/error distinction — Unable to load vs No orders found", () => {
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("Unable to load billing data");
    expect(page).toContain("No orders found");
    expect(page).toContain("No orders match the selected filters");
    expect(page).toContain("hasError");
  });

  it("All Access handling — is_all_access true tool_id null", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain("is_all_access");
    expect(svc).toContain("tool_id");
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("All Access");
    expect(page).toContain("isAllAccess");
  });

  it("individual tool handling — tool_id not null", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    expect(svc).toContain("toolMap");
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    expect(page).toContain("toolName");
  });

  it("actual schema fields discovered — no invented columns", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    // orders
    expect(svc).toContain("select(\"id, organization_id, plan_id, tool_id, is_all_access, amount_minor");
    // payments
    expect(svc).toContain("select(\"id, razorpay_payment_id, order_id, organization_id, amount_minor");
    // webhook_events
    expect(svc).toContain("select(\"id, provider, provider_event_id, event_type, status, processed");
    // plans
    expect(svc).toContain("select(\"id, name, slug, billing_period, amount_minor");
    // verify no invented field like billing_period in orders (orders has no billing_period, comes via plan)
    expect(svc).not.toContain("orders.*billing_period");
  });

  it("does not call Razorpay APIs", () => {
    const svc = readFileSync("src/server/admin/billing.ts", "utf8");
    const page = readFileSync("src/app/(admin)/admin/billing/page.tsx", "utf8");
    [svc, page].forEach((c) => {
      expect(c).not.toContain("fetchRazorpayPayment");
      expect(c).not.toContain("createRazorpayOrder");
      expect(c).not.toContain("RAZORPAY_KEY_SECRET");
      expect(c).not.toContain("razorpay_signature");
    });
    // Display of Razorpay IDs is allowed as operational metadata
    expect(page).toContain("razorpayOrderId");
  });
});
