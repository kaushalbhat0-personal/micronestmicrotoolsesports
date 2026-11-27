// P1 teams route audit: reader exclusivity for public team routes.
// Mirrors the G1-6 static audit for /players: this test reads the team route
// sources and fails if a public team route can reach base tables, the
// service role, or private team internals. Pure static audit: no network, no
// Supabase client.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

function listRouteSources(): { path: string; content: string }[] {
  const entries: { path: string; content: string }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.name === "node_modules") {
        continue;
      }
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|mts|cts)$/.test(name.name) && !/\.test\.[jt]sx?$/.test(name.name)) {
        entries.push({ path: full, content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(here);
  return entries;
}

const sources = listRouteSources();

describe("P1 teams route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = sources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("teams", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("new", "page.tsx")))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      // Qualified table refs (prose may use the bare words "teams" or
      // "applications" — only schema-qualified refs indicate data access).
      for (const table of [
        "public.teams",
        "public.team_members",
        "public.recruitment_posts",
        "public.applications",
        "public.reports",
        "public.app_users",
        "public.player_profiles",
        "public.player_game_profiles",
      ]) {
        expect(content, `${path}: base table ref ${table}`).not.toContain(table);
      }
    }
  });

  it("uses no service-role, admin client or signed-URL flow", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: service role`).not.toMatch(/service.role|serviceRole|SERVICE_ROLE/i);
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: admin surface`).not.toContain("admin.");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("exposes no owner, applicant or decision internals in any route source", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: ownership leak`).not.toContain("owner_user_id");
      expect(content, `${path}: ownership leak`).not.toContain("created_by");
      expect(content, `${path}: org leak`).not.toContain("organization_id");
      expect(content, `${path}: applicant leak`).not.toContain("applicant_user_id");
      expect(content, `${path}: decision leak`).not.toContain("decided_by");
      expect(content, `${path}: decision leak`).not.toContain("decided_at");
    }
  });

  it("directory route reads only through TeamDirectoryReader.searchTeams", () => {
    const page = sources.find((s) => s.path.endsWith(join("teams", "page.tsx")));
    expect(page).toBeDefined();
    expect(page?.content).toContain("TeamResults");
    const results = sources.find((s) =>
      s.path.endsWith(join("_components", "team-results.tsx")),
    );
    expect(results).toBeDefined();
    expect(results?.content).toContain("searchTeams");
    expect(results?.content).toContain("server/team-directory-reader");
  });

  it("profile route resolves only through getTeamBySlug", () => {
    const page = sources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getTeamBySlug");
    expect(page?.content).toContain("server/team-directory-reader");
    expect(page?.content).toContain("notFound()");
  });

  it("enables no write path: no server actions, no mutations", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: mutation`).not.toContain(".insert(");
      expect(content, `${path}: mutation`).not.toContain(".update(");
      expect(content, `${path}: mutation`).not.toContain(".delete(");
      expect(content, `${path}: mutation`).not.toContain(".upsert(");
    }
  });
});
