import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251016000001_draft_ban_core.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("draft-ban migration", () => {
  it("creates draft_matches and draft_templates", () => {
    expect(sql).toMatch(/create table if not exists public\.draft_matches/);
    expect(sql).toMatch(/create table if not exists public\.draft_templates/);
  });

  it("uses uuid PKs, org cascade, and JSONB snapshots", () => {
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/);
    expect(sql).toMatch(/references public\.organizations\(id\) on delete cascade/);
    expect(sql).toMatch(/constraint draft_matches_sequence_is_array/);
    expect(sql).toMatch(/constraint draft_matches_completed_at_check/);
    expect(sql).toMatch(/constraint draft_templates_org_name_unique unique \(organization_id, name\)/);
  });

  it("allocates reference IDs via a sequence, never count()+1", () => {
    expect(sql).toMatch(/create sequence if not exists public\.draft_match_ref_seq/);
    expect(sql).toMatch(/draft_match_next_ref/);
    expect(sql).not.toMatch(/count\(\*\) \+ 1/);
    expect(sql).not.toMatch(/max\(.*\) \+ 1/i);
  });

  it("enables RLS with is_org_member and guards completed rows", () => {
    expect(sql).toMatch(/alter table public\.draft_matches enable row level security/);
    expect(sql).toMatch(/alter table public\.draft_templates enable row level security/);
    expect(sql).toMatch(/is_org_member\(organization_id\)/);
    expect(sql).toMatch(/draft_ban_guard_completed/);
    expect(sql).toMatch(/Completed draft matches are immutable/);
  });

  it("exposes completed-only share via SECURITY DEFINER with no anon table policy", () => {
    expect(sql).toMatch(/get_completed_draft_share/);
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/status = 'completed'/);
    expect(sql).not.toMatch(/create policy.*on public\.draft_matches.*to anon/);
  });

  it("provisions the org-logos bucket without game/platform scope creep", () => {
    expect(sql).toMatch(/org-logos/);
    expect(sql).not.toMatch(/tournament|bracket|analytics/i);
  });
});
