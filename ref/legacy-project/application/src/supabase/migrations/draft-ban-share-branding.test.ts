import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251030000001_draft_ban_share_branding.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("draft-ban share branding migration", () => {
  it("replaces only the share RPC (same signature, no schema or data change)", () => {
    expect(sql).toMatch(/create or replace function public\.get_completed_draft_share\(p_token uuid\)/);
    expect(sql).not.toMatch(/alter table|drop table|drop column|delete from|update public\./i);
    expect(sql).not.toMatch(/create policy|drop policy/i);
  });

  it("gates the logo on unexpired paid (or All Access) coverage at share time", () => {
    expect(sql).toMatch(/'organization_logo_url', case/i);
    expect(sql).toMatch(/te\.source in \('subscription', 'manual', 'promo'\)/);
    expect(sql).toMatch(/te\.is_all_access = true/);
    expect(sql).toMatch(/t\.slug = 'draft-ban'/);
    expect(sql).toMatch(/else null/);
  });

  it("preserves the narrow public share contract", () => {
    expect(sql).toMatch(/where m\.share_token = p_token/);
    expect(sql).toMatch(/and m\.status = 'completed'/);
    expect(sql).toMatch(/'organization_name', o\.name/);
    // The entitlement join legitimately references m.organization_id; only
    // quoted DTO keys would leak new fields.
    expect(sql).not.toMatch(/'organization_id'/);
    expect(sql).not.toMatch(/'created_by'/);
  });

  it("keeps SECURITY DEFINER hygiene and the anon/authenticated-only grants", () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = public/);
    expect(sql).toMatch(/revoke all on function public\.get_completed_draft_share\(uuid\) from public/);
    expect(sql).toMatch(/grant execute on function public\.get_completed_draft_share\(uuid\) to anon, authenticated/);
    expect(sql).not.toMatch(/to service_role/);
  });
});
