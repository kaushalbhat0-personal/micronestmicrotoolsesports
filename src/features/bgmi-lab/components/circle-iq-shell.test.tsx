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
    expect(html).toContain("<svg");
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
    expect(html).toContain("Commit to this call");
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
    for (const banned of ["localStorage", "sessionStorage", "fetch(", "/api/", "analytics", "leaderboard"]) {
      expect(codeOnly).not.toContain(banned);
    }
  });
});
