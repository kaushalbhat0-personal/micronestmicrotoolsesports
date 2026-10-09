import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Static regression test for the FIX-06 consume_free_check migration.
// Runtime atomicity is proven on real Postgres in
// consume-free-check.integration.test.ts (which extracts and executes this
// exact function definition); these assertions pin the security posture,
// error contract, and scope of the shipped SQL.

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251025000001_sponsorship_free_check_consumption.sql"),
  "utf8",
);

const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("FIX-06 consume_free_check migration", () => {
  it("defines exactly one SECURITY DEFINER function with fixed search_path", () => {
    expect(code.match(/create or replace function public\.consume_free_check\(/gi)?.length).toBe(1);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/set search_path = public/i);
    expect(code).not.toMatch(/pg_advisory_lock\s*\(/i);
    expect(code).toMatch(/pg_advisory_xact_lock\s*\(/i);
  });

  it("is service_role-only (revoked from public/anon/authenticated)", () => {
    expect(code).toMatch(/revoke all on function public\.consume_free_check\(uuid, uuid, uuid, text, text\) from public, anon, authenticated/i);
    expect(code).toMatch(/grant execute on function public\.consume_free_check\(uuid, uuid, uuid, text, text\) to service_role/i);
  });

  it("exposes the documented error contract (quota/duplicate/no-access)", () => {
    expect(code).toMatch(/errcode = 'SFQ01'/);
    expect(code).toMatch(/errcode = 'SFQ02'/);
    expect(code).toMatch(/errcode = 'SFD01'/);
    expect(code).toMatch(/errcode = 'SFN01'/);
  });

  it("takes only authoritative inputs (no usage/plan/source/flags from callers)", () => {
    expect(code).toMatch(/p_user_id uuid,\s*p_organization_id uuid,\s*p_campaign_id uuid,\s*p_platform text,\s*p_scanner_version text/i);
    expect(code).not.toMatch(/p_remaining|p_usage|p_plan|p_source|p_is_free|p_is_all_access|p_quota/i);
  });

  it("lock key is user + UTC month (never user-only, never session-scoped)", () => {
    expect(code).toMatch(/sponsor_free_check:/i);
    expect(code).toMatch(/to_char\(now\(\) at time zone 'UTC', 'YYYY-MM'\)/i);
  });

  it("month start is UTC-exact (matches currentMonthStartIso)", () => {
    expect(code).toMatch(/\(date_trunc\('month', now\(\) at time zone 'UTC'\)\) at time zone 'UTC'/i);
  });

  it("paid/All Access short-circuit before lock and budget", () => {
    const lockIdx = code.search(/pg_advisory_xact_lock/i);
    const paidProbe = code.search(/te\.is_all_access = true/);
    expect(paidProbe).toBeGreaterThan(-1);
    expect(paidProbe).toBeLessThan(lockIdx);
    // Expired paid resolves to the free path (same decision table as TS).
    expect(code).toMatch(/v_user_expires <= now\(\)/i);
  });

  it("adds only the budget-count covering index (no tables, no RLS, no counters)", () => {
    expect(code).toMatch(/create index if not exists scans_org_started_idx/i);
    expect(code).not.toMatch(/create table/i);
    expect(code).not.toMatch(/create policy|alter policy|drop policy/i);
    expect(code).not.toMatch(/counter|ledger/i);
    expect(code).not.toMatch(/delete from/i);
    expect(code).not.toMatch(/draft-ban|tie-breaker|prize-splitter|creator|agency/i);
  });

  it("duplicate rule precedes insert and stale rows expire first", () => {
    const staleIdx = code.search(/stale_timeout/);
    const dupIdx = code.search(/already_running/);
    const insertIdx = code.search(/insert into public\.scans/);
    expect(staleIdx).toBeGreaterThan(-1);
    expect(dupIdx).toBeGreaterThan(staleIdx);
    expect(insertIdx).toBeGreaterThan(dupIdx);
  });

  it("unique violations map to already_running (cross-principal race safety net)", () => {
    expect(code).toMatch(/when unique_violation then/i);
  });
});
