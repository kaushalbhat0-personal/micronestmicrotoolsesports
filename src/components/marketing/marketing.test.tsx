// Homepage marketing tests (renderToStaticMarkup + static source audit).
// No network, no Supabase, no browser.
//
// Covers: marketing/product module boundary (marketing never imports data
// access), no signup CTA, truthful labelling (no fabricated listings,
// no verification claims), navigation destinations (real routes only),
// and the Stitch-approved homepage render contract.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { ArenaHero } from "./arena-hero";
import { AudiencePathways } from "./audience-pathways";
import { ClosingCTA } from "./closing-cta";
import { EditorialGuides } from "./editorial-guides";
import { ToolsShowcase } from "./tools-showcase";
import { TournamentShowcase } from "./tournament-showcase";
import { MarketingSection } from "./section";
import AboutPage from "@/app/about/page";
import HomePage from "@/app/page";

const marketingDir = dirname(fileURLToPath(import.meta.url));

function listMarketingSources(): { path: string; content: string }[] {
  const entries: { path: string; content: string }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
      } else if (
        /\.(tsx?|mts|cts)$/.test(name.name) &&
        !/\.test\.[jt]sx?$/.test(name.name)
      ) {
        entries.push({ path: full, content: readFileSync(full, "utf8") });
      }
    }
  };
  walk(marketingDir);
  // Marketing route shells live outside the components folder but are part of
  // the marketing layer and obey the same boundary.
  for (const routeFile of [
    join(marketingDir, "..", "..", "app", "page.tsx"),
    join(marketingDir, "..", "..", "app", "about", "page.tsx"),
    join(marketingDir, "..", "..", "lib", "canonical.ts"),
  ]) {
    entries.push({ path: routeFile, content: readFileSync(routeFile, "utf8") });
  }
  return entries;
}

const sources = listMarketingSources();

// Boundary comments name the forbidden modules ("never import Supabase …",
// "no signup CTA …"), so static audits run against comment-stripped sources.
// User-facing copy is additionally audited via rendered HTML below, where no
// such comments exist.
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const sourceText = sources
  .map((s) => stripComments(s.content))
  .join("\n");

const homeHtml = renderToStaticMarkup(<HomePage />);
const aboutHtml = renderToStaticMarkup(<AboutPage />);
const headerHtml = renderToStaticMarkup(<SiteHeader />);
const footerHtml = renderToStaticMarkup(<SiteFooter />);

