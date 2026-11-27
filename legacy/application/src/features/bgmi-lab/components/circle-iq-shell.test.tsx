import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL } from "../data/circle-iq-rounds";
import { hasLabGame, resolveLabGame } from "../games";
import { CircleIqShell } from "./circle-iq-shell";

const DEMO_MARKERS = [
  "Demo shell for the interaction boundary",
  "full mechanics arrive later",
  "Try it — pick the rotation",
  "Two sample rounds",
];

describe("circle-iq production guard — demo shell must never ship again", () => {
  const shellSrc = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-shell.tsx"), "utf8");
  const routeSrc = readFileSync(join(process.cwd(), "src/app/bgmi-lab/[slug]/page.tsx"), "utf8");
  const loaderSrc = readFileSync(join(process.cwd(), "src/features/bgmi-lab/games.tsx"), "utf8");
  const html = renderToString(<CircleIqShell />).replace(/<!--.*?-->/g, "");

  it("contains zero demo-shell copy in source or first paint", () => {
    for (const marker of DEMO_MARKERS) {
      expect(shellSrc).not.toContain(marker);
      expect(html).not.toContain(marker);
    }
    expect(routeSrc).not.toContain("Demo shell");
  });

  it("renders the V2 contract on first paint: 01/08, visual, shuffled choices, no reveal", () => {
    expect(CIRCLE_IQ_TOTAL).toBe(8);
    expect(CIRCLE_IQ_ROUNDS).toHaveLength(8);
    expect(html).toContain("ROUND 01 / 08");
    // Canvas board renderer (data-board affordance) replaces the SVG board.
    expect(html).toContain("<canvas");
    expect(html).toContain('data-board="circle-iq"');
    expect(html).toContain('role="group"');
    expect(html).toContain("Rotation options");
    // Native decision buttons with display-only letter badges. The first
    // queue round is seeded, so it may carry 2 or 3 options.
    const letters = html.match(/Option [ABC]:/g) ?? [];
    expect(letters.length).toBeGreaterThanOrEqual(2);
    expect(letters.length).toBeLessThanOrEqual(3);
    expect(html).toContain("Option A:");
    expect(html).toContain("Option B:");
    expect(html).toContain('aria-pressed="false"');
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    // Preview exists but nothing is scored or revealed before commit.
    expect(html).toContain("Lock the call");
    expect(html).not.toContain("Good read");
    expect(html).not.toContain("Riskier read");
    expect(html).not.toContain("READ THIS");
    expect(html).not.toContain("FINAL READ");
  });

  it("wires the V2 island through registry → loader → shell with ShareRow + ephemeral scoring", () => {
    expect(hasLabGame("circle-iq")).toBe(true);
    expect(resolveLabGame("circle-iq")).not.toBeNull();
    expect(routeSrc).toContain("resolveLabGame");
    expect(routeSrc).not.toContain("circle-iq-shell");
    expect(loaderSrc).toContain('"circle-iq"');
    expect(loaderSrc).toContain("circle-iq-shell");
    // V2 structural markers: 8-round data, pure logic, share on completion, no persistence.
    expect(shellSrc).toContain("CIRCLE_IQ_ROUNDS");
    expect(shellSrc).toContain("scorePick");
    expect(shellSrc).toContain("summarizeScore");
    expect(shellSrc).toContain("ShareRow");
    expect(shellSrc).toContain("Play again");
    const codeOnly = shellSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    const boardSrc = readFileSync(
      join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-board-canvas.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1");
    for (const banned of ["localStorage", "sessionStorage", "fetch(", "/api/", "analytics", "leaderboard"]) {
      expect(codeOnly).not.toContain(banned);
      expect(boardSrc, `board renderer must not contain ${banned}`).not.toContain(banned);
    }
  });
});

describe("circle-iq responsive hardening — layout contract", () => {
  const shellSrc = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-shell.tsx"), "utf8");
  const boardSrc = readFileSync(
    join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-board-canvas.tsx"),
    "utf8",
  );
  const adSafeSrc = readFileSync(
    join(process.cwd(), "src/components/marketing/bgmi-lab/ad-safe-game-layout.tsx"),
    "utf8",
  );

  it("keeps the Canvas board fluid with mobile-relief insets and no fixed widths", () => {
    // One logical coordinate space shared by every viewport width.
    expect(boardSrc).toContain("BOARD_WIDTH = 360");
    expect(boardSrc).toContain("BOARD_HEIGHT = 240");
    expect(shellSrc).toContain("CircleIqBoardCanvas");
    expect(boardSrc).toContain("h-auto w-full");
    // Mobile map relief lives inside the island (AdSafe boundary untouched).
    expect(shellSrc).toContain("-mx-1");
    expect(shellSrc).toContain("sm:mx-0");
    expect(shellSrc).toContain("px-4 sm:px-6");
    // No fixed-width, min-width, nowrap, or scrolling gameplay elements.
    for (const banned of ["w-[", "min-w-", "max-w-[", "whitespace-nowrap", "overflow-x-", "overflow:scroll"]) {
      expect(shellSrc, `gameplay must not contain ${banned}`).not.toContain(banned);
    }
  });

  it("keeps the base/sm breakpoint model with no md/lg gameplay branches", () => {
    expect(shellSrc).toContain("sm:grid-cols-2");
    expect(shellSrc).toContain("sm:px-6");
    expect(shellSrc).toContain("sm:w-auto");
    for (const bp of ["md:", "lg:", "xl:", "2xl:"]) {
      expect(shellSrc, `gameplay must not branch on ${bp}`).not.toContain(bp);
    }
  });

  it("wraps the scout row and keeps primary actions full-width on mobile", () => {
    expect(shellSrc).toContain("flex flex-wrap items-center gap-2 text-sm");
    expect(shellSrc).toContain("w-full");
    expect(shellSrc).toContain("sm:w-auto");
    expect(shellSrc).toContain("justify-center");
    expect(boardSrc).toContain('data-board="circle-iq"');
    expect(shellSrc).toContain("resolveMapTap");
  });

  it("leaves the AdSafe boundary byte-identical in behavior", () => {
    expect(adSafeSrc).toContain("p-5 sm:p-6");
    expect(adSafeSrc).toContain('data-ad-safe="game-island"');
    // "advertisement" appears only in the file's own invariant comment, so
    // the ad-marker check targets executable/embed vectors instead.
    for (const banned of ["adsbygoogle", "ca-pub", "<iframe", "ins class=", "AdSense.create"]) {
      expect(adSafeSrc, `AdSafe must not contain ${banned}`).not.toContain(banned);
    }
  });
});
