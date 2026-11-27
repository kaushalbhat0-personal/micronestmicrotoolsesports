import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BgmiSeasonCampaignPage, { metadata } from "./page";

describe("FRAGIX identity-first campaign landing (C1C)", () => {
  const html = renderToStaticMarkup(<BgmiSeasonCampaignPage />);

  it("leads with identity CTA and real auth/discovery routes", () => {
    expect(html).toContain("Your game. Your identity. Your FRAGIX.");
    expect(html).toContain("Create your player card");
    expect(html).toContain("Create your FRAGIX identity");
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/players"');
    expect(html).toContain('href="/teams"');
  });

  it("distinguishes share from ownership review and registry", () => {
    expect(html.toLowerCase()).toContain("does not require ownership review");
    expect(html.toLowerCase()).toContain("registry discoverability");
    expect(html.toLowerCase()).toContain("ownership review is not registration");
    expect(html.toLowerCase()).not.toContain("every player is verified");
    expect(html.toLowerCase()).not.toContain("nothing is verified");
  });

  it("keeps unofficial framing and secondary tools strip", () => {
    expect(html.toLowerCase()).toContain("unofficial community campaign");
    expect(html.toLowerCase()).toContain("not affiliated");
    expect(html.toLowerCase()).not.toMatch(/sponsored by krafton/i);
    expect(html.toLowerCase()).not.toMatch(/\bofficial pmgc\b/);
    expect(html).toContain("/tools/prize-pool-splitter");
    expect(html).toContain("/tools/roster-slot-builder");
    expect(html).toContain("/tools/tiebreak-qualifier");
  });

  it("labels specimen card honestly with no fabricated stats", () => {
    expect(html).toContain("Illustrative specimen");
    expect(html).toContain("@demo_player");
    expect(html.toLowerCase()).not.toContain("testimonial");
    expect(html).not.toMatch(/\d{2,}\s*(players|downloads|users)/i);
  });

  it("keeps noindex metadata and FRAGIX social copy", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.title).toBe("Create Your Player Card");
    expect(String(metadata.description)).toContain("FRAGIX");
    expect(metadata.openGraph?.title).toContain("FRAGIX");
  });
});
