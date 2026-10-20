import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import {
  CircleIqMicroChallenge,
  getMicroRead,
  type MicroRotationChoice,
} from "@/components/marketing/homepage/circle-iq-micro-challenge";

const ISLAND = "src/components/marketing/homepage/circle-iq-micro-challenge.tsx";
const LAB_SECTION = "src/components/marketing/homepage/lab-feature-section.tsx";

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/**
 * RCCF-HOMEPAGE-PLAY-MOMENT-03 — the Circle IQ micro-challenge is a tiny
 * client island with local state only. These tests pin the interaction
 * contract without touching the real Circle IQ product.
 */
describe("micro-challenge initial state", () => {
  it("renders the round prompt with three selectable positions", () => {
    const html = renderToString(<CircleIqMicroChallenge />);
    expect(html).toContain("ROUND 01");
    expect(html).toContain("Where would you rotate?");
    expect(html).toContain("YOUR MOVE");
    for (const label of ["Rotation option A", "Rotation option B", "Rotation option C"]) {
      expect(html).toContain(label);
    }
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it("reveals no result and no drill CTA before a pick", () => {
    const html = renderToString(<CircleIqMicroChallenge />);
    expect(html).not.toContain("Good read");
    expect(html).not.toContain("Different read");
    expect(html).not.toContain("Try Circle IQ");
    expect(html).not.toContain("/bgmi-lab/circle-iq");
    expect(html).toContain("Pick a position on the map");
  });
});

describe("micro-challenge reads (pure decision)", () => {
  it("treats the center rotation as the safer call", () => {
    expect(getMicroRead("B")).toBe("good");
  });

  it("treats the edge and wide routes as the different read", () => {
    const choices: MicroRotationChoice[] = ["A", "C"];
    for (const choice of choices) {
      expect(getMicroRead(choice)).toBe("different");
    }
  });
});

describe("micro-challenge result and reset contract (source-level)", () => {
  it("shows each result state with careful, non-competitive wording", () => {
    const code = sourceOf(ISLAND);
    expect(code).toContain("Good read");
    expect(code).toContain("You chose the safer rotation.");
    expect(code).toContain("Different read");
    expect(code).toContain("The stronger route was toward the center.");
    for (const banned of ["leaderboard", "streak", "accuracy", "XP", "points"]) {
      expect(code).not.toContain(banned);
    }
  });

  it("offers reset and links the result to the real drill", () => {
    const code = sourceOf(ISLAND);
    expect(code).toContain("Try again");
    expect(code).toContain("setSelected(null)");
    expect(code).toContain('href="/bgmi-lab/circle-iq"');
    expect(code).toContain("Try Circle IQ");
  });
});

describe("micro-challenge accessibility contract", () => {
  it("uses semantic buttons with pressed state and an announced result", () => {
    const code = sourceOf(ISLAND);
    expect(code).toContain("<button");
    expect(code).toContain("aria-pressed");
    expect(code).toContain('role="status"');
    expect(code).toContain("min-h-[44px]");
    expect(code).toContain("focus-visible:");
    expect(code).toContain("size-11");
  });

  it("keeps the one-h1 hierarchy and section naming intact", () => {
    const code = sourceOf(ISLAND);
    expect(code).not.toContain("<h1");
    const html = renderToString(<CircleIqMicroChallenge />);
    expect(html).toContain("Where would you rotate?");
  });
});

describe("micro-challenge client boundary", () => {
  it("is a local-state island with no product, data, or persistence imports", () => {
    const code = sourceOf(ISLAND);
    expect(code.startsWith('"use client"')).toBe(true);
    expect(code).toContain("useState");
    for (const banned of ["supabase", "fetch(", "/api/", "features/bgmi-lab", "dynamic(", "entitlement", "useRouter"]) {
      expect(code).not.toContain(banned);
    }
  });

  it("stays mounted inside the static lab teaser without changing its contract", () => {
    const teaser = sourceOf(LAB_SECTION);
    expect(teaser).toContain("CircleIqMicroChallenge");
    expect(teaser).toContain('getLabTool("circle-iq")');
    expect(teaser).toContain("Try {drill.name}");
  });
});

describe("micro-challenge motion contract", () => {
  it("reveals the result with the existing one-shot token only", () => {
    const code = sourceOf(ISLAND);
    expect(code).toContain("nest-reveal");
    expect(code).not.toContain("animate-");
    expect(code).not.toMatch(/infinite/);
    // Transform/opacity/border transitions only — never layout properties.
    expect(code).not.toMatch(/transition-\[(width|height|top|left|margin|padding)/);
    // The global reduced-motion guard neutralizes the reveal token.
    const css = sourceOf("src/styles/globals.css");
    expect(css).toContain("prefers-reduced-motion");
  });
});
