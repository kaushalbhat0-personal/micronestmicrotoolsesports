// P3 tournaments presentational tests (renderToStaticMarkup, no network).
// Covers: cards (status, dates, fee/prize, organizer, registration
// indicator), filters (labels, GET, supported-games-only), pagination,
// detail (banner, eligibility, external handoff with rel=noopener, trust
// notes, no invented figures), organizer card (unverified honesty),
// publish form (disabled, no action, boundary), skeleton — and the absence
// of owner/moderation/payment internals in rendered HTML.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicTournamentDetail } from "@/features/tournaments/domain/public-card";
import { OrganizerCard } from "./organizer-card";
import { TournamentPublishForm } from "./publish-form";
import { TournamentCard } from "./tournament-card";
import { TournamentDetail } from "./tournament-detail";
import { TournamentFilters } from "./tournament-filters";
import { TournamentsPagination } from "./tournaments-pagination";
import { TournamentsResultsSkeleton } from "./results-skeleton";

const CARD: PublicTournamentDetail = {
  slug: "monsoon-showdown-cup",
  title: "Monsoon Showdown Cup",
  game_key: "bgmi",
  region_code: "india",
  format: "team",
  starts_at: "2099-12-01T10:00:00.000Z",
  ends_at: "2099-12-03T18:00:00.000Z",
  timezone: "Asia/Kolkata",
  entry_fee: { amountMinor: 0, currency: "INR" },
  prize_pool: { amountMinor: 10000000, currency: "INR" },
  organizer: { kind: "independent", name: "Nova Events", slug: null, verified: false },
  lifecycle: "published",
  registration_url: "https://events.example.com/register",
  registration_closes_at: null,
  status: "upcoming",
  description: "A weekend BGMI open.",
  contact_instructions: null,
  eligibility: {
    min_team_size: 4,
    max_team_size: 4,
    region_codes: ["india"],
    min_age: null,
    note: null,
  },
};

describe("TournamentCard", () => {
  it("links to the slug route with status, dates, fee, prize and organizer", () => {
    const html = renderToStaticMarkup(<TournamentCard card={CARD} />);
    expect(html).toContain('href="/tournaments/monsoon-showdown-cup"');
    expect(html).toContain("Monsoon Showdown Cup");
    expect(html).toContain("upcoming");
    expect(html).toContain("BGMI");
    expect(html).toContain("india");
    expect(html).toContain("Free entry");
    expect(html).toContain("Nova Events");
    expect(html).toContain("Registration open");
    expect(html).toContain("<article");
  });

  it("renders non-disclosure literally instead of inventing figures", () => {
    const html = renderToStaticMarkup(
      <TournamentCard card={{ ...CARD, entry_fee: null, prize_pool: null }} />,
    );
    expect(html).toContain("Not disclosed");
    expect(html).not.toContain("TBD");
  });

  it("never renders owner, moderation or payment internals", () => {
    const tainted = {
      ...CARD,
      owner_user_id: "11111111-1111-4111-8111-111111111111",
      payment_id: "pay_123",
    } as unknown as PublicTournamentDetail;
    const html = renderToStaticMarkup(<TournamentCard card={tainted} />);
    expect(html).not.toContain("owner_user_id");
    expect(html).not.toContain("pay_123");
  });
});

