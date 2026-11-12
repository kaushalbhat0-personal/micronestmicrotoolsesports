// P5 tools route audit: no database, no commerce, no tracking.
// Reads the tools route sources and fails if a route can reach base tables,
// the service role, external APIs, payments/entitlements, or fabricated
// social proof. Static audit only: no network, no Supabase client.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "@/features/tools/catalog";

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

describe("P5 tools route audit — static catalogue, local execution", () => {
  it("covers the expected route surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("tools", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no database reads of any kind", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      expect(content, `${path}: rpc call`).not.toMatch(/\.rpc\(\s*["'`]/);
      expect(content, `${path}: supabase import`).not.toContain("supabase");
    }
  });

  it("uses no service-role, admin client or external fetch", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
      expect(content, `${path}: service client`).not.toMatch(
        /createServiceClient|serviceRoleClient|getServiceClient|withServiceRole/i,
      );
      expect(content, `${path}: direct client import`).not.toContain("@supabase/supabase-js");
      expect(content, `${path}: external fetch`).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("contains no payments, entitlements, pricing or tracking", () => {
    for (const { path, content } of routeSources) {
      for (const token of [
        "checkout",
        "stripe",
        "razorpay",
        "subscription",
        "entitlement",
        "testimonial",
        "analytics",
      ]) {
        expect(content, `${path}: commerce token ${token}`).not.toContain(token);
      }
      // Word-boundary patterns with a disclaimer carve-out: the runner and
      // landing explicitly say "not a payment ... or escrow" / "no custody",
      // so bare escrow/custody matches are scoped to non-disclaimer prose
      // (same precedent as P3's "Grouping" carve-out).
      expect(content, `${path}: payment flow`).not.toMatch(
        /collect\s+(payments?|fees?)|\bcheckout\b|\bupi\b|\bstripe\b|\brazorpay\b|(?<!not a )(?<!or )\bescrow\b|(?<!no )\bcustody\b/i,
      );
    }
  });

  it("renders no raw HTML and ships no fabricated social proof", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw HTML render`).not.toContain("dangerouslySetInnerHTML");
      for (const token of ["rating", "testimonial", "downloads", "trusted by"]) {
        expect(content.toLowerCase(), `${path}: social proof ${token}`).not.toContain(token);
      }
    }
  });

  it("detail route resolves only through the static registry with 404-equivalence", () => {
    const page = routeSources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getToolBySlug");
    expect(page?.content).toContain("notFound()");
  });

  it("keeps tool execution login-free and local (no server actions, no mutations)", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: server action`).not.toContain('"use server"');
      expect(content, `${path}: mutation`).not.toContain(".insert(");
      expect(content, `${path}: mutation`).not.toContain(".update(");
      expect(content, `${path}: mutation`).not.toContain(".delete(");
      expect(content, `${path}: mutation`).not.toContain(".upsert(");
    }
  });

  it("keeps the runner map in parity with the registry (P7.1, static)", () => {
    // Every "available" tool must have an explicit map entry; every map
    // entry must name a registry slug. Tool four adds one entry here and
    // fails this test until it does — no silent coming-soon regressions,
    // no orphan runners.
    const page = routeSources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    const mapBlock = /TOOL_RUNNERS[^=]*=\s*\{([\s\S]*?)\};/.exec(page?.content ?? "");
    expect(mapBlock, "TOOL_RUNNERS map literal").toBeDefined();
    const entries = [...(mapBlock?.[1] ?? "").matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1]);
    expect(new Set(entries).size, "map keys unique").toBe(entries.length);
    expect(entries.length).toBeGreaterThan(0);
    expect(page?.content).not.toMatch(/dynamic\s*\(|next\/dynamic/);
    const registrySlugs = TOOL_REGISTRY.map((tool) => tool.slug);
    const availableSlugs = TOOL_REGISTRY.filter((tool) => tool.availability === "available").map(
      (tool) => tool.slug,
    );
    for (const slug of availableSlugs) {
      expect(entries, `map covers available tool ${slug}`).toContain(slug);
    }
    for (const slug of entries) {
      expect(registrySlugs, `map entry ${slug} names a registry slug`).toContain(slug);
    }
  });
});
