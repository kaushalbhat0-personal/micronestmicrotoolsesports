// P1 teams presentational tests (renderToStaticMarkup, no network, no Supabase).
// Covers: team cards (self-reported levels, recruiting badge, member count),
// detail sections (public-only fields, roster unavailability note), filters,
// pagination, creation/application boundary notices (disabled submits, no
// fake success), recruitment post cards, own-application status, and the
// absence of owner/applicant/decision internals anywhere in rendered HTML.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicTeamDetail } from "@/features/teams/domain/team-directory";
import { ApplicationForm } from "./application-form";
import { ApplicationStatus } from "./application-status";
import { RecruitmentPostCard } from "./recruitment-post-card";
import { TeamFilters } from "./team-filters";
import { TeamCard } from "./team-card";
import { TeamForm } from "./team-form";
import { TeamProfileSections } from "./team-profile-sections";
import { TeamsPagination } from "./teams-pagination";
import { TeamsResultsSkeleton } from "./results-skeleton";

const CARD: PublicTeamDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "nova-esports",
  name: "Nova Esports",
  game_key: "bgmi",
  region_code: "india",
  description: "A competitive BGMI squad.",
  current_level: "competitive",
  target_level: "semi-pro",
  recruiting: true,
  member_count: 5,
};

const SECRET_OWNER = "22222222-2222-4222-8222-222222222222";

describe("TeamCard", () => {
  it("links to the slug route and shows game, region, level, recruiting and members", () => {
    const html = renderToStaticMarkup(<TeamCard card={CARD} />);
    expect(html).toContain('href="/teams/nova-esports"');
    expect(html).toContain("Nova Esports");
    expect(html).toContain("BGMI");
    expect(html).toContain("india");
    expect(html).toContain("competitive");
    expect(html).toContain("self-reported");
    expect(html).toContain("Recruiting");
    expect(html).toContain("5 members");
    expect(html).toContain("<article");
    expect(html).toContain("<h3");
  });

  it("marks non-recruiting teams distinctly", () => {
    const html = renderToStaticMarkup(<TeamCard card={{ ...CARD, recruiting: false }} />);
    expect(html).toContain("Not recruiting");
    expect(html).not.toContain(">Recruiting<");
  });

  it("never renders owner, org, applicant or decision internals", () => {
    const tainted = {
      ...CARD,
      owner_user_id: SECRET_OWNER,
      created_by: SECRET_OWNER,
      organization_id: "org-1",
      applicant_user_id: SECRET_OWNER,
    } as unknown as PublicTeamDetail;
    const html = renderToStaticMarkup(<TeamCard card={tainted} />);
    expect(html).not.toContain("owner_user_id");
    expect(html).not.toContain("created_by");
    expect(html).not.toContain("organization_id");
    expect(html).not.toContain(SECRET_OWNER);
  });
});

