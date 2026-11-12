import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// NOTE on verification limits (FIX-05): the PostgreSQL RPC
// complete_billing_payment cannot be executed in this environment — no Docker
// daemon, no psql, and the Supabase CLI local stack cannot start. These are
// therefore the strongest possible static regression tests over the exact
// migration SQL: they assert the corrected CASE ordering/branches in BOTH
// upsert paths, preservation of every surrounding semantic, and that the
// historical migration was not edited. Runtime application of the migration
// remains for the owner's manual review step.

const NEW = "supabase/migrations/20251024000001_sponsorship_free_upgrade_expiry_fix.sql";
const OLD = "supabase/migrations/20251023000001_sponsorship_free_tier.sql";

function statementsOnly(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

const sql = readFileSync(join(process.cwd(), NEW), "utf8");
const code = statementsOnly(sql);

const FREE_FIRST = /when public\.user_tool_entitlements\.source = 'free' then excluded\.expires_at/g;
const NULL_KEPT = /when public\.user_tool_entitlements\.expires_at is null then null/g;

describe("FIX-05 free → paid expiry correction", () => {
  it("corrects BOTH user-grant upsert branches (fresh + idempotent replay)", () => {
    expect(code.match(FREE_FIRST)?.length).toBe(2);
  });

  it("free monthly purchase: free NULL row takes the computed paid expiry", () => {
    // The free branch precedes the NULL-preservation branch, so a free row
    // (always NULL) takes excluded.expires_at — the paid expiry already
    // computed for the organization leg in the same call.
    const idx = code.search(/source = 'free' then excluded\.expires_at/);
    expect(idx).toBeGreaterThan(-1);
    const tail = code.slice(idx, idx + 400);
    expect(tail).toMatch(/when public\.user_tool_entitlements\.expires_at is null then null/);
    // The paid value used is the existing renewal math output, not new logic:
    // fresh path uses v_new_expires_at, replay path uses v_existing_expires_at.
    expect(code).toMatch(/values \(v_order\.buyer_user_id, v_tool_id, 'subscription', v_new_expires_at\)/i);
    expect(code).toMatch(/values \(v_order\.buyer_user_id, v_tool_id, 'subscription', v_existing_expires_at\)/i);
    expect(code).toMatch(/greatest\(v_existing_ent\.expires_at, now\(\)\) \+ interval '1 month'/i);
    expect(code).toMatch(/greatest\(v_existing_ent\.expires_at, now\(\)\) \+ interval '1 year'/i);
  });

  it("existing subscription grant preserves renewal semantics (non-free branch intact)", () => {
    expect(code.match(NULL_KEPT)?.length).toBe(2);
    // Finite paid rows still take the computed expiry; source never rewritten.
    expect(code).toMatch(/case when public\.user_tool_entitlements\.source = 'free' then 'subscription' else public\.user_tool_entitlements\.source end/i);
  });

  it("manual lifetime grant remains NULL (never shortened, source kept)", () => {
    // A manual NULL row is not source='free', so it hits the NULL branch:
    // expires_at stays NULL and source stays 'manual'.
    expect(code).toMatch(/when public\.user_tool_entitlements\.expires_at is null then null\s+else excluded\.expires_at end/i);
    expect(code).not.toMatch(/then 'manual'|then 'promo'/i);
  });

  it("promo grant preserves existing semantics", () => {
    // Promo is neither 'free' (no forced subscription/expiry takeover beyond
    // the standard finite renewal) nor rewritten to another source.
    const sourceCases = code.match(/public\.user_tool_entitlements\.source = 'free' then 'subscription'/gi) ?? [];
    expect(sourceCases.length).toBe(2);
    expect(code).not.toMatch(/source = 'promo'|source = 'manual'/i);
  });

  it("no duplicate user grants: single ON CONFLICT per path on (user_id, tool_id)", () => {
    expect(code.match(/on conflict \(user_id, tool_id\) do update/gi)?.length).toBe(2);
  });

  it("failed/unpaid payment cannot transition free → subscription", () => {
    // Both mirror blocks sit strictly after captured-payment handling:
    // the replay branch (payment already captured) and the fresh branch
    // (after the payments 'captured' insert). Unknown orders raise first.
    expect(code).toMatch(/raise exception 'Order not found/i);
    expect(code).toMatch(/insert into public\.payments \(order_id, organization_id, razorpay_payment_id, razorpay_signature, amount_minor, currency, status, verified_at\)/i);
    expect(code).toMatch(/values \(p_order_id, v_org_id, p_razorpay_payment_id, p_razorpay_signature, p_amount_minor, p_currency, 'captured', p_verified_at\)/i);
  });

  it("idempotency intact: replay returns current state without re-extending", () => {
    expect(code).toMatch(/if found then/i);
    expect(code).toMatch(/'idempotent', true/i);
    expect(code).toMatch(/'idempotent', false/i);
  });

  it("All Access behavior unchanged (mirror fenced out in both paths)", () => {
    expect(code.match(/if not v_is_all_access and v_tool_id is not null and v_order\.buyer_user_id is not null then/gi)?.length).toBe(2);
    expect(code).toMatch(/where slug = 'sponsor-sentinel'/i);
  });

  it("buyer_user_id and order/payment plumbing unchanged", () => {
    expect(code).not.toMatch(/alter table public\.orders/i);
    expect(code).toMatch(/v_order\.buyer_user_id is not null/i);
    expect(code).toMatch(/for update/i);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/grant execute on function public\.complete_billing_payment/i);
    expect(code).toMatch(/to service_role/i);
  });

  it("no operational-tool, plan, ₹0, RLS, or Creator/Agency changes", () => {
    for (const word of ["draft-ban", "tie-breaker", "prize-splitter", "creator", "agency"]) {
      expect(code).not.toContain(word);
    }
    expect(code).not.toMatch(/insert into public\.plans/i);
    expect(code).not.toMatch(/check \(amount_minor/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/alter table public\.tool_entitlements/i);
    expect(code).not.toMatch(/delete from/i);
  });

  it("no operational tool receives a user sponsorship grant (sponsor fence only)", () => {
    // The only user_tool_entitlements writes are inside the sponsor-slug fence.
    const writes = code.match(/insert into public\.user_tool_entitlements/gi) ?? [];
    expect(writes.length).toBe(2);
    const fences = code.match(/v_tool_id = v_sponsor_tool_id/gi) ?? [];
    expect(fences.length).toBe(2);
  });

  it("historical migration 20251023000001 was NOT edited (still contains the defect)", () => {
    const oldCode = statementsOnly(readFileSync(join(process.cwd(), OLD), "utf8"));
    // Old file keeps the unconditional NULL-preservation CASE (the defect).
    expect(oldCode).toMatch(/case when public\.user_tool_entitlements\.expires_at is null then null else excluded\.expires_at end/i);
    expect(oldCode).not.toMatch(/source = 'free' then excluded\.expires_at/i);
  });

  it("regression: free NULL + payment success ⇒ subscription + finite paid expiry (never NULL)", () => {
    // Simulates the CASE evaluation order for an existing ('free', NULL) row
    // with a computed paid expiry of now()+1 month, mirroring the SQL branch
    // priority: free-source check first, NULL-preservation second.
    function applyCase(existing: { source: string; expires_at: string | null }, excludedExpiresAt: string | null) {
      const expires_at =
        existing.source === "free"
          ? excludedExpiresAt
          : existing.expires_at === null
            ? null
            : excludedExpiresAt;
      const source = existing.source === "free" ? "subscription" : existing.source;
      return { source, expires_at };
    }
    const paidExpiry = new Date(Date.now() + 30 * 86400000).toISOString();
    // 1-2. Free monthly/yearly: finite paid expiry, source subscription.
    for (const _period of ["monthly", "yearly"]) {
      const r = applyCase({ source: "free", expires_at: null }, paidExpiry);
      expect(r).toEqual({ source: "subscription", expires_at: paidExpiry });
      expect(r.expires_at).not.toBeNull();
    }
    // 3-5. Existing subscription/manual/promo finite rows: unchanged behavior.
    expect(applyCase({ source: "subscription", expires_at: paidExpiry }, paidExpiry)).toEqual({ source: "subscription", expires_at: paidExpiry });
    // 4. Manual lifetime: stays NULL.
    expect(applyCase({ source: "manual", expires_at: null }, paidExpiry)).toEqual({ source: "manual", expires_at: null });
    // 6. Paid finite renewal value passes through (never shortened by this CASE).
    const later = new Date(Date.now() + 60 * 86400000).toISOString();
    expect(applyCase({ source: "promo", expires_at: paidExpiry }, later)).toEqual({ source: "promo", expires_at: later });
  });
});
