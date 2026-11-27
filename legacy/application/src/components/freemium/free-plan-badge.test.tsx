import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { FreePlanBadge } from "./free-plan-badge";

describe("FreePlanBadge", () => {
  it("1. renders the default Free plan text", () => {
    const html = renderToString(<FreePlanBadge />);
    expect(html).toContain("Free plan");
  });

  it("2. exposes accessible text semantics", () => {
    const html = renderToString(<FreePlanBadge />);
    // Badge renders a text-bearing span (no icon-only content).
    expect(html).toContain("<span");
    expect(html).toContain("Free plan");
  });

  it("3. accepts an optional custom label", () => {
    const html = renderToString(<FreePlanBadge label="Free available" />);
    expect(html).toContain("Free available");
    expect(html).not.toContain("Free plan");
  });
});
