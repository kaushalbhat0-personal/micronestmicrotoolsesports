// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { PrizeSplitterCalculator } from "./prize-splitter-calculator";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Hydration regression (RCCF F11). The WhatsApp share affordance used to
 * render nothing on the server but a button on the client, producing
 * React error #418 on every load. The mounted gate keeps the first
 * client render identical to SSR output.
 */
describe("PrizeSplitterCalculator hydration (RCCF F11)", () => {
  const errors: string[] = [];
  const originalError = console.error;

  beforeEach(() => {
    errors.length = 0;
    document.body.innerHTML = "";
    console.error = (...args: unknown[]) => {
      errors.push(String(args[0]));
    };
  });

  afterEach(() => {
    console.error = originalError;
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("hydrates SSR output without hydration errors", async () => {
    const html = renderToString(<PrizeSplitterCalculator />);
    // SSR renders no WhatsApp affordance (client-only after mount).
    expect(html).not.toContain("Share on WhatsApp");
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <PrizeSplitterCalculator />);
    });
    expect(errors.filter((e) => /hydrat/i.test(e))).toEqual([]);
    document.body.removeChild(container);
  });

  it("shows the WhatsApp affordance after mount (no lost functionality)", async () => {
    const html = renderToString(<PrizeSplitterCalculator />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    await act(async () => {
      hydrateRoot(container, <PrizeSplitterCalculator />);
    });
    expect(container.innerHTML).toContain("Share on WhatsApp");
    document.body.removeChild(container);
  });
});
