// P4 News route audit: reader exclusivity for public news routes.
// Mirrors the P3 tournaments audit: reads the news route sources and fails
// if a route can reach base tables, the service role, author internals, or
// fabricated content. The gated publishing layer (server/article-writer.ts)
// is audited separately: validation-only, kill switch ON. Static audit only:
// no network, no Supabase client.

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

const writerPath = join(here, "..", "..", "features", "news", "server", "article-writer.ts");
const writerContent = readFileSync(writerPath, "utf8");

describe("P4 news route audit — Reader-only public data path", () => {
  it("covers the expected route surface", () => {
    const paths = routeSources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("news", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.includes("[slug]") && p.endsWith("page.tsx"))).toBe(true);
  });

  it("has no direct base-table reads in any route module", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw table access`).not.toMatch(/\.from\(\s*["'`]/);
      for (const table of [
        "public.articles",
        "public.article_revisions",
        "public.article_authors",
        "public.app_users",
        "public.team_members",
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

  it("exposes no author identity, ownership or moderation internals", () => {
    for (const { path, content } of routeSources) {
      for (const token of [
        "author_user_id",
        "owner_user_id",
        "created_by",
        "organization_id",
        "applicant_user_id",
      ]) {
        expect(content, `${path}: internal token ${token}`).not.toContain(token);
      }
    }
  });

  it("renders no raw HTML and ships no fabricated production content", () => {
    for (const { path, content } of routeSources) {
      expect(content, `${path}: raw HTML render`).not.toContain("dangerouslySetInnerHTML");
      expect(content, `${path}: fabricated row`).not.toMatch(
        /const\s+(ARTICLES|FEATURED|PRODUCTION_ARTICLES)\s*=/,
      );
    }
  });

  it("directory route reads only through ArticleReader.searchArticles", () => {
    const page = routeSources.find((s) => s.path.endsWith(join("news", "page.tsx")));
    expect(page).toBeDefined();
    expect(page?.content).toContain("NewsResults");
    const results = routeSources.find((s) =>
      s.path.endsWith(join("_components", "news-results.tsx")),
    );
    expect(results).toBeDefined();
    expect(results?.content).toContain("searchArticles");
    expect(results?.content).toContain("server/article-reader");
  });

  it("detail route resolves only through getArticleBySlug with 404 + unavailable states", () => {
    const page = routeSources.find((s) => s.path.includes("[slug]") && s.path.endsWith("page.tsx"));
    expect(page).toBeDefined();
    expect(page?.content).toContain("getArticleBySlug");
    expect(page?.content).toContain("server/article-reader");
    expect(page?.content).toContain("notFound()");
    expect(page?.content).toContain("NewsDirectoryOperationError");
    expect(page?.content).toContain('role="alert"');
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
    expect(writerContent).toContain("NEWS_WRITES_ENABLED: boolean = false");
  });
});
