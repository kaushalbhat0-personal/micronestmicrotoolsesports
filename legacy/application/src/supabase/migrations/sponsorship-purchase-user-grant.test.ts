import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251022000001_sponsorship_purchase_user_grant.sql"),
  "utf8"
);

// Statements only (strip -- comments) so prose cannot satisfy assertions.
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("phase 4 purchase user-grant migration — RCCF-MULTI-SCOPE-IMPLEMENT-04", () => {
  it("adds nullable buyer attribution without backfill or rewrite", () => {
    expect(code).toMatch(/add column if not exists buyer_user_id uuid/i);
    expect(code).toMatch(/references public\.profiles\(id\) on delete set null/i);
    // Nullable by default (no NOT NULL) — historical rows stay valid.
    expect(code).not.toMatch(/buyer_user_id uuid not null/i);
    // No backfill guessing, no buyer rewrite (the paid-status update is pre-existing behavior).
    expect(code).not.toMatch(/update public\.orders set[^;]*buyer_user_id/i);
    expect(code).not.toMatch(/where buyer_user_id is null/i);
  });

  it("creates no buyer index (not justified — issuance reads the locked order row)", () => {
    expect(code).not.toMatch(/create index.*buyer_user_id/i);
  });

  it("mirrors sponsor purchases to the buyer grant with the SAME expiry value", () => {
    expect(code).toMatch(/complete_billing_payment/);
    // Same variable feeds both rows — no second expiry calculation.
    expect(code).toMatch(/v_new_expires_at/);
    expect(code).toMatch(/insert into public\.user_tool_entitlements \(user_id, tool_id, source, expires_at\)/i);
    expect(code).toMatch(/values \(v_order\.buyer_user_id, v_tool_id, 'subscription', v_new_expires_at\)/i);
  });

  it("hard-fences issuance to sponsor-sentinel", () => {
    expect(code).toMatch(/where slug = 'sponsor-sentinel'/i);
    expect(code).toMatch(/if not v_is_all_access and v_tool_id is not null and v_order\.buyer_user_id is not null/i);
    expect(code).toMatch(/if found and v_tool_id = v_sponsor_tool_id/i);
  });

  it("skips historical NULL-buyer orders and guards missing org rows", () => {
    expect(code).toMatch(/v_order\.buyer_user_id is not null/i);
    // Replay path never invents access when the org entitlement is absent.
    expect(code).toMatch(/perform 1 from public\.tool_entitlements/i);
  });

  it("is idempotent and never shortens lifetime grants", () => {
    expect(code).toMatch(/on conflict \(user_id, tool_id\) do update/i);
    expect(code).toMatch(/case when public\.user_tool_entitlements\.expires_at is null then null else excluded\.expires_at end/i);
  });

  it("preserves grandfathered rows (source/created_at untouched)", () => {
    // The only user-grant write sets expires_at; source stays as inserted.
    const writes = code.match(/do update set expires_at =/gi) ?? [];
    expect(writes.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/do update set [^=]*source/i);
    expect(code).not.toMatch(/do update set [^=]*created_at/i);
  });

  it("preserves locking, idempotency, and execution grants", () => {
    expect(code).toMatch(/for update/i);
    expect(code).toMatch(/razorpay_payment_id/);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/grant execute on function public\.complete_billing_payment/i);
    expect(code).toMatch(/to service_role/i);
  });

  it("touches no operational tools, all-access issuance, billing tables, or RLS", () => {
    for (const word of ["draft-ban", "tie-breaker", "prize-splitter", "creator", "agency", "entitlement_scope"]) {
      expect(code).not.toContain(word);
    }
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/alter table public\.tool_entitlements/i);
    expect(code).not.toMatch(/delete from/i);
    // buyer_user_id appears only on orders (single sanctioned location).
    expect(code).not.toMatch(/buyer_user_id.*tool_entitlements|user_tool_entitlements.*buyer/i);
  });

  it("keeps infinite-preservation semantics for org rows", () => {
    expect(code).toMatch(/if v_existing_ent\.expires_at is null then/i);
    expect(code).toMatch(/v_new_expires_at := null/i);
  });
});
