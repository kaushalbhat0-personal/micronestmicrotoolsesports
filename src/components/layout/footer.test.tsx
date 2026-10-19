import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Footer } from "./footer";

/**
 * Footer pillar discovery — grouped BGMI Lab / Tournaments / Paid Tools
 * columns derived from the Lab registry and paid-products presentation
 * source. Removed tools stay absent.
 */
describe("footer toolbox discovery", () => {
  it("links the pillar surfaces: Lab drills, tournaments, and paid tools", () => {
    const html = renderToString(<Footer />);
    for (const href of [
      "/bgmi-lab",
      "/bgmi-lab/circle-iq",
      "/bgmi-tournaments",
      "/bgmi-qualification",
      "/meta-parser",
      "/tools/sponsorship-tracking",
      "/tools/prize-pool-splitter",
      "/tools/draft-ban",
      "/tools/tie-breaker",
      "/tools/prize-payout-tracker",
      "/paid-tools",
      "/pricing",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("BGMI Lab");
    expect(html).toContain("Circle IQ");
    expect(html).toContain("Tournaments");
    expect(html).toContain("Paid Tools");
    expect(html).toContain("All Access");
  });

  it("never links removed or unreleased tools", () => {
    const html = renderToString(<Footer />);
    for (const slug of ["scrim-matchmaker", "vod-clipper", "roster-sentinel"]) {
      expect(html).not.toContain(slug);
    }
  });

  it("makes no legal/company-registration claims", () => {
    const html = renderToString(<Footer />);
    expect(html).not.toMatch(/\bprivate limited\b|\bllp\b|\bcin\b|registration (no|number)/i);
  });
});
