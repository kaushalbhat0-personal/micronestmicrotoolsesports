import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { metadata } from "./page";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { MARKETING_TOOLS } from "@/config/marketing/tools";

const pageSource = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

const HOMEPAGE_DIR = "src/components/marketing/homepage";

function homepageComponentSources(): string {
  return readdirSync(join(process.cwd(), HOMEPAGE_DIR))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(process.cwd(), HOMEPAGE_DIR, f), "utf8"))
    .join("\n");
}

function homepageAndFooterSources(): string {
  return (
    pageSource +
    "\n" +
    homepageComponentSources() +
    "\n" +
    readFileSync(join(process.cwd(), "src/components/layout/footer.tsx"), "utf8")
  );
}

describe("homepage metadata — toolbox-first SEO", () => {
  it("title identifies the toolbox, not a single tool", () => {
    expect(metadata.title).toEqual({ absolute: "MicroNest — The Toolbox Behind Esports" });
    expect(JSON.stringify(metadata.title)).not.toContain("Sponsorship Tracking");
    expect(JSON.stringify(metadata.title)).not.toContain("Meta-Parser");
  });

  it("description is toolbox-first and never single-tool-first", () => {
    expect(metadata.description).toBe(
      "MicroNest is the toolbox behind esports — small, focused tools for tournament operations, sponsorships, payouts, rosters, and public patch intelligence. Every workspace tool starts free."
    );
    const description = String(metadata.description);
    expect(description.toLowerCase()).toContain("toolbox behind esports");
    expect(description.toLowerCase()).toContain("public patch intelligence");
    // Sponsorship/Meta-Parser may appear as ecosystem members, never the lead.
    expect(description.slice(0, 60)).not.toMatch(/sponsor|meta-parser/i);
  });

  it("canonical URL is correct", () => {
    expect(metadata.alternates?.canonical).toBe("/");
  });

  it("OG/Twitter are toolbox-first with a valid raster image route", () => {
    const og = metadata.openGraph;
    const tw = metadata.twitter;
    expect(og && typeof og === "object" && "title" in og ? og.title : "").toContain("Toolbox Behind Esports");
    expect(tw && typeof tw === "object" && "title" in tw ? tw.title : "").toContain("Toolbox Behind Esports");
    expect(JSON.stringify(og)).not.toContain("Sponsorship Tracking");
    expect(JSON.stringify(tw)).not.toContain("Sponsorship Tracking");
    const images = og && typeof og === "object" && "images" in og ? (og.images as unknown[]) : [];
    expect(images.length).toBeGreaterThan(0);
    expect(JSON.stringify(images)).toContain("/opengraph-image");
    expect(JSON.stringify(images)).not.toContain(".svg");
    expect(JSON.stringify(metadata)).not.toContain("Final_MicroNest_Logo.svg");
  });
});

