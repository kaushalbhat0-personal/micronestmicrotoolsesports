// G1-6 static route audit: DirectoryReader exclusivity for public routes.
// Authoritative: 07 sections 1-4 + 09 G1-6 + 11 section 3 (APPROVED D-G1-03
// RPC-only) + 12 section 7 (lint guard: no base-table access from routes).
//
// This test reads the route sources and fails if a public player route can
// reach base tables, the service role, or private projection fields. Pure
// static audit: no network, no Supabase client.

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

describe("G1-6 route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = sources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith("page.tsx"))).toBe(true);
    expect(paths.some((p) => p.includes("[handle]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: raw table access`).not.toContain(".from(");
      expect(content, `${path}: base table ref`).not.toContain("player_profiles");
      expect(content, `${path}: base table ref`).not.toContain("player_game_profiles");
      expect(content, `${path}: base table ref`).not.toContain("app_users");
    }
  });

  it("uses no service-role, admin client or signed-URL flow", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: service role`).not.toMatch(
        /service.role|serviceRole|SERVICE_ROLE/i
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: admin surface`).not.toContain("admin.");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("exposes no game_user_id in any route source or comment", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: identifier leak`).not.toContain("game_user_id");
    }
  });

  it("directory route reads only through DirectoryReader.searchDirectory", () => {
    // Thin orchestration: page.tsx renders the shell and streams an async
    // results block that owns the single searchDirectory call.
    const page = sources.find((s) => s.path.endsWith(join("players", "page.tsx")));
    expect(page).toBeDefined();
    expect(page?.content).toContain("DirectoryResults");
    const results = sources.find((s) =>
      s.path.endsWith(join("_components", "directory-results.tsx")),
    );
    expect(results).toBeDefined();
    expect(results?.content).toContain("searchDirectory");
    expect(results?.content).toContain("server/directory-reader");
  });

  it("profile route resolves only through getPlayerByHandle", () => {
    const page = sources.find((s) => s.path.includes("[handle]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getPlayerByHandle");
    expect(page?.content).toContain("server/directory-reader");
    expect(page?.content).toContain("notFound()");
  });
});
