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
    for (const file of ["toolbox-groups.tsx", "pillar-section.tsx", "lab-feature-section.tsx", "competition-strip.tsx", "how-it-works.tsx", "pricing-reassurance.tsx", "philosophy-section.tsx", "trust-section.tsx", "final-toolbox-cta.tsx"]) {
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
  it("uses only the restrained motion vocabulary (one-shot, transform/opacity)", () => {
    const code = allSources();
    // Allowlist: one-shot entrances + hover/focus micro-shifts only.
    const used = new Set(code.match(/nest-[a-z0-9-]+/g) ?? []);
    const allowed = new Set([
      "nest-reveal",
      "nest-reveal-delay-0",
      "nest-reveal-delay-1",
      "nest-reveal-delay-2",
      "nest-reveal-delay-3",
      "nest-reveal-delay-4",
      "nest-assemble",
      "nest-draw",
    ]);
    for (const token of used) {
      expect(allowed.has(token), `unexpected motion token: ${token}`).toBe(true);
    }
    expect(code).not.toContain("animate-");
    expect(code).not.toContain("keyframes");
    // No looping or attention-grabbing animation on the homepage.
    expect(code).not.toMatch(/infinite/);
    expect(code).not.toMatch(/animate-ping|animate-pulse|animate-bounce|animate-spin/);
    // No layout-triggering transitions (transform/opacity/border-color only).
    expect(code).not.toMatch(/transition-\[(width|height|top|left|margin|padding)/);
    const css = readFileSync(join(process.cwd(), "src/styles/globals.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion");
    // Every homepage keyframe is covered by the reduced-motion guard.
    for (const cls of [".nest-assemble", ".nest-draw"]) {
      expect(css).toContain(cls);
      const guardStart = css.indexOf("prefers-reduced-motion");
      expect(css.indexOf(cls, guardStart)).toBeGreaterThan(guardStart);
    }
  });

  it("hover and keyboard focus produce equivalent states", () => {
    const code = allSources();
    // Every hover micro-shift must have a focus-within mirror.
    const hoverShifts = code.match(/group-hover:[a-z-]+\S*/g) ?? [];
    expect(hoverShifts.length).toBeGreaterThan(0);
    for (const shift of hoverShifts) {
      const mirror = shift.replace("group-hover:", "group-focus-within:");
      expect(code, `missing keyboard mirror for ${shift}`).toContain(mirror);
    }
  });

  it("avoids fixed widths that cause horizontal overflow on mobile", () => {
    const code = allSources();
    expect(code).not.toMatch(/min-w-\[/);
    expect(code).not.toMatch(/w-\[\d+px\]/);
  });

  it("cards remain understandable without hover (motion only, never content)", () => {
    const code = allSources();
    // Hover/focus may shift, tint, or nudge — never reveal, hide, or swap content.
    expect(code).not.toContain("hover:opacity-0");
    expect(code).not.toContain("group-hover:opacity-0");
    expect(code).not.toContain("focus-within:opacity-0");
    expect(code).not.toMatch(/group-hover:(hidden|block|flex|grid|invisible|sr-only)/);
    expect(code).not.toMatch(/group-focus-within:(hidden|block|flex|grid|invisible|sr-only)/);
    expect(code).not.toMatch(/hover:(hidden|block)/);
  });
});
