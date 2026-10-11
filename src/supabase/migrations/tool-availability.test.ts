import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS } from "@/config/app/tools";

const seedSql = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");
const correctiveSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251015000001_tool_availability_hardening.sql"),
  "utf8"
);
const historicalSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20250930000003_seed_tools.sql"),
  "utf8"
);
const cleanupSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20251102000001_cleanup_unreleased_tools.sql"),
  "utf8"
);

const RELEASED = ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker"];
const REMOVED = ["scrim-matchmaker", "vod-clipper", "roster-sentinel"];

function activeFlag(sql: string, slug: string): boolean | null {
  const row = new RegExp(`\\('${slug}',[^;]*?(true|false)\\)`, "s").exec(sql);
  if (!row) return null;
  return row[1] === "true";
}

describe("tool availability — RCCF-CLEANUP-02 (released-only catalog)", () => {
  it("seed represents the released catalog only", () => {
    for (const slug of RELEASED) expect(activeFlag(seedSql, slug)).toBe(true);
    for (const slug of REMOVED) expect(activeFlag(seedSql, slug)).toBe(null);
  });

  it("historical seed migration is immutable (still seeds all rows)", () => {
    for (const slug of ["sponsor-sentinel", "prize-splitter", "scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(historicalSql).toContain(`'${slug}'`);
    }
    // No tool rows were deleted or renamed.
    expect(historicalSql).toMatch(/on conflict \(slug\)/);
  });

  it("corrective migration deactivates unreleased tools deterministically", () => {
    expect(correctiveSql).toMatch(/is_active\s*=\s*false/);
    expect(correctiveSql).toMatch(/scrim-matchmaker/);
    expect(correctiveSql).toMatch(/vod-clipper/);
    expect(correctiveSql).toMatch(/roster-sentinel/);
    expect(correctiveSql).toMatch(/sponsor-sentinel/);
    expect(correctiveSql).toMatch(/prize-splitter/);
  });

  it("corrective migration hardens has_tool_access against inactive tools", () => {
    expect(correctiveSql).toMatch(/create or replace function public\.has_tool_access/);
    expect(correctiveSql).toMatch(/is_active\s*=\s*true/);
  });

  it("registry contains exactly the four released tools with no coming-soon flags", () => {
    expect(TOOLS.map((t) => t.slug).sort()).toEqual([...RELEASED].sort());
    for (const tool of TOOLS) expect(Boolean(tool.comingSoon)).toBe(false);
  });

  it("seed active set agrees with registry commercial availability", () => {
    for (const tool of TOOLS) {
      expect(activeFlag(seedSql, tool.slug)).toBe(!tool.comingSoon);
    }
  });

  it("cleanup migration deletes exactly the three unreleased slugs", () => {
    for (const slug of REMOVED) expect(cleanupSql).toContain(`'${slug}'`);
    expect(cleanupSql).toMatch(/delete from public\.tools/);
  });

  it("cleanup migration never touches released tools, plans, or orders", () => {
    expect(cleanupSql).not.toMatch(/delete from public\.plans/);
    expect(cleanupSql).not.toMatch(/delete from public\.orders/);
    expect(cleanupSql).not.toMatch(/delete from public\.payments/);
    expect(cleanupSql).not.toMatch(/delete from public\.organizations/);
    // The only destructive catalog statement targets exactly the removed slugs.
    const deletes = [...cleanupSql.matchAll(/delete from public\.tools[\s\S]*?;/gi)].map((m) => m[0]);
    expect(deletes).toHaveLength(1);
    for (const slug of REMOVED) expect(deletes[0]).toContain(`'${slug}'`);
    for (const slug of RELEASED) expect(deletes[0]).not.toContain(`'${slug}'`);
  });

  it("cleanup migration asserts the released catalog and plan count", () => {
    expect(cleanupSql).toMatch(/v_released_active != 4/);
    expect(cleanupSql).toMatch(/v_active_plans != 10/);
    expect(cleanupSql).toMatch(/v_dangling_plans/);
  });
});
