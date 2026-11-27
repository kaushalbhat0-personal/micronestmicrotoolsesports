// P9 organizers route audit: reader exclusivity for public organizer routes.
// Mirrors the P1/P3/P8 audits: reads route sources and fails if a route can
// reach base tables, the service role, payment/operations flows, or private
// internals. The gated writer (server/organizer-writer.ts) is audited
// separately: validation-only, kill switch OFF (disabled). Pure static
// audit: no network, no Supabase client.

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

const routeSources = listRouteSources().filter((s) => !s.path.endsWith("routes.test.ts"));

const writerPath = join(
  here,
  "..",
  "..",
  "features",
  "organizers",
  "server",
  "organizer-writer.ts"
);
const writerContent = readFileSync(writerPath, "utf8");

describe("P9 organizers route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("organizers", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      for (const table of [
        "public.organizers",
        "public.organizer_members",
        "public.tournaments",
        "public.app_users",
      ]) {
        expect(content, `${path}: base table ref ${table}`).not.toContain(table);
      }
    }
  });

  it("uses no service-role, admin client or signed-URL flow", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: service client`).not.toMatch(
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("exposes no owner, membership or verification internals", () => {
    for (const { path, content } of routeSources) {
      for (const token of [
        "owner_user_id",
        "created_by",
        "user_id",
        "verification_evidence",
        "suspension_reason",
      ]) {
        expect(content, `${path}: internal token ${token}`).not.toContain(token);
      }
    }
  });

  it("directory route reads only through OrganizerReader.searchOrganizers", () => {
    const results = routeSources.find((s) =>
      s.path.endsWith(join("_components", "organizer-results.tsx"))
    );
    expect(results).toBeDefined();
    expect(results?.content).toContain("searchOrganizers");
    expect(results?.content).toContain("server/organizer-reader");
  });

  it("detail route resolves only through getOrganizerBySlug", () => {
    const page = routeSources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getOrganizerBySlug");
    expect(page?.content).toContain("server/organizer-reader");
    expect(page?.content).toContain("notFound()");
  });

  it("enables no write path on public routes: no server actions, no mutations", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: mutation`).not.toContain(".insert(");
      expect(content, `${path}: mutation`).not.toContain(".update(");
      expect(content, `${path}: mutation`).not.toContain(".delete(");
      expect(content, `${path}: mutation`).not.toContain(".upsert(");
    }
  });

  it("renders no fabricated verification badges", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: fabricated badge`).not.toMatch(/verified badge|✓.*[Vv]erified/i);
    }
  });

  it("keeps the organizer publishing kill switch OFF (flipping it breaks this test by design)", () => {
    expect(writerContent).toContain("ORGANIZER_WRITES_ENABLED: boolean = false");
  });
});
