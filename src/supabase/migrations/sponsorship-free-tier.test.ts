import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251023000001_sponsorship_free_tier.sql"),
  "utf8"
);

// Statements only (strip -- comments) so prose cannot satisfy assertions.
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("free-tier entitlement migration — RCCF free-tier IMPLEMENT-03", () => {
  it("allows source='free' on user_tool_entitlements without touching paid values", () => {
    expect(code).toMatch(/alter table public\.user_tool_entitlements/i);
    expect(code).toMatch(/check \(source in \('subscription', 'manual', 'promo', 'free'\)\)/i);
    // Paid sources preserved in the constraint.
    for (const s of ["subscription", "manual", "promo"]) expect(code).toContain(`'${s}'`);
  });

  it("does not create org-level free, plans, orders, or RLS changes", () => {
    expect(code).not.toMatch(/alter table public\.tool_entitlements/i);
    expect(code).not.toMatch(/insert into public\.plans/i);
    expect(code).not.toMatch(/alter table public\.plans/i);
    expect(code).not.toMatch(/alter table public\.orders/i);
    // amount_minor appears only in the preserved RPC signature/plumbing —
    // no CHECK is relaxed and no zero-price path is added.
    expect(code).not.toMatch(/check \(amount_minor/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/creator|agency/i);
    expect(code).not.toMatch(/delete from/i);
  });

  it("paid purchase transitions source free → subscription, never duplicates", () => {
    expect(code).toMatch(/complete_billing_payment/);
    expect(code).toMatch(/on conflict \(user_id, tool_id\) do update/i);
    expect(code).toMatch(/when public\.user_tool_entitlements\.source = 'free' then 'subscription'/i);
    // Lifetime grants still never shortened.
    expect(code).toMatch(/when public\.user_tool_entitlements\.expires_at is null then null else excluded\.expires_at/i);
  });

  it("keeps sponsor fence + service_role-only execution", () => {
    expect(code).toMatch(/where slug = 'sponsor-sentinel'/i);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/grant execute on function public\.complete_billing_payment/i);
    expect(code).toMatch(/to service_role/i);
  });

  it("entitlement source type includes free", () => {
    const types = readFileSync(join(process.cwd(), "src/types/database.ts"), "utf8");
    expect(types).toMatch(/export type EntitlementSource = .*free/);
  });
});
