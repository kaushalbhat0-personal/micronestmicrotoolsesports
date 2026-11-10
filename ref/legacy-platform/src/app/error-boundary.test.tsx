// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import GlobalError from "./error";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderError(error: Error, reset: () => void) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<GlobalError error={error} reset={reset} />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

/**
 * Global error boundary (RCCF-TECHLEAK-FIX-01: F-08/F-09).
 * Static humanized state; raw exception text never rendered; retry works.
 */
describe("global error boundary", () => {
  it("renders static copy and never the raw exception text", () => {
    const { host, unmount } = renderError(new Error("Supabase explode: secret-db-42"), vi.fn());
    try {
      expect(host.textContent).not.toContain("secret-db-42");
      expect(host.textContent).not.toContain("Supabase explode");
      expect(host.textContent).not.toContain("Something went wrong");
      expect(host.textContent).not.toContain("unexpected");
      expect(host.textContent).toMatch(/snag/i);
      expect(host.textContent).toMatch(/Try again/);
    } finally {
      unmount();
    }
  });

  it("retry invokes reset", () => {
    const reset = vi.fn();
    const { host, unmount } = renderError(new Error("boom"), reset);
    try {
      const button = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Try again"))!;
      expect(button).toBeDefined();
      act(() => {
        button.click();
      });
      expect(reset).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });
});
