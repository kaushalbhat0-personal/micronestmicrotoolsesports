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

function activeFlag(sql: string, slug: string): boolean | null {
  const row = new RegExp(`\\('${slug}',[^;]*?(true|false)\\)`, "s").exec(sql);
  if (!row) return null;
  return row[1] === "true";
}

describe("tool availability — RCCF-SPONSOR-FINAL-02", () => {
  it("fresh seeds mark only available tools active", () => {
    expect(activeFlag(seedSql, "sponsor-sentinel")).toBe(true);
    expect(activeFlag(seedSql, "prize-splitter")).toBe(true);
    expect(activeFlag(seedSql, "draft-ban")).toBe(true);
    expect(activeFlag(seedSql, "tie-breaker")).toBe(true);
    expect(activeFlag(seedSql, "scrim-matchmaker")).toBe(false);
    expect(activeFlag(seedSql, "vod-clipper")).toBe(false);
    expect(activeFlag(seedSql, "roster-sentinel")).toBe(false);
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

  it("registry keeps all seven tools with honest coming-soon flags", () => {
    // Future tools are NOT deleted — they remain as labelled teasers.
    expect(TOOLS.map((t) => t.slug).sort()).toEqual(
      ["prize-splitter", "draft-ban", "tie-breaker", "roster-sentinel", "scrim-matchmaker", "sponsor-sentinel", "vod-clipper"].sort()
    );
    const flag = new Map(TOOLS.map((t) => [t.slug, Boolean(t.comingSoon)]));
    expect(flag.get("sponsor-sentinel")).toBe(false);
    expect(flag.get("prize-splitter")).toBe(false);
    expect(flag.get("draft-ban")).toBe(false);
    expect(flag.get("tie-breaker")).toBe(false);
    expect(flag.get("scrim-matchmaker")).toBe(true);
    expect(flag.get("vod-clipper")).toBe(true);
    expect(flag.get("roster-sentinel")).toBe(true);
  });

  it("seed active set agrees with registry commercial availability", () => {
    for (const tool of TOOLS) {
      expect(activeFlag(seedSql, tool.slug)).toBe(!tool.comingSoon);
    }
  });
});
