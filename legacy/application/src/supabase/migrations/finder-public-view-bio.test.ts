import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase/migrations/20251122000001_finder_public_view_bio.sql");
const sql = readFileSync(migrationPath, "utf8");

describe("finder public view bio expansion", () => {
  it("replaces the Phase A view, keeping every existing projected column", () => {
    expect(sql).toMatch(/drop view if exists public\.finder_public_players/);
    expect(sql).toMatch(/create view public\.finder_public_players/);
    for (const col of [
      "p.handle",
      "p.display_name",
      "p.avatar_url",
      "p.region",
      "p.current_level",
      "p.target_level",
      "p.primary_role",
      "p.secondary_roles",
      "p.availability",
      "p.looking_for",
      "p.open_to_tryout",
      "g.game",
      "g.ign",
      "g.verification_status",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("adds only user-authored, non-PII columns", () => {
    expect(sql).toContain("p.bio");
    expect(sql).toContain("p.languages");
    expect(sql).toContain("p.timezone");
  });

  it("keeps the Character ID mask and still omits sensitive linkages", () => {
    expect(sql).toMatch(/'\*\*\*\*' \|\| right\(g\.character_id, 4\)/);
    const selectList = sql.slice(sql.indexOf("select"), sql.indexOf("from public.finder_profiles"));
    expect(selectList).not.toMatch(/evidence_path/);
    expect(selectList).not.toMatch(/external_link/);
    expect(selectList).not.toMatch(/user_id/);
    expect(selectList).not.toMatch(/email|phone|address/);
  });

  it("touches no tables, policies, or buckets", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/storage\./);
  });
});
