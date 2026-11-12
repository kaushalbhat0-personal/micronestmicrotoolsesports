import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Pricing leak guard (RCCF-TECHLEAK-FIX-01: F-01/F-02/F-03).
 * Raw backend errors and internal plan slugs must never reach rendered UI.
 */
const source = readFileSync(join(process.cwd(), "src/app/pricing/page.tsx"), "utf8");

describe("pricing leak guard", () => {
  it("never renders a raw backend error message", () => {
    // Server-side logging is allowed (console.error only); nothing raw may
    // be interpolated into rendered UI.
    expect(source).not.toContain("loadError");
    expect(source).not.toMatch(/\{\s*loadError\s*\}/);
    expect(source).not.toMatch(/\{\s*err\.message\s*\}/);
    expect(source).not.toMatch(/\{\s*error\.message\s*\}/);
    expect(source).not.toMatch(/\(\{loadError\}\)/);
    expect(source).toContain("Pricing is temporarily unavailable");
  });

  it("never renders internal plan slugs", () => {
    expect(source).not.toContain("missing.join");
    expect(source).not.toMatch(/missing: \{/);
    expect(source).toContain("Some pricing options are temporarily unavailable");
  });

  it("contains no developer-facing plan-architecture sentence", () => {
    expect(source).not.toContain("server-authoritative");
    expect(source).not.toMatch(/\(slug \+ billing period\)/);
    expect(source).not.toMatch(/maps to a .* plan/);
  });
});
