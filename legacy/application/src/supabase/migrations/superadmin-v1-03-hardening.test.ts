import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20251108000001_superadmin_v1_03_hardening.sql"), "utf8");

const repairStart = sql.indexOf("create or replace function public.repair_billing_completion(");
const revokeStart = sql.indexOf("create or replace function public.revoke_platform_admin_atomic(");
const ledgerStart = sql.indexOf("create or replace function public.enforce_cron_run_ledger_lifecycle()");
const repairBody = sql.slice(repairStart, revokeStart);
const revokeBody = sql.slice(revokeStart, ledgerStart);

describe("superadmin V1-03 hardening migration — F-01/F-02/F-03", () => {
  it("§1 repair RPC locks existing rows and never inserts a second payment", () => {
    expect(repairStart).toBeGreaterThanOrEqual(0);
    expect(sql).toMatch(/create or replace function public\.repair_billing_completion\(/);
    expect(repairBody).toMatch(/select \* into v_payment from public\.payments where id = p_payment_id for update/);
    expect(repairBody).toMatch(/select \* into v_order from public\.orders where id = v_payment\.order_id for update/);
    // no payment insert anywhere in the repair function
    expect(repairBody).not.toMatch(/insert into public\.payments/);
    expect(repairBody).toMatch(/update public\.orders set status = 'paid'/);
  });

  it("§1 repair RPC enforces captured/authorized, linkage, org, and money invariants", () => {
    expect(repairBody).toMatch(/not eligible for repair/);
    expect(repairBody).toMatch(/Payment\/order organization mismatch/);
    expect(repairBody).toMatch(/Payment\/order amount mismatch/);
    expect(repairBody).toMatch(/Linked order not found/);
    // billing period from the order's plan only
    expect(repairBody).toMatch(/select billing_period into v_billing_period from public\.plans where id = v_order\.plan_id/);
    // idempotent when already paid, without re-extending
    expect(repairBody).toMatch(/if v_order\.status = 'paid' then/);
    expect(repairBody).toMatch(/'idempotent', true/);
    expect(repairBody).toMatch(/'order_status', /);
  });

  it("§1 repair RPC mirrors canonical entitlement semantics (free upgrade + sponsor fence)", () => {
    expect(repairBody).toMatch(/source is distinct from 'free'/);
    expect(repairBody).toMatch(/sponsor-sentinel/);
    expect(repairBody).toMatch(/buyer_user_id/);
    expect(repairBody).toMatch(/source = 'subscription'/);
    expect(sql).toMatch(/grant execute on function public\.repair_billing_completion\(uuid\) to service_role/);
    expect(sql).toMatch(/revoke all on function public\.repair_billing_completion\(uuid\) from public, anon, authenticated/);
  });

  it("§2 atomic revoke RPC serialises concurrent revokes with LOCK TABLE", () => {
    expect(revokeStart).toBeGreaterThanOrEqual(0);
    expect(sql).toMatch(/create or replace function public\.revoke_platform_admin_atomic\(/);
    expect(revokeBody).toMatch(/lock table public\.platform_admins in share row exclusive mode/);
    expect(revokeBody).toMatch(/'final_admin'/);
    expect(revokeBody).toMatch(/'not_found'/);
    expect(revokeBody).toMatch(/delete from public\.platform_admins where user_id = p_target/);
    expect(sql).toMatch(/grant execute on function public\.revoke_platform_admin_atomic\(uuid\) to service_role/);
    expect(sql).toMatch(/revoke all on function public\.revoke_platform_admin_atomic\(uuid\) from public, anon, authenticated/);
  });

  it("§3 cron ledger triggers enforce the full lifecycle", () => {
    expect(sql).toMatch(/create or replace function public\.enforce_cron_run_ledger_lifecycle\(\)/);
    expect(sql).toMatch(/create trigger cron_run_ledger_insert_guard/);
    expect(sql).toMatch(/create trigger cron_run_ledger_lifecycle_update/);
    expect(sql).toMatch(/create trigger cron_run_ledger_no_delete/);
    expect(sql).toMatch(/drop trigger if exists cron_run_ledger_insert_guard/);
    expect(sql).toMatch(/drop trigger if exists cron_run_ledger_lifecycle_update/);
    expect(sql).toMatch(/drop trigger if exists cron_run_ledger_no_delete/);
  });

  it("migration is additive and safe — no pricing/policy/tool changes", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/drop table/i);
    // only function + trigger DDL; existing tables are never altered
    expect(sql).not.toMatch(/alter table public\./i);
    expect(sql).not.toMatch(/alter table/i);
    // canonical completion path is referenced in comments but never replaced
    expect(sql).not.toMatch(/create or replace function public\.complete_billing_payment/);
    expect(sql).not.toMatch(/is_super_admin/);
    for (const word of ["pricing", "whatsapp", "impersonat"]) {
      expect(sql.toLowerCase()).not.toContain(word);
    }
  });
});