describe("TournamentFilters", () => {
  it("labels every control and submits via GET to /tournaments", () => {
    const html = renderToStaticMarkup(
      <TournamentFilters filters={{ game: "bgmi", status: "upcoming", query: "monsoon" }} />,
    );
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/tournaments"');
    for (const id of [
      "tournament-filter-query",
      "tournament-filter-game",
      "tournament-filter-region",
      "tournament-filter-status",
    ]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain(">Apply filters<");
    expect(html).toContain("Reset filters");
  });

  it("offers only supported games (no invented titles)", () => {
    const html = renderToStaticMarkup(<TournamentFilters filters={{}} />);
    expect(html).toContain('value="bgmi"');
    expect(html).not.toContain("valorant");
    expect(html).not.toContain("mlbb");
  });
});

describe("TournamentsPagination", () => {
  it("preserves filters in prev/next links and marks the current page", () => {
    const html = renderToStaticMarkup(
      <TournamentsPagination page={2} hasMore filters={{ game: "bgmi", status: "upcoming" }} />,
    );
    expect(html).toContain('aria-label="Tournament directory pages"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Page 2");
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain("/tournaments?game=bgmi&amp;status=upcoming");
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    const first = renderToStaticMarkup(<TournamentsPagination page={1} hasMore filters={{}} />);
    expect(first).toContain('aria-disabled="true"');
    expect(first).not.toContain('rel="prev"');
    const last = renderToStaticMarkup(
      <TournamentsPagination page={2} hasMore={false} filters={{}} />,
    );
    expect(last).not.toContain('rel="next"');
  });
});

describe("TournamentDetail", () => {
  it("renders banner title, dates, fee, prize, eligibility and organizer", () => {
    const html = renderToStaticMarkup(<TournamentDetail card={CARD} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Monsoon Showdown Cup");
    expect(html).toContain("Battlegrounds Mobile India");
    expect(html).toContain("Asia/Kolkata");
    expect(html).toContain("Free entry");
    expect(html).toContain("Squad size");
    expect(html).toContain("Nova Events");
  });

  it("hands off external registration with rel=noopener and a leaves-site note", () => {
    const html = renderToStaticMarkup(<TournamentDetail card={CARD} />);
    expect(html).toContain('href="https://events.example.com/register"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("leave MicroNest");
    expect(html).not.toContain("Pay now");
  });

  it("falls back to contact instructions when no URL exists", () => {
    const html = renderToStaticMarkup(
      <TournamentDetail
        card={{ ...CARD, registration_url: null, contact_instructions: "DM @novaevents" }}
      />,
    );
    expect(html).toContain("DM @novaevents");
    expect(html).not.toContain("target=");
  });

  it("states trust boundaries without implying endorsement", () => {
    const html = renderToStaticMarkup(<TournamentDetail card={CARD} />);
    expect(html).toContain("self-declared");
    expect(html).toContain("no listing here implies MicroNest endorsement");
  });
});

describe("OrganizerCard", () => {
  it("names the organizer with kind and an unverified note", () => {
    const html = renderToStaticMarkup(<OrganizerCard organizer={CARD.organizer} />);
    expect(html).toContain("Nova Events");
    expect(html).toContain("Independent organizer");
    expect(html).toContain("self-declared");
    expect(html).not.toContain("Verified");
  });
});

describe("TournamentPublishForm — validation presentation, no write path", () => {
  it("labels every control and keeps submission disabled with a boundary notice", () => {
    const html = renderToStaticMarkup(<TournamentPublishForm />);
    for (const id of [
      "pub-title",
      "pub-slug",
      "pub-game",
      "pub-region",
      "pub-format",
      "pub-starts",
      "pub-ends",
      "pub-timezone",
      "pub-description",
      "pub-org-name",
      "pub-org-kind",
      "pub-reg-url",
      "pub-contact",
      "pub-eligibility",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("disabled");
    expect(html).toContain("Publish tournament (unavailable)");
    expect(html).toContain("Publishing is disabled in this phase");
  });

  it("has no form action and no payment fields", () => {
    const html = renderToStaticMarkup(<TournamentPublishForm />);
    expect(html).not.toContain("action=");
    expect(html).not.toContain("payment");
    expect(html).not.toContain("bracket");
  });
});

describe("TournamentsResultsSkeleton", () => {
  it("announces the loading region for assistive technology", () => {
    const html = renderToStaticMarkup(<TournamentsResultsSkeleton />);
    expect(html).toContain('aria-label="Loading tournament directory results"');
  });
});
