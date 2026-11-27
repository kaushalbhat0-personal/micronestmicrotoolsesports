import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PublicRosterDemo } from "./public-roster-demo";
import { SAMPLE_ROSTER_INPUT } from "./roster-input";
import { parseRosterText } from "../services/parser";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("PublicRosterDemo (anonymous hands-on demo)", () => {
  it("renders interactive controls before any signup gate", () => {
    const html = rendered(<PublicRosterDemo />);
    expect(html).toContain("Try it now");
    expect(html).toContain("no signup needed");
    expect(html).toContain('id="roster-paste"');
    expect(html).toContain("Load sample");
    expect(html).toContain('href="/signup"');
  });

  it("offers signup only as post-value conversion, never a wall", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/roster-builder/components/public-roster-demo.tsx"), "utf8");
    expect(src).not.toMatch(/modal|dialog|wall|requireAuth|requireUser|redirect/i);
    expect(src).toContain("Create a free account");
  });

  it("reuses the canonical workspace and parser (no parallel algorithm)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/roster-builder/components/public-roster-demo.tsx"), "utf8");
    expect(src).toContain("./roster-builder-workspace");
    expect(src).not.toContain("parseRosterText(");
    // Canonical parser handles the supported sample input the demo offers.
    const parsed = parseRosterText(SAMPLE_ROSTER_INPUT);
    expect(parsed.ok).toBe(true);
  });

  it("introduces no persistence of any kind", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of [
      "src/features/roster-builder/components/public-roster-demo.tsx",
      "src/features/roster-builder/components/roster-builder-workspace.tsx",
    ]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src).not.toMatch(/supabase|localStorage|sessionStorage|document\.cookie|entitlement|claimFree|organizationId/i);
    }
  });
});
