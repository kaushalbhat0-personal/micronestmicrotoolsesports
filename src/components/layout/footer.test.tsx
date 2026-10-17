import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Footer } from "./footer";

/**
 * Footer tool discovery — derived from the canonical toolbox source so
 * Meta-Parser and the BGMI simulator are present and removed tools stay absent.
 */
describe("footer toolbox discovery", () => {
  it("links all nine released tools including Meta-Parser, BGMI, and the Hub", () => {
    const html = renderToString(<Footer />);
    for (const href of [
      "/tools/sponsorship-tracking",
      "/tools/prize-pool-splitter",
      "/tools/draft-ban",
      "/tools/tie-breaker",
      "/tools/prize-payout-tracker",
      "/tools/tournament-roster-builder",
      "/meta-parser",
      "/bgmi-qualification",
      "/bgmi-tournaments",
    ]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Meta-Parser");
    expect(html).toContain("BGMI Qualification Simulator");
    expect(html).toContain("BGMI Tournament Hub");
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
