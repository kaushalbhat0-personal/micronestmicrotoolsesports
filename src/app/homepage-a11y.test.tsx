import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const HOMEPAGE_DIR = "src/components/marketing/homepage";

const FILES = readdirSync(join(process.cwd(), HOMEPAGE_DIR)).filter((f) => f.endsWith(".tsx"));

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), HOMEPAGE_DIR, file), "utf8");
}

function allSources(): string {
  return FILES.map(sourceOf).join("\n");
}

/**
 * Homepage responsive/accessibility contract (source-level).
 * Behavioral a11y (focus rings, skip link, reduced motion) reuses the
 * existing design-system primitives and global guards — these tests pin that
 * the new IA does not regress them and meets touch-target minimums.
 */
describe("homepage heading hierarchy", () => {
  it("has exactly one h1 (hero) and h2-led sections", () => {
    const h1Files = FILES.filter((f) => sourceOf(f).includes("<h1"));
    expect(h1Files).toEqual(["toolbox-hero.tsx"]);
    for (const file of ["toolbox-groups.tsx", "intelligence-section.tsx", "demo-section.tsx", "how-it-works.tsx", "pricing-reassurance.tsx", "philosophy-section.tsx", "final-toolbox-cta.tsx"]) {
      expect(sourceOf(file)).toContain("<h2");
    }
  });

  it("sections expose accessible names", () => {
    for (const file of FILES) {
      const code = sourceOf(file);
      expect(code, file).toMatch(/aria-labelledby="[^"]+"|aria-label="[^"]+"/);
    }
  });
});

describe("homepage touch targets and keyboard support", () => {
  it("uses no sub-44px interactive sizes", () => {
    expect(allSources()).not.toMatch(/h-8\b/);
  });

  it("every CTA meets the 44px minimum", () => {
    for (const file of FILES) {
      const code = sourceOf(file);
      if (code.includes("href=")) {
        expect(code, file).toContain("min-h-[44px]");
      }
    }
  });

  it("every link keeps a visible focus state", () => {
    for (const file of FILES) {
      const code = sourceOf(file);
      if (code.includes("href=")) {
        expect(code, file).toContain("focus-visible:");
      }
    }
  });
});

describe("homepage motion and layout safety", () => {
  it("adds no custom animation (reduced-motion guard stays global)", () => {
    const code = allSources();
    expect(code).not.toContain("nest-reveal");
    expect(code).not.toContain("animate-");
    expect(code).not.toContain("keyframes");
    const css = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("avoids fixed widths that cause horizontal overflow on mobile", () => {
    const code = allSources();
    expect(code).not.toMatch(/min-w-\[/);
    expect(code).not.toMatch(/w-\[\d+px\]/);
  });

  it("cards remain understandable without hover (no hover-only content)", () => {
    const code = allSources();
    expect(code).not.toContain("group-hover:");
    expect(code).not.toContain("hover:opacity-0");
  });
});
