import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const billingMigration = join(process.cwd(), "supabase/migrations/20251007000001_billing_foundation.sql");
const sql = readFileSync(billingMigration, "utf8");

describe("billing foundation migration — schema", () => {
  it("creates plans, orders, payments", () => {
    expect(sql).toMatch(/create table if not exists public\.plans/);
    expect(sql).toMatch(/create table if not exists public\.orders/);
    expect(sql).toMatch(/create table if not exists public\.payments/);
  });

  it("plans has required columns and checks", () => {
    expect(sql).toMatch(/tool_id uuid references public\.tools\(id\) on delete cascade/);
    expect(sql).toMatch(/billing_period text not null check \(billing_period in \('monthly','yearly'\)\)/);
    expect(sql).toMatch(/amount_minor integer not null check \(amount_minor > 0\)/);
    expect(sql).toMatch(/currency text not null default 'INR' check \(currency = 'INR'\)/);
    expect(sql).toMatch(/is_active boolean not null default true/);
  });

  it("orders has snapshot price and is_all_access", () => {
    expect(sql).toMatch(/organization_id uuid not null references public\.organizations\(id\) on delete cascade/);
    expect(sql).toMatch(/plan_id uuid not null references public\.plans\(id\) on delete restrict/);
    expect(sql).toMatch(/tool_id uuid references public\.tools\(id\) on delete set null/);
    expect(sql).toMatch(/is_all_access boolean not null/);
    expect(sql).toMatch(/amount_minor integer not null/);
    expect(sql).toMatch(/status text not null default 'created' check \(status in \('created','paid','failed','expired'\)\)/);
    expect(sql).toMatch(/razorpay_order_id text unique/);
  });

  it("payments has Razorpay fields and captured state", () => {
    expect(sql).toMatch(/order_id uuid not null references public\.orders\(id\) on delete cascade/);
    expect(sql).toMatch(/razorpay_payment_id text unique/);
    expect(sql).toMatch(/razorpay_signature text/);
    expect(sql).toMatch(/status text not null default 'created' check \(status in \('created','authorized','captured','failed'\)\)/);
    expect(sql).toMatch(/verified_at timestamptz/);
  });

  it("plans has deterministic uniqueness for active tool+period", () => {
    expect(sql).toMatch(/plans_tool_period_active_unique/);
    expect(sql).toMatch(/plans_all_access_period_active_unique/);
    expect(sql).toMatch(/where is_active = true and tool_id is not null/);
    expect(sql).toMatch(/where is_active = true and tool_id is null/);
  });

  it("has indexes for query paths", () => {
    expect(sql).toMatch(/plans_slug_idx/);
    expect(sql).toMatch(/orders_org_idx/);
    expect(sql).toMatch(/orders_razorpay_order_unique/);
    expect(sql).toMatch(/payments_order_idx/);
    expect(sql).toMatch(/payments_razorpay_payment_unique/);
  });

  it("enables RLS on all three", () => {
    expect(sql).toMatch(/alter table public\.plans enable row level security/);
    expect(sql).toMatch(/alter table public\.orders enable row level security/);
    expect(sql).toMatch(/alter table public\.payments enable row level security/);
  });

  it("RLS uses is_org_member for tenant isolation, plans public read active only", () => {
    expect(sql).toMatch(/plans_select_active_anon/);
    expect(sql).toMatch(/plans_select_active_auth/);
    expect(sql).toMatch(/is_active = true/);
    expect(sql).toMatch(/orders_select_member/);
    expect(sql).toMatch(/is_org_member\(organization_id\)/);
    expect(sql).toMatch(/payments_select_member/);
    // No insert/update/delete for authenticated — only service_role
    expect(sql).not.toMatch(/orders_insert_member/);
    expect(sql).not.toMatch(/payments_insert_member/);
    expect(sql).not.toMatch(/plans_insert_member/);
  });

  it("orders has updated_at trigger via handle_updated_at", () => {
    expect(sql).toMatch(/orders_updated_at/);
    expect(sql).toMatch(/handle_updated_at/);
  });
});

describe("billing foundation — entitlement compatibility", () => {
  it("has_tool_access still supports expires_at for manual purchases", async () => {
    const rlsSql = readFileSync(join(process.cwd(), "supabase/migrations/20250930000002_rls.sql"), "utf8");
    expect(rlsSql).toMatch(/expires_at is null or expires_at > now\(\)/);
    expect(rlsSql).toMatch(/is_all_access = true/);
  });

  it("tool_entitlements still single source of truth, no new entitlement table", () => {
    expect(sql).not.toMatch(/create table.*tool_entitlements/);
    expect(sql).not.toMatch(/alter table public\.tool_entitlements/);
  });
});
