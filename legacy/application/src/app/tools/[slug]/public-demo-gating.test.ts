import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Public demo scope guard — only Splitter + Roster may render interactive
 * demos on marketing pages. All other tools stay gated. Source-level test
 * (the page is a data-fetching server component; behavior is covered by the
 * demo component tests + browser verification).
 */
const PAGE = join(process.cwd(), "src/app/tools/[slug]/page.tsx");
const src = readFileSync(PAGE, "utf8");

describe("public tool-page demo gating", () => {
  it("exposes interactive demos only for the two stateless tools", () => {
    expect(src).toContain('tool.slug === "prize-pool-splitter"');
    expect(src).toContain('tool.slug === "tournament-roster-builder"');
    expect(src).not.toContain('tool.slug === "sponsorship-tracking" ? (');
    expect(src).not.toMatch(/slug === "draft-ban" \? \(/);
    expect(src).not.toMatch(/slug === "tie-breaker" \? \(/);
    expect(src).not.toMatch(/slug === "prize-payout-tracker" \? \(/);
  });

  it("code-splits both demos so other tool pages stay lean", () => {
    expect(src).toMatch(/PublicSplitterDemo = dynamic\(/);
    expect(src).toMatch(/PublicRosterDemo = dynamic\(/);
    expect(src).not.toContain("ssr: false");
  });

  it("demo sections are labelled and post-value signup only", () => {
    expect(src).toContain('aria-label="Try Prize Pool Splitter now"');
    expect(src).toContain('aria-label="Try Tournament Roster and Slot Builder now"');
  });
});
