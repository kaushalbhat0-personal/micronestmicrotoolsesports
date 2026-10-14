import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20251109000001_org_members_hardening.sql"), "utf8");

describe("org member hardening migration — RCCF-ORG-MEMBERS-01", () => {
  it("creates the org audit table with RLS member-read, no direct writes", () => {
    expect(sql).toMatch(/create table if not exists public\.organization_audit_logs/);
    expect(sql).toMatch(/alter table public\.organization_audit_logs enable row level security/);
    expect(sql).toMatch(/create policy "org_audit_select_member"/);
    expect(sql).toMatch(/using \(public\.is_org_member\(organization_id\)\)/);
    expect(sql).not.toMatch(/for insert[^;]*organization_audit_logs/);
    expect(sql).not.toMatch(/for update[^;]*organization_audit_logs/);
    expect(sql).not.toMatch(/for delete[^;]*organization_audit_logs/);
  });

  it("last-owner trigger blocks final-owner deletion/demotion for all roles", () => {
    expect(sql).toMatch(/create or replace function public\.protect_last_organization_owner\(\)/);
    expect(sql).toMatch(/lock table public\.organization_members in share row exclusive mode/);
    expect(sql).toMatch(/organization must retain at least one owner/);
    expect(sql).toMatch(/create trigger organization_members_last_owner/);
    expect(sql).toMatch(/before update or delete on public\.organization_members/);
    expect(sql).toMatch(/drop trigger if exists organization_members_last_owner/);
  });

  it("owner_id guard leaves transfer RPC as the sole writer", () => {
    expect(sql).toMatch(/create or replace function public\.protect_organization_owner_id\(\)/);
    expect(sql).toMatch(/may only change via transfer_organization_ownership/);
    expect(sql).toMatch(/before update of owner_id on public\.organizations/);
  });

  it("removes direct member write policies without touching reads", () => {
    for (const p of ["org_members_insert_admin", "org_members_update_admin", "org_members_delete_admin", "org_members_leave_self"]) {
      expect(sql).toMatch(new RegExp(`drop policy if exists "${p}"`));
    }
    expect(sql).not.toMatch(/create policy "org_members_/);
    // reads stay: documented, and the select policy is never dropped
    expect(sql).toMatch(/Reads are unchanged/);
    expect(sql).not.toMatch(/drop policy if exists "org_members_select_member"/);
  });

  it("defines five service_role-only RPCs with the documented matrix", () => {
    const esc = (s: string) => s.replace(/[()]/g, "\\$&");
    for (const fn of [
      "add_organization_member",
      "remove_organization_member",
      "change_member_role",
      "leave_organization",
      "transfer_organization_ownership",
    ]) {
      // definitions wrap parameter lists across lines; grants are inline
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${fn}\\(`));
    }
    for (const sig of [
      "add_organization_member(uuid, uuid, text, uuid)",
      "remove_organization_member(uuid, uuid, uuid)",
      "change_member_role(uuid, uuid, text, uuid)",
      "leave_organization(uuid, uuid)",
      "transfer_organization_ownership(uuid, uuid, uuid)",
    ]) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${esc(sig)} to service_role`));
    }
    expect(sql).toMatch(/revoke all on function public\.\w+\([^)]*\) from public, anon, authenticated/);
    // matrix cornerstones
    expect(sql).toMatch(/ownership moves by transfer/);
    expect(sql).toMatch(/demote-then-remove/);
    expect(sql).toMatch(/exactly one owner/);
    expect(sql).toMatch(/organization\.transfer_ownership/);
    expect(sql).toMatch(/member\.leave/);
  });

  it("transfer is atomic: owner_id + both role rows + count check", () => {
    const body = sql.slice(sql.indexOf("transfer_organization_ownership("));
    expect(body).toMatch(/update public\.organizations set owner_id = p_target where id = p_org/);
    expect(body).toMatch(/update public\.organization_members set role = 'admin'/);
    expect(body).toMatch(/update public\.organization_members set role = 'owner'/);
    expect(body).toMatch(/v_owners <> 1/);
  });

  it("migration is additive and safe", () => {
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/alter table public\.organization_members /i);
    expect(sql).not.toMatch(/alter table public\.organizations /i);
    expect(sql).not.toMatch(/complete_billing_payment/);
    expect(sql).not.toMatch(/platform_admin/);
    for (const word of ["pricing", "whatsapp", "impersonat", "price_id"]) {
      expect(sql.toLowerCase()).not.toContain(word);
    }
  });
});
