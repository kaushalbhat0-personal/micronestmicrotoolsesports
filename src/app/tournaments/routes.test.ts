// P3 tournaments route audit: reader exclusivity for public tournament routes.
// Mirrors the P1 teams audit: reads the tournament route sources and fails
// if a route can reach base tables, the service role, payment/operations
// flows, or private internals. The gated publishing layer
// (server/tournament-writer.ts) is audited separately: validation-only,
// kill switch ON. Pure static audit: no network, no Supabase client.

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

const writerPath = join(here, "..", "..", "features", "tournaments", "server", "tournament-writer.ts");
const writerContent = readFileSync(writerPath, "utf8");

describe("P3 tournaments route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("tournaments", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      for (const table of [
        "public.tournaments",
        "public.tournament_organizers",
        "public.tournament_registrations",
        "public.team_members",
        "public.applications",
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
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i,
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: admin surface`).not.toContain("admin.");
      expect(content, `${path}: signed URLs`).not.toContain("SignedUrl");
    }
  });

  it("exposes no owner, payment, operations or decision internals", () => {
    // Render surface only: _lib-free route dir has no form parsers; the
    // publish form legitimately names registration fields (not secrets).
    for (const { path, content } of routeSources) {
      for (const token of [
        "owner_user_id",
        "created_by",
        "organization_id",
        "applicant_user_id",
        "payment_id",
        "bracket_id",
      ]) {
        expect(content, `${path}: internal token ${token}`).not.toContain(token);
      }
    }
  });

  it("contains no payment, bracket, scoring or prize-distribution flows", () => {
    for (const { path, content } of routeSources) {
      // Word-boundary patterns: prose like "Grouping" must not trip this gate.
      expect(content, `${path}: payment flow`).not.toMatch(
        /collect\s+(payments?|fees?)|\bcheckout\b|\bstripe\b|\bupi\b/i,
      );
      expect(content, `${path}: operations flow`).not.toMatch(
        /\bbrackets?\b|\blive scoring\b|\bmatch schedul/i,
      );
      expect(content, `${path}: prize flow`).not.toMatch(/\bdistribute\b|\bpayouts?\b|winnings transfer/i);
    }
  });

  it("directory route reads only through TournamentReader.searchTournaments", () => {
    const page = routeSources.find((s) => s.path.endsWith(join("tournaments", "page.tsx")));
    expect(page).toBeDefined();
    expect(page?.content).toContain("TournamentResults");
    const results = routeSources.find((s) =>
      s.path.endsWith(join("_components", "tournament-results.tsx")),
    );
    expect(results).toBeDefined();
    expect(results?.content).toContain("searchTournaments");
    expect(results?.content).toContain("server/tournament-reader");
  });

  it("detail route resolves only through getTournamentBySlug", () => {
    const page = routeSources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getTournamentBySlug");
    expect(page?.content).toContain("server/tournament-reader");
    expect(page?.content).toContain("notFound()");
  });

  it("enables no write path: no server actions, no mutations, no form targets", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: mutation`).not.toContain(".insert(");
      expect(content, `${path}: mutation`).not.toContain(".update(");
      expect(content, `${path}: mutation`).not.toContain(".delete(");
      expect(content, `${path}: mutation`).not.toContain(".upsert(");
      if (content.includes("<form")) {
        const forms = content.match(/<form[^>]*>/g) ?? [];
        for (const form of forms) {
          const hasAction = /\saction\s*=/i.test(form);
          const isGet = /method\s*=\s*["']get["']/i.test(form);
          expect(hasAction && !isGet, `${path}: write-path form ${form}`).toBe(false);
        }
      }
    }
  });

  it("keeps the publishing kill switch ON (flipping it breaks this test by design)", () => {
    expect(writerContent).toContain("TOURNAMENT_WRITES_ENABLED: boolean = false");
  });
});
