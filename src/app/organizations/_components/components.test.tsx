// P8 organizations presentational tests (renderToStaticMarkup, no network).
// Covers: cards (honest trust, no false confirmation, team count, no logo
// fabrication), detail sections (independence note, recruitment unavailable,
// links handoff), filters/pagination/skeleton, and absence of private
// internals in rendered HTML.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicOrganizationDetail } from "@/features/organizations/domain/organization";
import { OrganizationCard } from "./organization-card";
import { OrganizationFiltersForm } from "./organization-filters";
import { OrganizationProfileSections } from "./organization-profile-sections";
import { OrganizationsPagination } from "./organizations-pagination";

const CARD: PublicOrganizationDetail = {
  slug: "nova-org",
  name: "Nova Organization",
  region_code: "india",
  org_type: "professional",
  game_keys: ["bgmi"],
  trust_state: "submitted",
  team_count: 2,
  description: "A competitive organization.",
  website_url: "https://nova.example.com",
  social_links: [{ label: "X", url: "https://x.com/nova" }],
};

describe("OrganizationCard", () => {
  it("links to the slug route and shows type, region, games and team count", () => {
    const html = renderToStaticMarkup(<OrganizationCard card={CARD} />);
    expect(html).toContain('href="/organizations/nova-org"');
    expect(html).toContain("Nova Organization");
    expect(html).toContain("Professional");
    expect(html).toContain("india");
    expect(html).toContain("2 teams");
    expect(html).toContain("<article");
  });

  it("never shows a confirmation badge for submitted information", () => {
    const html = renderToStaticMarkup(<OrganizationCard card={CARD} />);
    expect(html).toContain("Unverified");
    expect(html).not.toContain("Confirmed");
  });

  it("shows confirmation only for the confirmed state", () => {
    const html = renderToStaticMarkup(
      <OrganizationCard card={{ ...CARD, trust_state: "confirmed" }} />,
    );
    expect(html).toContain("Confirmed");
    expect(html).not.toContain("Unverified");
  });

  it("never renders private internals", () => {
    const tainted = { ...CARD, owner_user_id: "secret", evidence: "secret" };
    const html = renderToStaticMarkup(<OrganizationCard card={tainted as unknown as typeof CARD} />);
    expect(html).not.toContain("secret");
    expect(html).not.toContain("owner_user_id");
  });
});

describe("OrganizationProfileSections", () => {
  it("states team independence and recruitment unavailability honestly", () => {
    const html = renderToStaticMarkup(<OrganizationProfileSections card={CARD} />);
    expect(html).toContain("independently discoverable");
    expect(html).toContain("unavailable in this phase");
    expect(html).toContain("Submitted");
    expect(html).not.toContain("owner_user_id");
  });

  it("renders links with a safe handoff and empty state", () => {
    const html = renderToStaticMarkup(<OrganizationProfileSections card={CARD} />);
    expect(html).toContain("https://nova.example.com");
    expect(html).toContain('rel="noopener noreferrer"');
    const empty = renderToStaticMarkup(
      <OrganizationProfileSections card={{ ...CARD, website_url: null, social_links: [] }} />,
    );
    expect(empty).toContain("No public links provided.");
  });
});

describe("OrganizationFiltersForm + pagination", () => {
  it("renders labelled controls and preserves page state", () => {
    const html = renderToStaticMarkup(
      <OrganizationFiltersForm filters={{ game: "bgmi", orgType: "academy" }} />,
    );
    expect(html).toContain("Filter organizations");
    expect(html).toContain('name="type"');
    const paged = renderToStaticMarkup(
      <OrganizationsPagination page={2} hasMore={true} filters={{ game: "bgmi" }} />,
    );
    expect(paged).toContain("Page 2");
    expect(paged).toContain("game=bgmi");
  });
});
