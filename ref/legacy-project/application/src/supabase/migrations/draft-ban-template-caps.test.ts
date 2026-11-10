import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251029000001_draft_ban_template_caps.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("draft-ban template caps migration", () => {
  it("is additive only: marker column, backfill of starters, no deletion or ownership change", () => {
    expect(sql).toMatch(/alter table public\.draft_templates\s+add column if not exists is_starter boolean not null default false/);
    expect(sql).toMatch(/update public\.draft_templates\s+set is_starter = true\s+where[\s\S]*name = 'Standard Veto'/);
    expect(sql).not.toMatch(/drop table|drop column|delete from/i);
    // The only UPDATE targets the new classification flag — never ownership.
    const updates = sql.match(/^\s*update public\.\S+/gim) ?? [];
    expect(updates).toHaveLength(1);
    expect(sql).toMatch(/update public\.draft_templates\s+set is_starter = true/);
  });

  it("resolves caps server-side (paid 20, otherwise free 3) with fixed search_path", () => {
    expect(sql).toMatch(/draft_ban_custom_template_cap/);
    expect(sql).toMatch(/return 20/);
    expect(sql).toMatch(/return 3/);
    expect(sql).toMatch(/set search_path = public/);
  });

  it("enforces the cap in a BEFORE INSERT guard serialized per org (no count-then-insert race)", () => {
    expect(sql).toMatch(/draft_ban_guard_template_cap/);
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\('draft_template:' \|\| NEW\.organization_id::text\)\)/);
    expect(sql).toMatch(/before insert on public\.draft_templates/);
    expect(sql).toMatch(/errcode = 'DBT01'/);
  });

  it("demotes spoofed starter flags and freezes is_starter against UPDATE forgery", () => {
    expect(sql).toMatch(/draft_ban\.authorized_starter/);
    expect(sql).toMatch(/NEW\.is_starter := false/);
    expect(sql).toMatch(/draft_ban_freeze_template_starter/);
    expect(sql).toMatch(/NEW\.is_starter := OLD\.is_starter/);
  });

  it("exposes atomic creation + idempotent starter RPCs, service-role only", () => {
    expect(sql).toMatch(/create_draft_template/);
    expect(sql).toMatch(/ensure_starter_draft_template/);
    expect(sql).toMatch(/on conflict \(organization_id, name\) do nothing/);
    expect(sql).toMatch(/grant execute on function public\.create_draft_template\(uuid, text, jsonb, uuid\) to service_role/);
    expect(sql).toMatch(/grant execute on function public\.ensure_starter_draft_template\(uuid, uuid\) to service_role/);
    expect(sql).toMatch(/revoke all on function public\.create_draft_template\(uuid, text, jsonb, uuid\) from public, anon, authenticated/);
  });

  it("keeps RLS untouched and declares the DBT01/DBT02/DBN01 error contract", () => {
    expect(sql).not.toMatch(/create policy|drop policy/i);
    expect(sql).toMatch(/errcode = 'DBT02'/);
    expect(sql).toMatch(/errcode = 'DBN01'/);
  });
});
