import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251021000001_sponsorship_auto_grant_removal_grandfathering.sql"),
  "utf8"
);

// Statements only (strip -- comments) so prose cannot satisfy assertions.
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("phase 3 grandfathering migration — RCCF-MULTI-SCOPE-IMPLEMENT-03", () => {
  it("rewrites the trigger WITHOUT the sponsor auto-grant, keeping membership", () => {
    expect(code).toMatch(/create or replace function public\.handle_new_organization\(\)/i);
    expect(code).toMatch(/security definer set search_path = public/i);
    expect(code).toMatch(/insert into public\.organization_members[\s\S]*?new\.owner_id[\s\S]*?'owner'/i);
    expect(code).toMatch(/create trigger on_organization_created/i);
    // No surviving trigger path may auto-grant sponsor-sentinel on org creation.
    const fn = code.match(/create or replace function public\.handle_new_organization\(\)[\s\S]*?\$\$;/i)?.[0] ?? "";
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).not.toMatch(/tool_entitlements/);
    expect(fn).not.toMatch(/sponsor-sentinel/);
  });

  it("grandfather insert sources per-tool sponsor rows explicitly", () => {
    expect(code).toMatch(/t\.slug = 'sponsor-sentinel'/i);
  });

  it("grandfathers owners only — never ordinary members", () => {
    expect(code).toMatch(/insert into public\.user_tool_entitlements/i);
    expect(code).toMatch(/o\.owner_id/);
    expect(code).toMatch(/m\.role = 'owner'/i);
    expect(code).not.toMatch(/role = 'member'/i);
    expect(code).not.toMatch(/role = 'admin'/i);
  });

  it("copies expiry exactly with source manual, idempotent on the unique", () => {
    expect(code).toMatch(/te\.expires_at/);
    expect(code).toMatch(/'manual'/);
    expect(code).toMatch(/on conflict \(user_id, tool_id\) do nothing/i);
    // No invented durations, no expiry resets.
    expect(code).not.toMatch(/now\(\) \+/i);
    expect(code).not.toMatch(/interval/i);
  });

  it("sources only per-tool sponsor rows (all-access untouched)", () => {
    expect(code).toMatch(/te\.is_all_access = false/i);
  });

  it("is non-destructive: no deletes, no drops of data, no RLS changes", () => {
    expect(code).not.toMatch(/delete from/i);
    expect(code).not.toMatch(/drop table/i);
    expect(code).not.toMatch(/truncate/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/alter table/i);
  });

  it("touches no billing, orders, plans, or subscriptions", () => {
    for (const word of ["orders", "plans", "subscriptions", "razorpay", "checkout", "complete_billing_payment"]) {
      expect(code).not.toMatch(new RegExp(word, "i"));
    }
  });

  it("touches no operational tools and introduces no Creator/Agency/scope concepts", () => {
    for (const word of ["draft-ban", "tie-breaker", "prize-splitter", "all-access", "creator_id", "agency_id", "account_id"]) {
      expect(code).not.toContain(word);
    }
    expect(code).not.toMatch(/entitlement_scope/i);
  });

  it("touches no sponsorship data tables or campaign/channel tables", () => {
    for (const table of ["sponsor_campaigns", "deliverables", "evidence", "evaluations", "scans", "connected_channels", "webhook_events"]) {
      expect(code).not.toContain(table);
    }
  });

  it("joins profiles so no grant is invented for a missing user", () => {
    expect(code).toMatch(/join public\.profiles p on p\.id/i);
  });
});
