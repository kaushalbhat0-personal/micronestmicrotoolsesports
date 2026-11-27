import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20251110000001_org_owner_deletion_safety.sql"), "utf8");
const old = readFileSync(join(process.cwd(), "supabase/migrations/20251109000001_org_members_hardening.sql"), "utf8");

describe("org owner deletion safety — RCCF-ORG-MEMBERS-02", () => {
  it("retires the immediate-check trigger without touching history", () => {
    expect(sql).toMatch(/drop trigger if exists organization_members_last_owner on public\.organization_members/);
    expect(sql).toMatch(/drop function if exists public\.protect_last_organization_owner\(\)/);
    // the historical file still contains its own design (history preserved)
    expect(old).toMatch(/create trigger organization_members_last_owner/);
  });

  it("serializes member mutations with a lock-only BEFORE trigger", () => {
    expect(sql).toMatch(/create or replace function public\.serialize_organization_members\(\)/);
    expect(sql).toMatch(/lock table public\.organization_members in share row exclusive mode/);
    expect(sql).toMatch(/create trigger organization_members_serialize/);
    expect(sql).toMatch(/before update or delete on public\.organization_members/);
  });

  it("enforces the invariant at commit with a deferred constraint trigger", () => {
    expect(sql).toMatch(/create or replace function public\.enforce_organization_owner_count\(\)/);
    expect(sql).toMatch(/organization must retain at least one owner/);
    // deleted parents are skipped — cascade completes
    expect(sql).toMatch(/Parent deleted \(cascade completed\): nothing to protect/);
    expect(sql).toMatch(/create constraint trigger organization_members_owner_count/);
    expect(sql).toMatch(/deferrable initially deferred/);
    expect(sql).toMatch(/after update or delete on public\.organization_members/);
  });

  it("redefines transfer with owner-first self semantics, same atomicity", () => {
    expect(sql).toMatch(/create or replace function public\.transfer_organization_ownership\(/);
    // non-owner self-transfer is forbidden; genuine owner self stays idempotent
    expect(sql).toMatch(/including the self-transfer case/);
    expect(sql).toMatch(/return jsonb_build_object\('ok', true, 'idempotent', true\)/);
    // promote-first + count check + audit preserved
    expect(sql).toMatch(/update public\.organizations set owner_id = p_target where id = p_org/);
    expect(sql).toMatch(/v_owners <> 1/);
    expect(sql).toMatch(/organization\.transfer_ownership/);
    expect(sql).toMatch(/grant execute on function public\.transfer_organization_ownership\(uuid, uuid, uuid\) to service_role/);
    expect(sql).toMatch(/revoke all on function public\.transfer_organization_ownership\(uuid, uuid, uuid\) from public, anon, authenticated/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = public/);
  });

  it("migration is additive, ordered, and safe", () => {
    expect(sql).toMatch(/Apply AFTER re-applying/);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/alter table public\.organization_members /i);
    expect(sql).not.toMatch(/alter table public\.organizations /i);
    expect(sql).not.toMatch(/create policy/i);
    // no billing/entitlement/tool tables touched (prose mentions excluded)
    expect(sql).not.toMatch(/public\.(tool_entitlements|orders|payments|plans|tools)\b/);
    expect(sql).not.toMatch(/whatsapp|impersonat|price_id|stripe/i);
  });
});
