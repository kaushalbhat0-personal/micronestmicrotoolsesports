// G1-6 presentational tests (renderToStaticMarkup, no network, no Supabase).
// Authoritative: 04 section 5 (allowlist) + 07 section 4 + 08 T1/T5/T8/T9
// (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11).
//
// Covers: result cards, avatar URL + fallback, filter labels, pagination
// filter preservation, profile field allowlist, empty-field handling, and the
// absence of game_user_id anywhere in rendered HTML.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicPlayerCard } from "@/features/player-profile/domain/directory";
import { ActiveFilters } from "./active-filters";
import { DirectoryFilters } from "./directory-filters";
import { DirectoryPagination } from "./directory-pagination";
import { FilterPanel } from "./filter-panel";
import { PlayerAvatar } from "./player-avatar";
import { PlayerCard } from "./player-card";
import { ResultsSkeleton } from "./results-skeleton";
import { ProfileSections } from "./profile-sections";

const CARD: PublicPlayerCard = {
  handle: "nova_01",
  display_name: "Nova",
  avatar_url: "https://cdn.example/avatars/nova.png",
  bio: "BGMI scout.",
  country_code: "IN",
  game_key: "bgmi",
  game_name: "Battlegrounds Mobile India",
  ign: "NovaScout",
  primary_role: "Scout",
  play_modes: ["squad", "tpp"],
  region_code: "india",
  availability: ["weekend"],
};

const SECRET = "00998877";

describe("PlayerAvatar", () => {
  it("renders the validated reader URL with an accessible name", () => {
    const html = renderToStaticMarkup(<PlayerAvatar src={CARD.avatar_url} name="Nova" />);
    expect(html).toContain(CARD.avatar_url);
    expect(html).toContain('alt="Avatar of Nova"');
  });

  it("renders a labelled fallback when the avatar is NULL", () => {
    const html = renderToStaticMarkup(<PlayerAvatar src={null} name="Nova" />);
    expect(html).not.toContain("<img");
    expect(html).toContain('aria-label="Avatar placeholder for Nova"');
  });
});

describe("PlayerCard", () => {
  it("links to the handle route and shows IGN, game, role, region and availability", () => {
    const html = renderToStaticMarkup(<PlayerCard card={CARD} />);
    expect(html).toContain('href="/players/nova_01"');
    expect(html).toContain("Nova");
    expect(html).toContain("NovaScout");
    expect(html).toContain("Battlegrounds Mobile India");
    expect(html).toContain("Scout");
    expect(html).toContain("india");
    expect(html).toContain("weekend");
    expect(html).toContain("<article");
    expect(html).toContain("<h3");
  });

  it("never renders game_user_id or any private identifier", () => {
    const tainted: PublicPlayerCard = { ...CARD };
    (tainted as unknown as Record<string, unknown>)["game_user_id"] = SECRET;
    const html = renderToStaticMarkup(<PlayerCard card={tainted} />);
    expect(html).not.toContain("game_user_id");
    expect(html).not.toContain(SECRET);
  });

  it("renders safely when optional fields are NULL", () => {
    const html = renderToStaticMarkup(
      <PlayerCard card={{ ...CARD, primary_role: null, region_code: null, avatar_url: null }} />
    );
    expect(html).toContain("NovaScout");
    expect(html).not.toContain("null");
  });

  it("renders play modes, availability, bio excerpt and a profile action", () => {
    const html = renderToStaticMarkup(<PlayerCard card={CARD} />);
    expect(html).toContain("squad");
    expect(html).toContain("BGMI scout.");
    expect(html).toContain('aria-label="View profile of Nova (@nova_01)"');
    expect(html).toContain("View profile");
  });

  it("omits empty optional fields instead of inventing content", () => {
    const html = renderToStaticMarkup(
      <PlayerCard
        card={{ ...CARD, bio: null, play_modes: [], availability: [] }}
      />
    );
    expect(html).not.toContain("BGMI scout.");
    expect(html).not.toContain("weekend");
    expect(html).toContain("NovaScout");
  });

  it("exposes no dead links and no trust or telemetry claims", () => {
    const html = renderToStaticMarkup(<PlayerCard card={CARD} />);
    expect(html).not.toContain('href="#"');
    expect(html).not.toMatch(/verif/i);
    expect(html).not.toMatch(/email/i);
    expect(html).not.toMatch(/crypto/i);
    expect(html).not.toMatch(/decentral/i);
    expect(html).not.toMatch(/telemetry/i);
  });
});

