import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * Meta-Parser plain-language copy guards (RCCF-META-PARSER-UX-03).
 *
 * The patch/game/index pages are async server components bound to Supabase,
 * so user-visible label wording is pinned at the source level while
 * behavior is covered by component and repository tests.
 */
describe("meta-parser user-facing copy", () => {
  const patchPage = () => src("src/app/meta-parser/[game]/[version]/page.tsx");
  const gamePage = () => src("src/app/meta-parser/[game]/page.tsx");
  const indexPage = () => src("src/app/meta-parser/page.tsx");
  const filters = () => src("src/app/meta-parser/_components/facts-filters.tsx");
  const provenance = () => src("src/app/meta-parser/_components/provenance.tsx");

  it("presents human filter labels over unchanged URL keys (UX-07)", () => {
    expect(filters()).not.toContain("Entity type");
    expect(filters()).toContain('htmlFor="facts-category"');
    expect(filters()).toContain('htmlFor="facts-change"');
    expect(filters()).toContain('htmlFor="facts-search"');
    expect(filters()).toMatch(/>\s*What changed\?\s*</);
    expect(filters()).toMatch(/>\s*Change type\s*</);
    expect(filters()).toMatch(/>\s*Search\s*</);
    // The page itself delegates to the extracted filter component.
    expect(patchPage()).toContain("<FactsFilters");
    expect(patchPage()).not.toContain("Entity type");
  });

  it("keeps URL query keys unchanged in the filter form", () => {
    expect(filters()).toContain('name="entity_type"');
    expect(filters()).toContain('name="change_type"');
    expect(filters()).toContain('name="entity"');
  });

  it("no longer presents Revision as a primary product fact", () => {
    expect(patchPage()).not.toContain("· Revision");
    expect(patchPage()).not.toContain(">Revision");
    expect(gamePage()).not.toContain("Revision");
  });

  it("uses user-facing source wording in provenance", () => {
    expect(provenance()).toContain("Official patch notes:");
    expect(provenance()).toContain("Data:");
    expect(provenance()).not.toContain("Canonical patch source");
    expect(provenance()).not.toContain("Structured dataset");
  });

  it("uses user-facing coverage wording on the index", () => {
    expect(indexPage()).toContain("What we cover");
    expect(indexPage()).toContain("Public patch facts currently cover");
    expect(indexPage()).not.toContain("Current coverage");
    expect(indexPage()).not.toContain("public dataset");
  });
});
