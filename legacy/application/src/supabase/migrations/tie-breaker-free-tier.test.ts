import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251027000001_tie_breaker_free_tier.sql"),
  "utf8",
);

/** Statements only (strip -- comments): assert on code, not prose. */
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("tie-breaker free tier migration — IMPLEMENT-07", () => {
  it("allows source='free' on org tool_entitlements", () => {
    expect(code).toMatch(/alter table public\.tool_entitlements[\s\S]*?tool_entitlements_source_check[\s\S]*?check \(source in \('subscription', 'manual', 'promo', 'free'\)\)/i);
  });

  it("creates the atomic consume_tie_breaker_lock RPC", () => {
    expect(code).toMatch(/create or replace function public\.consume_tie_breaker_lock\(/i);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/set search_path = public/i);
  });

  it("serializes per org + workspace-local month (no UTC quota boundary)", () => {
    expect(code).toMatch(/pg_advisory_xact_lock\(/i);
    expect(code).toMatch(/now\(\) at time zone v_tz/i);
    expect(code).toMatch(/date_trunc\('month', now\(\) at time zone v_tz\)/i);
  });

  it("enforces 3 locks per workspace month with idempotent locked return", () => {
    expect(code).toMatch(/if v_used >= 3 then/i);
    expect(code).toMatch(/using errcode = 'TBF01'/i);
    expect(code).toMatch(/if v_comp\.status = 'locked' then/i);
  });

  it("bypasses quota for paid / All Access and fails closed without coverage", () => {
    expect(code).toMatch(/v_org_paid/i);
    expect(code).toMatch(/te\.source in \('subscription',\s*'manual',\s*'promo'\)/i);
    expect(code).toMatch(/using errcode = 'TBN01'/i);
  });

  it("allocates the record number after the quota check (no rejection gaps)", () => {
    const fnStart = code.indexOf("consume_tie_breaker_lock(");
    const quotaAt = code.indexOf("v_used >= 3", fnStart);
    const refAt = code.indexOf("tie_breaker_next_ref()", fnStart);
    expect(quotaAt).toBeGreaterThan(-1);
    expect(refAt).toBeGreaterThan(quotaAt);
  });

  it("guards the lock path: direct status→locked writes rejected", () => {
    expect(code).toMatch(/tie_breaker_require_authorized_lock/i);
    expect(code).toMatch(/tie_breaker\.authorized_lock/i);
    expect(code).toMatch(/using errcode = 'TBK01'/i);
    expect(code).toMatch(/before update of status on public\.tie_breaker_competitions/i);
  });

  it("adds a partial covering index for the monthly locked count", () => {
    expect(code).toMatch(/tie_breaker_competitions_org_locked_idx/i);
    expect(code).toMatch(/where status = 'locked'/i);
  });

  it("restricts RPC execution to service_role", () => {
    expect(code).toMatch(/revoke all on function public\.consume_tie_breaker_lock\(uuid, uuid, uuid, jsonb, timestamptz\) from public, anon, authenticated/i);
    expect(code).toMatch(/grant execute on function public\.consume_tie_breaker_lock\(uuid, uuid, uuid, jsonb, timestamptz\) to service_role/i);
  });

  it("transitions Free org grants to paid on purchase, preserves FIX-05 infinite rows", () => {
    expect(code).toMatch(/v_existing_ent\.source is distinct from 'free'/i);
    expect(code).toMatch(/set expires_at = v_new_expires_at, source = 'subscription'/i);
    // Sponsor mirror + FIX-05 user-grant logic preserved verbatim.
    expect(code).toMatch(/sponsor-sentinel/);
    expect(code).toMatch(/user_tool_entitlements/);
  });

  it("gates share logos on paid grants, keeps share grants", () => {
    expect(code).toMatch(/create or replace function public\.get_completed_tie_breaker_share\(p_token uuid\)/i);
    expect(code).toMatch(/organization_logo_url', case/i);
    expect(code).toMatch(/grant execute on function public\.get_completed_tie_breaker_share\(uuid\) to anon, authenticated/i);
    expect(code).toMatch(/and c\.status = 'locked'/i);
  });

  it("touches no sponsorship quota SQL, no RLS, no unrelated tables", () => {
    expect(code).not.toMatch(/consume_free_check/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/drop policy/i);
    expect(code).not.toMatch(/draft_matches|draft_templates/i);
    expect(code).not.toMatch(/user_tool_entitlements[\s\S]*?add constraint/i);
    expect(code).not.toMatch(/create table/i);
  });
});
