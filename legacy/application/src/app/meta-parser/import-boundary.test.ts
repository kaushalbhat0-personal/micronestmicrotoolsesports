import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Public Facts import-boundary guard (static).
 *
 * Pages under `src/app/meta-parser/` must read exclusively through
 * `@/features/meta-parser/repositories/reads` (direct path, never the
 * barrel) with the normal RLS Supabase client. Any of the tokens below in a
 * route/component/helper file means the publication boundary is bypassed or
 * the client graph pulls server-only writer modules.
 */

const SCOPE = "src/app/meta-parser";

const FORBIDDEN_TOKENS = [
  "features/meta-parser/index", // never the barrel (co-exports the writer store)
  'from "@/features/meta-parser"', // barrel by alias, double or single quotes
  "from '@/features/meta-parser'",
  "repositories/store", // writer persistence
  "createAdminClient", // service-role: never in UI/read code
  "services/ingest", // ingestion pipeline
  "adapters/dota-2", // game adapters stay out of UI
  "adapters/registry",
  '"use client"', // Facts UI is server-rendered; interactive islands need explicit review
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("public facts import boundary", () => {
  const files = sourceFiles(join(process.cwd(), SCOPE));

  it("scans at least the expected route files", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of files) {
    const relative = file.replace(`${process.cwd()}${"/"}`, "").replace(/\\/g, "/");
    it(`${relative} respects the read boundary`, () => {
      const code = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) {
        expect(code, `${relative} must not contain ${JSON.stringify(token)}`).not.toContain(token);
      }
    });
  }

  it("every route file imports the read repository directly", () => {
    const routes = files.filter((f) => f.endsWith("page.tsx"));
    expect(routes.length).toBe(3);
    for (const file of routes) {
      const code = readFileSync(file, "utf8");
      expect(code, `${file} must read through repositories/reads`).toContain(
        "features/meta-parser/repositories/reads"
      );
    }
  });
});
