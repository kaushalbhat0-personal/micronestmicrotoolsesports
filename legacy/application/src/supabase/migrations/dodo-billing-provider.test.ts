import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251118000001_dodo_billing_provider.sql"),
  "utf8",
);

/** Statements only (strip -- comments): assert on code, not prose. */
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("dodo billing provider migration", () => {
  it("adds a provider discriminator defaulting to razorpay (history preserved)", () => {
    expect(code).toMatch(/alter table public\.orders[\s\S]*?add column if not exists provider text not null default 'razorpay'/i);
    expect(code).toMatch(/constraint orders_provider_check check \(provider in \('razorpay', 'dodo'\)\)/i);
  });

  it("adds dodo reference columns with partial uniques", () => {
    expect(code).toMatch(/alter table public\.orders[\s\S]*?add column if not exists dodo_session_id text/i);
    expect(code).toMatch(/constraint orders_dodo_session_unique unique \(dodo_session_id\)/i);
    expect(code).toMatch(/alter table public\.payments[\s\S]*?add column if not exists dodo_payment_id text/i);
    expect(code).toMatch(/alter table public\.payments[\s\S]*?add column if not exists dodo_signature text/i);
    expect(code).toMatch(/constraint payments_dodo_payment_unique unique \(dodo_payment_id\)/i);
  });

  it("requires a dodo session reference on dodo orders", () => {
    expect(code).toMatch(/constraint orders_dodo_session_present_check/i);
    expect(code).toMatch(/provider <> 'dodo' or dodo_session_id is not null/i);
  });

  it("creates the atomic complete_dodo_payment RPC (service_role only)", () => {
    expect(code).toMatch(/create or replace function public\.complete_dodo_payment\(/i);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/set search_path = public/i);
    expect(code).toMatch(/revoke all on function public\.complete_dodo_payment\(uuid, text, text, integer, text, timestamptz, text\) from public, anon, authenticated/i);
    expect(code).toMatch(/grant execute on function public\.complete_dodo_payment\(uuid, text, text, integer, text, timestamptz, text\) to service_role/i);
  });

  it("dodo completion guards provider, checks dodo idempotency, never downgrades infinite grants", () => {
    expect(code).toMatch(/v_order\.provider is distinct from 'dodo'/i);
    expect(code).toMatch(/where dodo_payment_id = p_dodo_payment_id/i);
    expect(code).toMatch(/insert into public\.payments \(order_id, organization_id, dodo_payment_id, dodo_signature/i);
    expect(code).toMatch(/v_existing_ent\.expires_at is null and v_existing_ent\.source is distinct from 'free'/i);
  });

  it("widens repair_billing_completion to accept dodo payments without changing semantics", () => {
    expect(code).toMatch(/create or replace function public\.repair_billing_completion\(/i);
    expect(code).toMatch(/v_payment\.razorpay_payment_id is null and v_payment\.dodo_payment_id is null/i);
    expect(code).toMatch(/revoke all on function public\.repair_billing_completion\(uuid\) from public, anon, authenticated/i);
    expect(code).toMatch(/grant execute on function public\.repair_billing_completion\(uuid\) to service_role/i);
  });
});