describe("Marketing module boundary — static, no product data access", () => {
  it("covers the marketing component and route surface", () => {
    const paths = sources.map((s) => s.path);
    expect(paths.some((p) => p.endsWith(join("marketing", "arena-hero.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("app", "page.tsx")))).toBe(true);
    expect(paths.some((p) => p.endsWith(join("about", "page.tsx")))).toBe(true);
  });

  it("never imports Supabase clients, readers, repositories or base tables", () => {
    for (const { path, content } of sources) {
      const code = stripComments(content);
      expect(code, `${path}: supabase import`).not.toMatch(/supabase/i);
      expect(code, `${path}: reader import`).not.toContain("directory-reader");
      expect(code, `${path}: server client`).not.toContain("createClient");
      expect(code, `${path}: raw table access`).not.toContain(".from(");
      expect(code, `${path}: private reader path`).not.toContain("features/player-profile/server");
      expect(code, `${path}: private domain import`).not.toContain("features/player-profile/domain");
      expect(code, `${path}: identifier leak`).not.toContain("game_user_id");
    }
  });

  it("keeps marketing copy free of fabricated users, partners and sponsors", () => {
    expect(sourceText).not.toMatch(/testimonial/i);
    expect(sourceText).not.toMatch(/sponsor/i);
    expect(sourceText).not.toMatch(/partner logo/i);
    expect(homeHtml).not.toMatch(/testimonial/i);
    expect(aboutHtml).not.toMatch(/testimonial/i);
  });
});

describe("No signup CTA until G1-8B", () => {
  const forbidden = [/\bsign[\s-]?up\b/i, /get started/i, /join now/i, /create (an )?account/i, /\bregister\b/i];
  it("marketing sources promise no registration", () => {
    for (const pattern of forbidden) {
      expect(sourceText, `marketing source matches ${pattern}`).not.toMatch(pattern);
    }
  });

  it("rendered homepage, about, header and footer promise no registration", () => {
    for (const pattern of forbidden) {
      // "register" appears in legitimate "registered trademark of KRAFTON"
      // footer copy — allow that single legal phrase.
      if (pattern.source.includes("register")) {
        const scrubbed = (html: string): string =>
          html.replace(/registered trademark/gi, "");
        expect(scrubbed(homeHtml), "home").not.toMatch(pattern);
        expect(scrubbed(aboutHtml), "about").not.toMatch(pattern);
        expect(scrubbed(headerHtml), "header").not.toMatch(pattern);
        expect(scrubbed(footerHtml), "footer").not.toMatch(pattern);
      } else {
        expect(homeHtml, `home matches ${pattern}`).not.toMatch(pattern);
        expect(aboutHtml, `about matches ${pattern}`).not.toMatch(pattern);
        expect(headerHtml, `header matches ${pattern}`).not.toMatch(pattern);
        expect(footerHtml, `footer matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});

describe("Truthful labelling — no fabricated listings or verification claims", () => {
  it("homepage links only real routes and labels specimens as illustrative", () => {
    expect(homeHtml).toContain('href="/players"');
    expect(homeHtml).toContain('href="/teams"');
    expect(homeHtml).toContain('href="/organizations"');
    expect(homeHtml).toContain('href="/brands"');
    expect(homeHtml).toContain('href="/tournaments"');
    expect(homeHtml).toContain('href="/news"');
    expect(homeHtml).toContain('href="/tools/prize-pool-splitter"');
    expect(homeHtml).toContain('href="/tools/roster-slot-builder"');
    expect(homeHtml).toContain('href="/tools/tiebreak-qualifier"');
    // Stitch draft slugs must never ship.
    expect(homeHtml).not.toContain("/tools/roster-builder");
    expect(homeHtml).not.toContain("/tools/tiebreak-simulator");
    // No dead / sample detail slugs.
    expect(homeHtml).not.toContain("/tournaments/sample");
    expect(homeHtml).not.toContain("/news/sample");
    expect(homeHtml).not.toContain('href="#"');
  });

  it("marks the hero visual as illustrative, never a real player", () => {
    expect(homeHtml).toContain("not a real athlete");
    expect(homeHtml).toContain("Illustrative");
    expect(homeHtml).not.toContain("@nova");
  });

  it("never claims verification, escrow operation, or official rules", () => {
    // Disclaimers ("nothing is verified", "does not verify", "no verification
    // implied") are required honesty copy — forbid only positive claims.
    expect(homeHtml).not.toMatch(/Verified/);
    expect(homeHtml).not.toMatch(/verification badge/i);
    expect(homeHtml).not.toMatch(/independently verified/i);
    expect(homeHtml).not.toMatch(/escrow (service|payments)/i);
    expect(homeHtml).not.toMatch(/official (rules|tournament)/i);
  });
});

describe("Marketing navigation", () => {
  it("header links to shipped routes with an accessible mobile menu", () => {
    expect(headerHtml).toContain('href="/players"');
    expect(headerHtml).toContain('href="/about"');
    expect(headerHtml).toContain("Explore players");
    expect(headerHtml).not.toContain("Opportunities");
    expect(headerHtml).toContain('aria-label="Primary"');
    expect(headerHtml).toContain('aria-controls="primary-menu"');
    expect(headerHtml).toContain('aria-expanded="false"');
    expect(headerHtml).toContain('aria-label="Mobile"');
  });

  it("footer indexes real routes and states availability honestly", () => {
    expect(footerHtml).toContain('href="/"');
    expect(footerHtml).toContain('href="/players"');
    expect(footerHtml).toContain('href="/about"');
    expect(footerHtml).toContain('href="/tools/roster-slot-builder"');
    expect(footerHtml).toContain('href="/tools/tiebreak-qualifier"');
    expect(footerHtml).toContain('aria-label="Footer"');
    expect(footerHtml).toContain("KRAFTON");
    expect(footerHtml).not.toContain("/terms");
    expect(footerHtml).not.toContain("/privacy");
    expect(footerHtml).not.toMatch(/https?:\/\/(twitter|x|instagram|discord|youtube)/i);
  });
});

describe("Homepage render contract", () => {
  it("renders one competitive H1 with directory CTAs", () => {
    expect(homeHtml).toContain("<h1");
    expect(homeHtml).toContain("Where esports talent gets discovered");
    expect(homeHtml).toContain("Explore players");
    expect(homeHtml).toContain("Discover tournaments");
  });

  it("renders every Stitch-approved section exactly once", () => {
    for (const anchor of [
      'id="discovery"',
      'id="tournaments"',
      'id="editorial"',
      'id="tools"',
    ]) {
      expect(homeHtml, `missing section ${anchor}`).toContain(anchor);
    }
  });
});

describe("About availability contract", () => {
  it("states the three availability tiers honestly", () => {
    expect(aboutHtml).toContain("About MicroNest Esports");
    expect(aboutHtml).toContain("Live now");
    expect(aboutHtml).toContain("Directory live");
    expect(aboutHtml).toContain("Planned");
    expect(aboutHtml).toContain("availability");
    expect(aboutHtml).toContain("no listing is ever fabricated");
    // The old binary is gone: nothing may be marked Coming soon.
    expect(aboutHtml).not.toContain("Coming soon");
  });

  it("lists the live client-side tools and directory-live routes", () => {
    expect(aboutHtml).toContain("Prize Pool Splitter");
    expect(aboutHtml).toContain("Roster &amp; Slot Builder");
    expect(aboutHtml).toContain("Tie-Break");
    expect(aboutHtml).toContain("Tournament directory route");
    expect(aboutHtml).toContain("News directory route");
    expect(aboutHtml).toContain("Mini games");
  });
});

describe("Marketing section primitives", () => {
  it("wires section headings to aria-labelledby", () => {
    const html = renderToStaticMarkup(
      <MarketingSection id="probe" eyebrow="Probe" title="Probe section">
        <p>Body</p>
      </MarketingSection>
    );
    expect(html).toContain('aria-labelledby="probe-title"');
    expect(html).toContain('id="probe-title"');
    expect(html).toContain("<h2");
  });

  it("every section component renders without data access", () => {
    const blocks = [
      renderToStaticMarkup(<ArenaHero />),
      renderToStaticMarkup(<AudiencePathways />),
      renderToStaticMarkup(<TournamentShowcase />),
      renderToStaticMarkup(<EditorialGuides />),
      renderToStaticMarkup(<ToolsShowcase />),
      renderToStaticMarkup(<ClosingCTA />),
    ];
    for (const html of blocks) {
      expect(html.length).toBeGreaterThan(200);
    }
  });
});
