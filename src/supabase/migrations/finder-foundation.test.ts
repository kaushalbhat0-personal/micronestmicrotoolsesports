import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251121000001_finder_foundation.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("finder foundation migration", () => {
  it("creates all eight Finder tables with user-scoped ownership", () => {
    for (const table of [
      "finder_profiles",
      "finder_game_profiles",
      "finder_verification_submissions",
      "finder_teams",
      "finder_team_members",
      "finder_recruitment_posts",
      "finder_applications",
      "finder_reports",
    ]) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}`));
    }
    // No org-scoped columns or org-membership authorization anywhere.
    expect(sql).not.toMatch(/organization_id uuid/);
    expect(sql).not.toMatch(/is_org_member\(/);
    expect(sql).not.toMatch(/is_org_admin\(/);
  });

  it("keys ownership to profiles.id with cascade where safe", () => {
    expect(sql).toMatch(/references public\.profiles\(id\) on delete cascade/);
    expect(sql).toMatch(/user_id uuid primary key references public\.profiles\(id\)/);
  });

  it("validates levels, roles stay in code, and slots/expiry constraints", () => {
    for (const level of ["casual", "community", "competitive", "higher-tier", "semi-pro", "professional"]) {
      expect(sql).toContain(level);
    }
    expect(sql).toMatch(/slots >= 1 and slots <= 10/);
    expect(sql).toMatch(/expires_at timestamptz not null default \(now\(\) \+ interval '30 days'\)/);
    expect(sql).toMatch(/note is null or char_length\(note\) <= 200/);
    expect(sql).toMatch(/bio is null or char_length\(bio\) <= 280/);
  });

  it("preserves Character ID as numeric text and constrains uniqueness", () => {
    expect(sql).toMatch(/character_id text not null check \(character_id ~ '\^\[0-9\]\{4,12\}\$'\)/);
    expect(sql).toMatch(/constraint finder_game_profiles_game_character_unique unique \(game, character_id\)/);
    expect(sql).not.toMatch(/character_id (integer|bigint|numeric)/);
  });

  it("enforces one active application per player per post", () => {
    expect(sql).toMatch(/finder_applications_active_unique/);
    expect(sql).toMatch(/where status in \('applied', 'shortlisted'\)/);
  });

  it("enables RLS on every Finder table and derives identity from auth.uid()", () => {
    for (const table of [
      "finder_profiles",
      "finder_game_profiles",
      "finder_verification_submissions",
      "finder_teams",
      "finder_team_members",
      "finder_recruitment_posts",
      "finder_applications",
      "finder_reports",
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
    }
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/applicant_user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/reporter_user_id = auth\.uid\(\)/);
    // No client-supplied ownership: created_by/decided ownership is forced.
    expect(sql).toMatch(/created_by = auth\.uid\(\)/);
  });

  it("prevents self-verification through RLS write guards", () => {
    expect(sql).toMatch(/verification_status in \('unverified', 'pending'\)/);
    expect(sql).toMatch(/verified_at is null/);
  });

  it("denies anon access to submissions, applications, and reports", () => {
    const anonPolicies = sql.match(/create policy .* to anon/g) ?? [];
    expect(anonPolicies.every((policy) => !/verification|application|report/i.test(policy))).toBe(true);
    expect(sql).toMatch(/No anon policies/);
  });

  it("protects team external contact behind member-only reads plus a public view", () => {
    expect(sql).toMatch(/finder_public_teams/);
    expect(sql).toMatch(/finder_teams_select_member/);
    expect(sql).not.toMatch(/create policy "finder_teams_select_member"[^;]*to anon/);
  });

  it("masks Character ID in the public player view and omits evidence/contact", () => {
    const viewBody = sql.slice(
      sql.indexOf("create or replace view public.finder_public_players"),
      sql.indexOf("comment on view public.finder_public_players"),
    );
    expect(viewBody).toContain("create or replace view public.finder_public_players");
    expect(viewBody).toMatch(/'\*\*\*\*' \|\| right\(g\.character_id, 4\)/);
    const selectList = viewBody.slice(viewBody.indexOf("select"), viewBody.indexOf("from public.finder_profiles"));
    expect(selectList).not.toMatch(/user_id/);
    expect(selectList).not.toMatch(/evidence_path/);
    expect(selectList).not.toMatch(/external_link/);
    expect(sql).toMatch(/grant select on public\.finder_public_players to anon, authenticated/);
  });

  it("provisions avatar and private verification buckets with path-prefix policies", () => {
    expect(sql).toMatch(/'finder-avatars', 'finder-avatars', true/);
    expect(sql).toMatch(/'finder-verification', 'finder-verification', false/);
    expect(sql).toMatch(/can_manage_finder_avatar/);
    expect(sql).toMatch(/can_manage_finder_evidence/);
    expect(sql).toMatch(/finder_avatars_public_read/);
    // Verification bucket: owner + reviewer reads, never anon.
    expect(sql).not.toMatch(/bucket_id = 'finder-verification'[^;]*to anon/);
    expect(sql).toMatch(/is_super_admin\(\)/);
  });

  it("grants table privileges to authenticated and view reads to anon", () => {
    expect(sql).toMatch(/grant select, insert, update, delete on public\.finder_profiles to authenticated/);
    expect(sql).toMatch(/grant select on public\.finder_recruitment_posts to anon/);
    // No privilege escalation: nothing is granted to service_role (it bypasses
    // RLS by design); reviewer writes go through the admin client instead.
    expect(sql).not.toMatch(/grant .* to service_role/);
  });

  it("touches no existing product tables, buckets, or policies", () => {
    for (const existing of [
      "bgmi_tournaments",
      "bgmi_lab",
      "tool_entitlements",
      "organization_members",
      "org-logos",
      "sponsor",
      "payout",
      "draft_",
      "tie_breaker",
    ]) {
      expect(sql).not.toMatch(new RegExp(`alter table public\\.${existing}`));
    }
    expect(sql).not.toMatch(/bucket_id = 'org-logos'/);
    expect(sql).not.toMatch(/on public\.org-logos/);
  });
});