describe("TeamFilters", () => {
  it("labels every control and submits via GET to /teams", () => {
    const html = renderToStaticMarkup(<TeamFilters filters={{ game: "bgmi", query: "nova" }} />);
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/teams"');
    for (const id of ["team-filter-query", "team-filter-game", "team-filter-region"]) {
      expect(html).toContain(`for="${id}"`);
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('name="query"');
    expect(html).toContain('name="game"');
    expect(html).toContain('name="region"');
    expect(html).toContain(">Apply filters<");
    expect(html).toContain('href="/teams"');
    expect(html).toContain("Reset filters");
  });

  it("offers only supported games (no invented titles)", () => {
    const html = renderToStaticMarkup(<TeamFilters filters={{}} />);
    expect(html).toContain('value="bgmi"');
    expect(html).not.toContain("valorant");
    expect(html).not.toContain("mlbb");
  });
});

describe("TeamsPagination", () => {
  it("preserves filters in prev/next links and marks the current page", () => {
    const html = renderToStaticMarkup(
      <TeamsPagination page={2} hasMore filters={{ game: "bgmi", query: "nova" }} />,
    );
    expect(html).toContain('aria-label="Team directory pages"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Page 2");
    expect(html).toContain('rel="prev"');
    expect(html).toContain('rel="next"');
    expect(html).toContain("/teams?game=bgmi&amp;query=nova");
    expect(html).toContain("page=3");
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    const first = renderToStaticMarkup(<TeamsPagination page={1} hasMore filters={{}} />);
    expect(first).toContain('aria-disabled="true"');
    expect(first).not.toContain('rel="prev"');
    const last = renderToStaticMarkup(<TeamsPagination page={2} hasMore={false} filters={{}} />);
    expect(last).not.toContain('rel="next"');
  });
});

describe("TeamProfileSections", () => {
  it("renders identity, game, region, levels, recruiting, description and roster count", () => {
    const html = renderToStaticMarkup(<TeamProfileSections card={CARD} />);
    expect(html).toContain("<h1");
    expect(html).toContain("Nova Esports");
    expect(html).toContain("@nova-esports");
    expect(html).toContain("Battlegrounds Mobile India");
    expect(html).toContain("india");
    expect(html).toContain("competitive");
    expect(html).toContain("self-reported");
    expect(html).toContain("Recruiting");
    expect(html).toContain("A competitive BGMI squad.");
    expect(html).toContain("5 members");
  });

  it("states roster unavailability instead of inventing member rows", () => {
    const html = renderToStaticMarkup(<TeamProfileSections card={CARD} />);
    expect(html).toContain("Public roster identities are unavailable");
    expect(html).not.toContain("owner_user_id");
  });

  it("shows explicit placeholders instead of inventing empty-field data", () => {
    const html = renderToStaticMarkup(
      <TeamProfileSections card={{ ...CARD, description: null }} />,
    );
    expect(html).toContain("No description provided.");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });
});

describe("TeamForm — validation presentation, enabled write path", () => {
  it("labels every control and shows the enabled writes hint", () => {
    const html = renderToStaticMarkup(<TeamForm />);
    for (const id of [
      "team-name",
      "team-slug",
      "team-game",
      "team-region",
      "team-current-level",
      "team-target-level",
      "team-description",
      "team-recruiting",
      "team-public",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Create team");
    expect(html).toContain("Slug, game and ownership stay locked after creation");
  });

  it("wires createTeamAction without inventing success copy before submit", () => {
    const html = renderToStaticMarkup(<TeamForm />);
    expect(html).toContain("Roster invites and ownership transfer are not available yet");
    expect(html).not.toContain("Team created.");
  });
});

describe("RecruitmentPostCard", () => {
  const post = {
    roleNeeded: "IGL" as const,
    slots: 2,
    currentLevelMin: "competitive" as const,
    targetLevel: "semi-pro" as const,
    regionCode: "india" as const,
    tryoutRequired: true,
    status: "open" as const,
  };
  it("presents role, slots, levels, region, tryout and status with eligibility", () => {
    const html = renderToStaticMarkup(
      <RecruitmentPostCard teamName="Nova Esports" teamSlug="nova-esports" post={post} />,
    );
    expect(html).toContain("Nova Esports");
    expect(html).toContain('href="/teams/nova-esports"');
    expect(html).toContain("IGL");
    expect(html).toContain("competitive");
    expect(html).toContain("self-reported");
    expect(html).toContain("Tryout required");
    expect(html).toContain("open");
  });

  it("renders no applicant information", () => {
    const html = renderToStaticMarkup(
      <RecruitmentPostCard teamName="Nova Esports" teamSlug="nova-esports" post={post} />,
    );
    expect(html).not.toContain("applicant");
  });
});

describe("ApplicationForm — validation presentation, no write path", () => {
  it("renders the bounded note field with a disabled submit and boundary notice", () => {
    const html = renderToStaticMarkup(<ApplicationForm teamName="Nova Esports" roleNeeded="IGL" />);
    expect(html).toContain('id="application-note"');
    expect(html).toContain("maxLength=\"200\"");
    expect(html).toContain("Apply (unavailable)");
    expect(html).toContain("disabled");
    expect(html).toContain("No application is submitted from this form");
  });

  it("has no form action (no write target exists)", () => {
    const html = renderToStaticMarkup(<ApplicationForm teamName="Nova Esports" roleNeeded="IGL" />);
    expect(html).not.toContain("action=");
  });
});

describe("ApplicationStatus", () => {
  it("renders an honest empty state with a privacy note", () => {
    const html = renderToStaticMarkup(<ApplicationStatus applications={[]} />);
    expect(html).toContain("Your applications");
    expect(html).toContain("No applications yet.");
    expect(html).toContain("never publicly");
  });

  it("lists only the applicant's own post/team/status triples", () => {
    const html = renderToStaticMarkup(
      <ApplicationStatus
        applications={[
          { postLabel: "IGL · 2 slots", teamName: "Nova Esports", teamSlug: "nova-esports", status: "applied" },
        ]}
      />,
    );
    expect(html).toContain("Nova Esports");
    expect(html).toContain("IGL · 2 slots");
    expect(html).toContain("applied");
    expect(html).not.toContain("decided_by");
  });
});

describe("TeamsResultsSkeleton", () => {
  it("announces the loading region for assistive technology", () => {
    const html = renderToStaticMarkup(<TeamsResultsSkeleton />);
    expect(html).toContain('aria-label="Loading team directory results"');
  });
});
