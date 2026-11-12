// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import DevLayout from "./layout";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * /dev/* production boundary (RCCF-TECHLEAK-FIX-01: F-05/F-06).
 * Development renders children; production throws the Next not-found signal.
 */
describe("dev layout boundary", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("renders children outside production", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(
        <DevLayout>
          <p>dev preview</p>
        </DevLayout>,
      );
    });
    try {
      expect(host.textContent).toContain("dev preview");
    } finally {
      act(() => root.unmount());
    }
  });

  it("blocks rendering in production via the Next not-found signal", () => {
    vi.stubEnv("NODE_ENV", "production");
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    let thrown: unknown = null;
    try {
      act(() => {
        root.render(
          <DevLayout>
            <p>dev preview</p>
          </DevLayout>,
        );
      });
    } catch (error) {
      thrown = error;
    } finally {
      act(() => root.unmount());
    }
    const digest = (thrown as { digest?: string } | null)?.digest ?? String(thrown);
    // Next signals not-found via the HTTP-error fallback digest (…;404).
    expect(String(digest)).toMatch(/404/);
    expect(String(digest)).toContain("NEXT_HTTP_ERROR_FALLBACK");
    expect(host.textContent).not.toContain("dev preview");
  });

  it("keeps the production guard in source", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/app/dev/layout.tsx"), "utf8");
    expect(source).toContain('NODE_ENV === "production"');
    expect(source).toContain("notFound()");
  });
});
