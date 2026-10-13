import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PublicSplitterDemo } from "./public-splitter-demo";
import { calculateSplit, validateInput } from "../services/calculation";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("PublicSplitterDemo (anonymous hands-on demo)", () => {
  it("renders demo framing before any signup gate", () => {
    const html = rendered(<PublicSplitterDemo />);
    expect(html).toContain("Try it now");
    expect(html).toContain("no signup needed");
    expect(html).toMatch(/prize pool/i);
    expect(html).toContain("Loading interactive demo");
    expect(html).toContain('href="/signup"');
  });

  it("offers signup only as post-value conversion, never a wall", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/prize-splitter/components/public-splitter-demo.tsx"), "utf8");
    expect(src).not.toMatch(/modal|dialog|wall|requireAuth|requireUser|redirect/i);
    expect(src).toContain("Create a free account");
    const html = rendered(<PublicSplitterDemo />);
    expect(html).toContain("Create a free account");
  });

  it("reuses the canonical calculator and domain logic (no parallel algorithm)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/prize-splitter/components/public-splitter-demo.tsx"), "utf8");
    expect(src).toContain("./prize-splitter-calculator");
    expect(src).not.toContain("calculateSplit(");
    // Canonical logic handles the demo scenario: ₹50,000 across 50/30/20.
    const input = {
      prizePool: 50000,
      currency: "INR" as const,
      method: "percentage" as const,
      placements: [
        { label: "1st", percentage: 50 },
        { label: "2nd", percentage: 30 },
        { label: "3rd", percentage: 20 },
      ],
    };
    expect(validateInput(input).valid).toBe(true);
    const result = calculateSplit(input);
    expect(result.totalDistributed).toBe(50000);
    expect(result.totalDistributedMinor).toBe(50000 * 100);
    // Invalid input remains safely rejected by the same canonical rules.
    expect(validateInput({ ...input, prizePool: 0 }).valid).toBe(false);
  });

  it("introduces no persistence, entitlement, or billing behavior", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/features/prize-splitter/components/public-splitter-demo.tsx"), "utf8");
    expect(src).not.toMatch(/supabase|localStorage|entitlement|claimFree|checkout|razorpay|organizationId/i);
  });
});
