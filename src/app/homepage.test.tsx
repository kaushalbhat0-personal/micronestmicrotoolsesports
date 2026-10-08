import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { metadata } from "./page";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { MARKETING_TOOLS } from "@/config/marketing/tools";

const pageSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

describe("homepage metadata — sponsorship-first SEO", () => {
  it("title and description match the approved wording", () => {
    expect(metadata.title).toBe("Sponsorship Tracking for Esports Creators & Teams | MicroNest");
    expect(metadata.description).toBe(
      "Verify sponsor deliverables and organize proof for YouTube, Twitch and Kick creators. Plus prize splitter, draft & ban, and tie-breaker tools."
    );
  });

  it("OG/Twitter are sponsorship-first with a valid raster image route", () => {
    const og = metadata.openGraph;
    const tw = metadata.twitter;
    expect(og && typeof og === "object" && "title" in og ? og.title : "").toContain("Sponsorship Tracking");
    expect(tw && typeof tw === "object" && "title" in tw ? tw.title : "").toContain("Sponsorship Tracking");
    const images = og && typeof og === "object" && "images" in og ? (og.images as unknown[]) : [];
    expect(images.length).toBeGreaterThan(0);
    expect(JSON.stringify(images)).toContain("/opengraph-image");
    expect(JSON.stringify(images)).not.toContain(".svg");
    expect(JSON.stringify(metadata)).not.toContain("Final_MicroNest_Logo.svg");
  });
});

describe("homepage IA — sponsorship-first, no unbuilt products", () => {
  it("hero uses the approved H1 and single primary CTA (no fake trial)", () => {
    expect(pageSource).toContain("Prove every sponsor deliverable.");
    expect(pageSource).toContain("Without the spreadsheet chaos.");
    expect(pageSource).toContain("/signup?plan=sponsorship-tracking-monthly");
    expect(pageSource).toContain("Try Sponsorship Tracking");
    expect(pageSource).not.toContain("Start free trial");
    expect(pageSource).not.toContain("Scrims. Prizes.");
  });

  it("no coming-soon tool appears as a homepage product", () => {
    for (const name of ["Scrim Matchmaker", "VOD Clipper", "Roster Sentinel"]) {
      expect(pageSource).not.toContain(name);
    }
    expect(pageSource).not.toContain("Coming soon");
  });

  it("no internal T-number taxonomy leaks into the homepage", () => {
    expect(pageSource).not.toContain("tool.number");
    expect(pageSource).not.toMatch(/T0[1-7]/);
  });

  it("JSON-LD keeps Organization/WebSite and drops the bogus SearchAction", () => {
    expect(pageSource).toContain('"@type": "Organization"');
    expect(pageSource).toContain('"@type": "WebSite"');
    expect(pageSource).not.toContain("SearchAction");
    expect(pageSource).not.toContain("/tools?q=");
  });

  it("pricing teaser is catalog-derived, never hardcoded", () => {
    expect(pageSource).toContain("sponsorship-tracking-monthly");
    expect(pageSource).not.toContain("149900");
    expect(pageSource).not.toContain("₹1,499");
  });

  it("legal copy lives in footer/legal, not the hero", () => {
    expect(pageSource).not.toContain("MicroNest is a subscription software platform");
  });
});

describe("ProofStrip — illustrative workflow, never fake customer data", () => {
  it("renders the four workflow steps and the sponsor caption", () => {
    const html = renderToString(<ProofStrip />);
    for (const label of ["Campaign", "Channel", "Check", "Proof"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("This is what you send your sponsor.");
    expect(html).toContain("Illustrative example");
  });

  it("never claims to show real customer data", () => {
    const html = renderToString(<ProofStrip />);
    expect(html.toLowerCase()).not.toContain("screenshot");
    expect(html).not.toContain("Mystic");
  });
});

describe("marketing tool copy — outcome-first", () => {
  it("available tools use approved outcome descriptions", () => {
    const bySlug = new Map(MARKETING_TOOLS.map((t) => [t.slug, t.shortDescription]));
    expect(bySlug.get("sponsorship-tracking")).toBe("Know if every creator posted what the sponsor paid for");
    expect(bySlug.get("prize-pool-splitter")).toBe("Split any prize pool fairly in seconds, with a shareable result");
    expect(bySlug.get("draft-ban")).toBe("Run pick/ban drafts live with a record both teams can trust");
    expect(bySlug.get("tie-breaker")).toBe("Settle tied standings with rules everyone can see");
  });
});
