import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251028000001_draft_ban_free_completion.sql"),
  "utf8",
);

/** Statements only (strip -- comments): assert on code, not prose. */
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("draft-ban free completion migration — IMPLEMENT-02A", () => {
  it("creates the permanent monthly-completions ledger without a match foreign key", () => {
    expect(code).toMatch(/create table if not exists public\.draft_ban_monthly_completions/i);
    expect(code).toMatch(/month_key text not null check/i);
    expect(code).toMatch(/month_key ~ '\^/i);
    expect(code).toMatch(/primary key \(organization_id, month_key, match_id\)/i);
    expect(code).not.toMatch(/references public\.draft_matches/i);
  });

  it("creates the atomic consume_draft_ban_completion RPC", () => {
    expect(code).toMatch(/create or replace function public\.consume_draft_ban_completion\(/i);
    expect(code).toMatch(/security definer/i);
    expect(code).toMatch(/set search_path = public/i);
  });

  it("locks the match row with organization scope before deciding", () => {
    expect(code).toMatch(/where id = p_match_id/i);
    expect(code).toMatch(/for update/i);
    expect(code).toMatch(/v_match\.organization_id <> p_org_id/i);
  });

  it("returns already-completed matches idempotently before quota", () => {
    const fnStart = code.indexOf("consume_draft_ban_completion(");
    const idemAt = code.indexOf("if v_match.status = 'completed' then", fnStart);
    const quotaAt = code.indexOf("quota_exceeded", fnStart);
    expect(idemAt).toBeGreaterThan(-1);
    expect(quotaAt).toBeGreaterThan(idemAt);
  });

  it("rejects abandoned and other non-in-progress states", () => {
    expect(code).toMatch(/if v_match\.status <> 'in_progress' then/i);
    expect(code).toMatch(/using errcode = 'DBD01'/i);
  });

  it("bypasses quota for paid / All Access with no ledger row", () => {
    expect(code).toMatch(/v_org_paid/i);
    expect(code).toMatch(/te\.source in \('subscription',\s*'manual',\s*'promo'\)/i);
    expect(code).toMatch(/using errcode = 'DBN01'/i);
  });

  it("serializes per org + workspace-local month (no UTC quota boundary)", () => {
    expect(code).toMatch(/pg_advisory_xact_lock\(/i);
    expect(code).toMatch(/now\(\) at time zone v_tz/i);
    expect(code).toMatch(/to_char\(now\(\) at time zone v_tz, 'YYYY-MM'\)/i);
    expect(code).toMatch(/is_valid_iana_timezone\(v_tz\)/i);
  });

  it("counts ledger rows (never live matches) and rejects at >= 1", () => {
    expect(code).toMatch(/from public\.draft_ban_monthly_completions/i);
    expect(code).toMatch(/and month_key = v_month_key/i);
    expect(code).toMatch(/if v_used >= 1 then/i);
    expect(code).toMatch(/using errcode = 'DBQ01'/i);
  });

  it("inserts the ledger row in the same transaction as the guarded update", () => {
    const fnStart = code.indexOf("consume_draft_ban_completion(");
    const insertAt = code.indexOf("insert into public.draft_ban_monthly_completions", fnStart);
    const updateAt = code.indexOf("update public.draft_matches", fnStart);
    expect(insertAt).toBeGreaterThan(-1);
    expect(updateAt).toBeGreaterThan(insertAt);
  });

  it("finalizes with the database clock and a guarded transition", () => {
    expect(code).toMatch(/completed_at = now\(\)/i);
    expect(code).toMatch(/and status = 'in_progress'/i);
    expect(code).toMatch(/tie_breaker\.authorized_lock|draft_ban\.authorized_completion/i);
  });

  it("guards the completion path: direct status→completed and completed_at writes rejected", () => {
    expect(code).toMatch(/draft_ban_require_authorized_completion/i);
    expect(code).toMatch(/draft_ban\.authorized_completion/i);
    expect(code).toMatch(/using errcode = 'DBK01'/i);
    expect(code).toMatch(/before update of status, completed_at on public\.draft_matches/i);
  });

  it("restricts RPC execution to service_role and locks down the ledger", () => {
    expect(code).toMatch(/revoke all on function public\.consume_draft_ban_completion\(uuid, uuid, uuid\) from public, anon, authenticated/i);
    expect(code).toMatch(/grant execute on function public\.consume_draft_ban_completion\(uuid, uuid, uuid\) to service_role/i);
    expect(code).toMatch(/enable row level security/i);
  });

  it("touches no sponsorship quota SQL, no billing, no unrelated tables", () => {
    expect(code).not.toMatch(/consume_free_check/i);
    expect(code).not.toMatch(/consume_tie_breaker_lock/i);
    expect(code).not.toMatch(/complete_billing_payment/i);
    expect(code).not.toMatch(/create policy/i);
    expect(code).not.toMatch(/drop policy/i);
    expect(code).not.toMatch(/draft_templates/i);
    expect(code).not.toMatch(/user_tool_entitlements/i);
  });
});
