import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Architecture invariant: shared services must never import from a
 * game-specific adapter (adapters may depend on shared code, not vice
 * versa). Test files are exempt — fixture data is not a dependency.
 */
describe("meta-parser layering invariant", () => {
  it("services/*.ts (non-test) contain no adapters/dota-2 imports", () => {
    const servicesDir = join(__dirname);
    const violations: string[] = [];
    for (const file of readdirSync(servicesDir)) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const source = readFileSync(join(servicesDir, file), "utf8");
      if (source.includes("adapters/dota-2")) violations.push(file);
    }
    expect(violations).toEqual([]);
  });
});
