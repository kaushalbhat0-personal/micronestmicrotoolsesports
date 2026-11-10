import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prize-splitter share render guard (RCCF-TECHLEAK-FIX-01: F-04).
 * The raw decoder enum must never be interpolated into user-facing copy.
 */
const source = readFileSync(join(process.cwd(), "src/app/share/prize-splitter/page.tsx"), "utf8");

describe("prize-splitter share render guard", () => {
  it("never renders the raw decoder error code", () => {
    expect(source).not.toMatch(/Error: \{decoded\.error\}/);
    expect(source).not.toMatch(/\{decoded\.error\}/);
  });

  it("routes decode failures through the human-copy helper", () => {
    expect(source).toContain("shareLinkErrorCopy");
  });
});
