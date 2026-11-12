// P8 brands presentational tests (renderToStaticMarkup, no network).
// Covers: cards (honest trust, declared interests, no availability claims),
// detail sections (representation unverified, opportunities unavailable, no
// contact handoff), filters/pagination, and absence of private internals.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicBrandDetail } from "@/features/brands/domain/brand";
import { BrandCard } from "./brand-card";
import { BrandFiltersForm } from "./brand-filters";
import { BrandProfileSections } from "./brand-profile-sections";
import { BrandsPagination } from "./brands-pagination";

const CARD: PublicBrandDetail = {
  slug: "volt-energy",
  name: "Volt Energy",
  industry: "energy-drink",
  region_code: "india",
  game_interests: ["bgmi"],
  partnership_types: ["sponsorship"],
  sponsorship_interests: ["teams"],
  trust_state: "submitted",
  description: "An energy drink brand.",
  website_url: "https://volt.example.com",
  social_links: [],
  representative_verified: false,
};

describe("BrandCard", () => {
  it("links to the slug route and shows industry, region and interests", () => {
    const html = renderToStaticMarkup(<BrandCard card={CARD} />);
    expect(html).toContain('href="/brands/volt-energy"');
    expect(html).toContain("Volt Energy");
    expect(html).toContain("energy-drink");
    expect(html).toContain("teams");
    expect(html).toContain("<article");
  });

  it("never implies availability or verification from declared interest", () => {
    const html = renderToStaticMarkup(<BrandCard card={CARD} />);
    expect(html).toContain("Unverified");
    expect(html).not.toContain("Confirmed");
    expect(html).not.toContain("Available");
    expect(html).not.toContain("looking for partners");
  });

  it("never renders representative internals", () => {
    const tainted = { ...CARD, representative_email: "secret@example.com" };
    const html = renderToStaticMarkup(<BrandCard card={tainted as unknown as typeof CARD} />);
    expect(html).not.toContain("secret@example.com");
  });
});

describe("BrandProfileSections", () => {
  it("states representation, opportunities and handoff boundaries honestly", () => {
    const html = renderToStaticMarkup(<BrandProfileSections card={CARD} />);
    expect(html).toContain("does not prove");
    expect(html).toContain("unavailable in this phase");
    expect(html).toContain("unverified");
    expect(html).not.toContain("representative_email");
    expect(html).not.toContain("Contact us");
  });
});

describe("BrandFiltersForm + pagination", () => {
  it("renders labelled controls and preserves interest state", () => {
    const html = renderToStaticMarkup(
      <BrandFiltersForm filters={{ industry: "fintech", interest: "teams" }} />,
    );
    expect(html).toContain("Filter brands");
    expect(html).toContain('name="interest"');
    const paged = renderToStaticMarkup(
      <BrandsPagination page={1} hasMore={false} filters={{}} />,
    );
    expect(paged).toContain("Page 1");
  });
});
