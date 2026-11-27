// P8 brands route audit: reader exclusivity for public brand routes.
// Static audit: fails if a public brand route can reach base tables, the
// service role, or private brand internals. No network, no Supabase client.

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

describe("P8 brands route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = sources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("brands", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      for (const table of [
        "public.brands",
        "public.organizations",
        "public.teams",
        "public.app_users",
        "public.player_profiles",
      ]) {
        expect(content, `${path}: base table ref ${table}`).not.toContain(table);
      }
    }
  });

  it("uses no service-role, admin client or signed-URL flow", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: service role`).not.toMatch(/service.role|serviceRole|SERVICE_ROLE/i);
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("exposes no representative, evidence or contact internals", () => {
    for (const { path, content } of sources) {
      // Field-pattern checks (not bare prose words): comments may explain that
      // representative/evidence data is excluded, but no private field may exist.
      expect(content, `${path}: representative leak`).not.toContain("representative_");
      expect(content, `${path}: representative leak`).not.toContain("representativeEmail");
      expect(content, `${path}: evidence leak`).not.toContain("evidence_");
      expect(content, `${path}: evidence leak`).not.toContain("evidenceUrl");
      expect(content, `${path}: ownership leak`).not.toContain("owner_user_id");
      expect(content, `${path}: ownership leak`).not.toContain("created_by");
    }
  });

  it("directory route reads only through BrandReader.searchBrands", () => {
    const page = sources.find((s) => s.path.endsWith(join("brands", "page.tsx")));
    expect(page?.content).toContain("BrandResults");
    const results = sources.find((s) =>
      s.path.endsWith(join("_components", "brand-results.tsx")),
    );
    expect(results?.content).toContain("searchBrands");
    expect(results?.content).toContain("server/brand-reader");
  });

  it("profile route resolves only through getBrandBySlug", () => {
    const page = sources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page?.content).toContain("getBrandBySlug");
    expect(page?.content).toContain("server/brand-reader");
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
