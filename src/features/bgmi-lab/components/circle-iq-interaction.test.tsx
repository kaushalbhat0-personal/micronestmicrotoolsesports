// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CircleIqShell } from "./circle-iq-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderShell() {
  stubMatchMedia(false);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<CircleIqShell />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

function optionButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('div[role="group"][aria-label="Rotation options"] button')];
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
}

function click(el: HTMLElement) {
  act(() => {
    el.click();
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("circle-iq V3 interaction — preview before commit", () => {
  it("disables commit before any preview and previews without scoring or revealing", () => {
    const { host, unmount } = renderShell();
    try {
      const commit = findButton(host, "Commit to this call");
      expect(commit).toBeDefined();
      expect(commit!.disabled).toBe(true);

      click(optionButtons(host)[0]!);
      expect(optionButtons(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      expect(findButton(host, "Commit to this call")!.disabled).toBe(false);
      // Preview caption appears, but nothing is scored or revealed.
      expect(host.textContent).toContain("PREVIEW");
      expect(host.textContent).not.toContain("Good read");
      expect(host.textContent).not.toContain("Riskier read");
      expect(host.textContent).not.toContain("CONSEQUENCE");
      expect(host.textContent).toContain("0 GOOD READS");
    } finally {
      unmount();
    }
  });

  it("switching preview never scores and never locks", () => {
    const { host, unmount } = renderShell();
    try {
      const options = optionButtons(host);
      click(options[0]!);
      if (options.length > 1) click(options[1]!);
      const pressed = options.map((o) => o.getAttribute("aria-pressed"));
      expect(pressed.filter((p) => p === "true")).toHaveLength(1);
      expect(options.every((o) => !o.disabled)).toBe(true);
      expect(host.textContent).toContain("0 GOOD READS");
      expect(host.textContent).not.toContain("Why:");
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V3 interaction — commit then consequence then verdict", () => {
  it("shows consequence first and verdict only after the beat", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(optionButtons(host)[0]!);
      click(findButton(host, "Commit to this call")!);
      // Consequence state is visible; the verdict is not.
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).not.toContain("Why:");
      expect(optionButtons(host).every((o) => o.disabled)).toBe(true);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toContain("Why:");
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).toContain("READ THIS");
    } finally {
      unmount();
    }
  });

  it("scores exactly once and reflects the committed option id", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(optionButtons(host)[0]!);
      click(findButton(host, "Commit to this call")!);
      // Locked: further taps cannot change the pick.
      click(optionButtons(host)[0]!);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const good = host.textContent?.includes("Good read") ?? false;
      expect(host.textContent).toContain(good ? "1 GOOD READ" : "0 GOOD READS");
      expect(findButton(host, "Commit to this call")).toBeUndefined();
    } finally {
      unmount();
    }
  });

  it("resolves the final consequence frame under reduced motion", () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<CircleIqShell />);
    });
    try {
      click(optionButtons(host)[0]!);
      click(findButton(host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(host.textContent).toContain("Why:");
      expect(host.textContent).toMatch(/Good read|Riskier read/);
    } finally {
      act(() => root.unmount());
    }
  });
});

describe("circle-iq V3 interaction — full run on buttons alone, then replay", () => {
  it("completes 8 rounds with keyboard-operable buttons only, then reseeds on play again", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      for (let round = 1; round <= 8; round++) {
        click(optionButtons(host)[0]!);
        click(findButton(host, "Commit to this call")!);
        act(() => {
          vi.advanceTimersByTime(800);
        });
        const next = findButton(host, round < 8 ? "Next round" : "See result");
        expect(next, `round ${round} advances`).toBeDefined();
        click(next!);
      }
      expect(host.textContent).toContain("FINAL READ");
      expect(host.textContent).toMatch(/\d \/ 8/);
      expect(host.textContent).toContain("SHARE YOUR RESULT");
      expect(host.textContent).toContain("YOUR TENDENCY");
      expect(host.textContent).toContain("New order, same 8 calls");
      click(findButton(host, "Play again")!);
      expect(host.textContent).toContain("ROUND 01 / 08");
      expect(host.textContent).not.toContain("FINAL READ");
      expect(host.textContent).toContain("0 GOOD READS");
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V3 safety regressions", () => {
  it("keeps the island free of storage, network, ads, billing, and claim language", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const base = join(process.cwd(), "src/features/bgmi-lab");
    for (const file of ["components/circle-iq-shell.tsx", "data/circle-iq-logic.ts", "data/circle-iq-rounds.ts"]) {
      const code = strip(readFileSync(join(base, file), "utf8"));
      for (const banned of [
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "fetch(",
        "XMLHttpRequest",
        "analytics",
        "leaderboard",
        "adsbygoogle",
        "ca-pub",
        "dodopayments",
        "razorpay",
        "billing",
        "entitlement",
      ]) {
        expect(code, `${file} must not contain ${banned}`).not.toContain(banned);
      }
    }
    const shell = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-shell.tsx"), "utf8");
    for (const marker of ["Demo shell", "full mechanics arrive later", "Try it — pick the rotation"]) {
      expect(shell).not.toContain(marker);
    }
  });
});