describe("homepage IA — toolbox-first, no single-tool dominance", () => {
  it("renders sections in the approved toolbox order", () => {
    const order = [
      "ToolboxHero",
      "ToolboxGroups",
      "IntelligenceSection",
      "DemoSection",
      "HowItWorks",
      "PricingReassurance",
      "PhilosophySection",
      "FinalToolboxCTA",
    ];
    const positions = order.map((name) => pageSource.indexOf(`<${name}`));
    for (const [i, name] of order.entries()) {
      expect(positions[i], name).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  it("hero is the toolbox itself — tagline H1, toolbox CTAs, no single-tool lead", () => {
    const hero = readFileSync(join(process.cwd(), "src/components/marketing/homepage/toolbox-hero.tsx"), "utf8");
    expect(hero).toContain("The toolbox behind esports.");
    expect(hero).toContain("<h1");
    expect(hero).toContain("Explore the toolbox");
    expect(hero).toContain('href="/tools"');
    expect(hero).toContain("Try a tool without signup");
    expect(hero).toContain('href="/tools/prize-pool-splitter"');
    expect(hero).not.toContain("Sponsorship Tracking");
    expect(hero).not.toContain("Meta-Parser");
    expect(hero).not.toContain("Start free trial");
  });

  it("no single tool dominates homepage narrative or conversion", () => {
    const code = homepageAndFooterSources();
    expect(code).not.toContain("Prove every sponsor deliverable.");
    expect(code).not.toContain("Featured • Available now");
    expect(code).not.toContain("Start with Sponsorship Tracking");
    expect(code).not.toContain("Prove it. Send it. Get renewed.");
    expect(code).not.toContain("/signup?plan=sponsorship-tracking-monthly");
    expect(code).not.toContain("Start tracking sponsors");
    expect(code).not.toContain("Featured tool");
    expect(code).not.toContain("Primary tool");
    expect(code).not.toContain("Best tool");
  });

  it("final CTA is neutral and points at the toolbox", () => {
    const cta = readFileSync(join(process.cwd(), "src/components/marketing/homepage/final-toolbox-cta.tsx"), "utf8");
    expect(cta).toContain("Find the tool for the job.");
    expect(cta).toContain("Explore the toolbox");
    expect(cta).toContain('href="/tools"');
    expect(cta).not.toContain("Sponsorship");
    expect(cta).not.toContain("Meta-Parser");
    expect(cta).not.toContain("signup?plan=");
  });

  it("no coming-soon or removed tool appears as a homepage product", () => {
    const code = homepageAndFooterSources();
    for (const name of ["Scrim Matchmaker", "VOD Clipper", "Roster Sentinel"]) {
      expect(code).not.toContain(name);
    }
    expect(code).not.toContain("scrim-matchmaker");
    expect(code).not.toContain("vod-clipper");
    expect(code).not.toContain("roster-sentinel");
    expect(code).not.toContain("Coming soon");
  });

  it("no internal T-number taxonomy leaks into the homepage", () => {
    const code = homepageAndFooterSources();
    expect(code).not.toContain("tool.number");
    expect(code).not.toMatch(/T0[1-7]/);
  });

  it("JSON-LD keeps Organization/WebSite (+ ItemList) and drops the bogus SearchAction", () => {
    // Types are emitted by builders in `@/lib/marketing/homepage-seo` —
    // page source wires them instead of hardcoding JSON.
    expect(pageSource).toContain("buildHomepageOrganizationJsonLd");
    expect(pageSource).toContain("buildHomepageWebsiteJsonLd");
    expect(pageSource).toContain("buildHomepageItemListJsonLd");
    expect(pageSource).not.toContain("SearchAction");
    expect(pageSource).not.toContain("/tools?q=");
  });

  it("homepage carries no sponsorship pricing story and no invented prices", () => {
    const code = homepageAndFooterSources();
    expect(code).not.toContain("listActivePlans");
    expect(code).not.toContain("sponsorship-tracking-monthly");
    expect(code).not.toContain("149900");
    expect(code).not.toContain("₹1,499");
    expect(code).not.toContain("Starting at");
  });

  it("Meta-Parser is never framed as a subscription on the homepage", () => {
    const stripComments = (code: string) =>
      code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const intelligence = stripComments(
      readFileSync(join(process.cwd(), "src/components/marketing/homepage/intelligence-section.tsx"), "utf8")
    );
    expect(intelligence).not.toMatch(/subscri/i);
    expect(intelligence).not.toContain("Get Meta-Parser");
    expect(intelligence).not.toContain("Start Meta-Parser");
    expect(intelligence).not.toContain("/pricing");
    expect(intelligence).not.toContain("/signup");
    const pricing = readFileSync(
      join(process.cwd(), "src/components/marketing/homepage/pricing-reassurance.tsx"),
      "utf8"
    );
    expect(pricing).toContain("never needs a plan");
    expect(pricing).not.toContain("Meta-Parser subscription");
  });

  it("Meta-Parser makes no AI/prediction/coaching claims on the homepage", () => {
    // Strip comments: several components document what they must NOT claim.
    const code = homepageAndFooterSources()
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .toLowerCase();
    for (const claim of ["ai prediction", "ai copilot", "coaching", "guaranteed competitive", "win-rate", "win rate"]) {
      expect(code).not.toContain(claim);
    }
  });

  it("demos make no false persistence claims", () => {
    const demo = readFileSync(join(process.cwd(), "src/components/marketing/homepage/demo-section.tsx"), "utf8");
    expect(demo).toContain("Nothing is saved");
    expect(demo).not.toMatch(/save your work|saved to your workspace/i);
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
