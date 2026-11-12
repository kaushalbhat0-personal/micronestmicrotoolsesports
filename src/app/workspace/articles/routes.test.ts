// P4 editorial workspace audit: presentation + validation foundation only.
// Fails if the workspace can reach base tables, the service role, or fake a
// successful publish. Static audit only: no network, no Supabase writes.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ARTICLE_WORKSPACE_DISABLED_MESSAGE } from "./actions";

const here = dirname(fileURLToPath(import.meta.url));

function listSources(): { path: string; content: string }[] {
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

const sources = listSources();

describe("P4 editorial workspace audit — presentation only, no persistence", () => {
  it("covers the list + new-draft surface", () => {
    const paths = sources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("articles", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("new", "page.tsx")))).toBe(true);
  });

  it("never fakes a successful publish", () => {
    expect(ARTICLE_WORKSPACE_DISABLED_MESSAGE).toContain("Nothing was saved");
    for (const { path, content } of sources) {
      expect(content, `${path}: fake success`).not.toMatch(/return\s*\{\s*ok:\s*true/);
    }
  });

  it("has no direct article table writes", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: mutation`).not.toContain(".insert(");
      expect(content, `${path}: mutation`).not.toContain(".update(");
      expect(content, `${path}: mutation`).not.toContain(".upsert(");
      expect(content, `${path}: delete`).not.toContain(".delete(");
      expect(content, `${path}: base table`).not.toContain("public.articles");
    }
  });

  it("exposes no author identity internals", () => {
    for (const { path, content } of sources) {
      expect(content, `${path}: identity leak`).not.toContain("author_user_id");
      expect(content, `${path}: service key`).not.toContain("SERVICE_ROLE");
    }
  });

  it("keeps publish/unpublish controls visibly disabled", () => {
    const editor = sources.find((s) => s.path.endsWith("article-draft-editor.tsx"));
    expect(editor).toBeDefined();
    expect(editor?.content).toContain("Publish (disabled)");
    expect(editor?.content).toContain("Unpublish (disabled)");
    expect(editor?.content).toContain('aria-disabled="true"');
  });
});