describe("DirectoryFilters", () => {
  it("labels every control and submits via GET to /players", () => {
    const html = renderToStaticMarkup(
      <DirectoryFilters filters={{ game: "bgmi", query: "nova" }} />
    );
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/players"');
    for (const id of ["filter-query", "filter-game", "filter-region", "filter-role"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('name="query"');
    expect(html).toContain('name="game"');
    expect(html).toContain('name="region"');
    expect(html).toContain('name="role"');
    expect(html).toContain(">Apply filters<");
    expect(html).toContain('href="/players"');
    expect(html).toContain("Reset filters");
  });

  it("preserves the current filter values in the form", () => {
    const html = renderToStaticMarkup(
      <DirectoryFilters filters={{ game: "bgmi", region: "india", role: "Scout", query: "nova" }} />
    );
    expect(html).toContain('value="nova"');
    expect(html).toContain('value="bgmi"');
    expect(html).toContain('value="india"');
    expect(html).toContain("Scout");
  });

  it("offers only reader-supported vocabularies — no format, availability or sort controls", () => {
    const html = renderToStaticMarkup(<DirectoryFilters filters={{}} />);
    expect(html).not.toContain('name="format"');
    expect(html).not.toContain('name="mode"');
    expect(html).not.toContain('name="availability"');
    expect(html).not.toContain('name="status"');
    expect(html).not.toContain('name="sort"');
    expect(html).not.toContain("mlbb");
    expect(html).not.toContain("Valorant");
    expect(html).not.toContain('href="#"');
  });
});

describe("ActiveFilters", () => {
  it("renders one removable chip per active filter plus a clear-all link", () => {
    const html = renderToStaticMarkup(
      <ActiveFilters filters={{ game: "bgmi", role: "Scout", query: "nova" }} />
    );
    expect(html).toContain('aria-label="Active filters"');
    expect(html).toContain("bgmi");
    expect(html).toContain("Scout");
    expect(html).toContain("nova");
    // Removing one filter preserves the others.
    expect(html).toContain("/players?role=Scout&amp;query=nova");
    expect(html).toContain("/players?game=bgmi&amp;query=nova");
    expect(html).toContain("Clear all");
    expect(html).toContain('href="/players"');
    expect(html).not.toContain('href="#"');
  });

  it("renders nothing when no filter is active", () => {
    expect(renderToStaticMarkup(<ActiveFilters filters={{}} />)).toBe("");
  });
});

describe("FilterPanel", () => {
  it("collapses the filters behind an accessible disclosure on mobile", () => {
    const html = renderToStaticMarkup(
      <FilterPanel activeCount={2}>
        <p>form</p>
      </FilterPanel>
    );
    expect(html).toContain("Show filters (2 active)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="');
    expect(html).toContain("hidden");
  });

  it("omits the count when no filter is active", () => {
    const html = renderToStaticMarkup(
      <FilterPanel activeCount={0}>
        <p>form</p>
      </FilterPanel>
    );
    expect(html).toContain("Show filters");
    expect(html).not.toContain("active)");
  });
});

describe("DirectoryPagination", () => {
  it("preserves filters in prev/next links and marks the current page", () => {
    const html = renderToStaticMarkup(
      <DirectoryPagination page={2} hasMore filters={{ game: "bgmi", query: "nova" }} />
    );
    expect(html).toContain('aria-label="Player directory pages"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Page 2");
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain("/players?game=bgmi&amp;query=nova");
    expect(html).toContain("page=3");
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    const first = renderToStaticMarkup(<DirectoryPagination page={1} hasMore filters={{}} />);
    expect(first).toContain('aria-disabled="true"');
    expect(first).not.toContain('rel="prev"');
    const last = renderToStaticMarkup(
      <DirectoryPagination page={2} hasMore={false} filters={{}} />
    );
    expect(last).not.toContain('rel="next"');
  });
});

describe("ProfileSections", () => {
  it("renders handle, display name, bio, country and the game section", () => {
    const html = renderToStaticMarkup(<ProfileSections card={CARD} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Nova");
    expect(html).toContain("@nova_01");
    expect(html).toContain("BGMI scout.");
    expect(html).toContain("IN");
    expect(html).toContain("Battlegrounds Mobile India");
    expect(html).toContain("NovaScout");
    expect(html).toContain("weekend");
  });

  it("exposes no game_user_id, IDs, email or timestamps", () => {
    const tainted = {
      ...CARD,
      game_user_id: SECRET,
      user_id: "11111111-1111-4111-8111-111111111111",
      email: "nova@example.com",
      created_at: "2026-11-10T00:00:00.000Z",
    } as unknown as PublicPlayerCard;
    const html = renderToStaticMarkup(<ProfileSections card={tainted} />);
    expect(html).not.toContain("game_user_id");
    expect(html).not.toContain(SECRET);
    expect(html).not.toContain("nova@example.com");
    expect(html).not.toContain("created_at");
  });

  it("shows explicit placeholders instead of inventing empty-field data", () => {
    const html = renderToStaticMarkup(
      <ProfileSections
        card={{
          ...CARD,
          bio: null,
          primary_role: null,
          region_code: null,
          play_modes: [],
          availability: [],
        }}
      />
    );
    expect(html).not.toContain("BGMI scout.");
    expect(html).toContain("Not specified");
    expect(html).not.toContain("undefined");
  });
});

describe("ResultsSkeleton", () => {
  it("announces the loading region for assistive technology", () => {
    const html = renderToStaticMarkup(<ResultsSkeleton />);
    expect(html).toContain('aria-label="Loading player directory results"');
  });
});
