import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20251014000001_platform_admin_foundation.sql"), "utf8");

describe("platform admin foundation migration — schema", () => {
  it("creates platform_admins table with correct columns", () => {
    expect(sql).toMatch(/create table if not exists public\.platform_admins/);
    expect(sql).toMatch(/user_id uuid primary key references public\.profiles\(id\) on delete cascade/);
    expect(sql).toMatch(/granted_by uuid references public\.profiles\(id\) on delete set null/);
    expect(sql).toMatch(/granted_at timestamptz not null default now\(\)/);
    expect(sql).toMatch(/reason text/);
  });

  it("enables RLS on platform_admins and creates no authenticated insert policies", () => {
    expect(sql).toMatch(/alter table public\.platform_admins enable row level security/);
    expect(sql).not.toMatch(/create policy.*platform_admins.*for insert.*to authenticated/);
    expect(sql).not.toMatch(/create policy.*platform_admins.*for select.*to authenticated/);
  });

  it("creates is_super_admin() SECURITY DEFINER with correct body", () => {
    expect(sql).toMatch(/create or replace function public\.is_super_admin\(\)/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).toMatch(/exists \(\s*select 1 from public\.platform_admins/);
    expect(sql).toMatch(/where user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/grant execute on function public\.is_super_admin\(\) to authenticated/);
    expect(sql).not.toMatch(/is_super_admin\(uuid/); // must not accept user_id param
  });

  it("creates admin_audit_logs table with required fields and action check", () => {
    expect(sql).toMatch(/create table if not exists public\.admin_audit_logs/);
    expect(sql).toMatch(/actor_user_id uuid not null references public\.profiles\(id\)/);
    expect(sql).toMatch(/action text not null check \(action ~ '\^\[a-z_\]\+\\\\\.\[a-z_\]\+\$'\)/);
    expect(sql).toMatch(/target_type text not null/);
    expect(sql).toMatch(/target_id uuid/);
    expect(sql).toMatch(/organization_id uuid references public\.organizations\(id\)/);
    expect(sql).toMatch(/reason text/);
    expect(sql).toMatch(/before jsonb/);
    expect(sql).toMatch(/after jsonb/);
    expect(sql).toMatch(/ip inet/);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/);
  });

  it("enables RLS on admin_audit_logs and allows select only via is_super_admin()", () => {
    expect(sql).toMatch(/alter table public\.admin_audit_logs enable row level security/);
    expect(sql).toMatch(/create policy "admin_audit_select_super_admin"/);
    expect(sql).toMatch(/using \(public\.is_super_admin\(\)\)/);
    expect(sql).not.toMatch(/for insert.*to authenticated/);
  });

  it("creates indexes for audit log queries", () => {
    expect(sql).toMatch(/admin_audit_actor_idx/);
    expect(sql).toMatch(/admin_audit_org_idx/);
    expect(sql).toMatch(/admin_audit_created_idx/);
    expect(sql).toMatch(/admin_audit_action_idx/);
  });

  it("does not modify existing tenant RLS helpers", () => {
    expect(sql).not.toMatch(/create policy.*is_org_member/);
    expect(sql).not.toMatch(/create policy.*has_tool_access/);
    expect(sql).not.toMatch(/alter table public\.organizations enable row level security/);
    expect(sql).not.toMatch(/alter table public\.tool_entitlements enable row level security/);
  });

  it("contains no secrets, env allowlists, or email hardcoding", () => {
    expect(sql).not.toMatch(/NEXT_PUBLIC/);
    expect(sql).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(sql).not.toMatch(/@micronest/i);
    expect(sql).not.toMatch(/SUPER_ADMIN/);
  });
});
