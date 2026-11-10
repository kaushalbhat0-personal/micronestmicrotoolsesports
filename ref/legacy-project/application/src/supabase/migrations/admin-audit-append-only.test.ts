import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20251014000002_admin_audit_append_only.sql"), "utf8");

describe("admin audit append-only hardening — ADMIN-10A", () => {
  it("creates prevent function that blocks UPDATE/DELETE for all roles", () => {
    expect(sql).toMatch(/create or replace function public\.prevent_admin_audit_mutation\(\)/);
    expect(sql).toMatch(/returns trigger/);
    expect(sql).toMatch(/raise exception.*admin_audit_logs is append-only/);
    expect(sql).toMatch(/TG_OP/);
  });

  it("creates before update and before delete triggers on admin_audit_logs", () => {
    expect(sql).toMatch(/create trigger admin_audit_logs_no_update/);
    expect(sql).toMatch(/before update on public\.admin_audit_logs/);
    expect(sql).toMatch(/create trigger admin_audit_logs_no_delete/);
    expect(sql).toMatch(/before delete on public\.admin_audit_logs/);
    expect(sql).toMatch(/execute function public\.prevent_admin_audit_mutation\(\)/);
  });

  it("does not block INSERT and does not change SELECT/RLS", () => {
    expect(sql).not.toMatch(/before insert/i);
    expect(sql).not.toMatch(/after insert/i);
    expect(sql).not.toMatch(/enable row level security/);
    expect(sql).not.toMatch(/create policy/);
  });

  it("is idempotent with drop if exists", () => {
    expect(sql).toMatch(/drop trigger if exists admin_audit_logs_no_update/);
    expect(sql).toMatch(/drop trigger if exists admin_audit_logs_no_delete/);
  });

  it("documents append-only contract", () => {
    expect(sql).toMatch(/append-only/i);
    expect(sql).toMatch(/INSERT remains allowed/);
  });
});
