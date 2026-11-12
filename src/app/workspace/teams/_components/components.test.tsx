// P2 workspace presentational tests (renderToStaticMarkup, no network).
// Covers: managed team cards (own basis only), permission notes per role,
// settings form (editable vs locked fields, disabled submit, no action),
// roster cards (captain highlight, game role, you-marker, no user_ids),
// route states, skeleton, and the absence of ownership/applicant/org
// internals anywhere in rendered HTML. Responsive grid classes are asserted
// as the mobile-first evidence available without a browser.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ManagedTeam, RosterMemberView } from "@/features/teams/domain/workspace";
import { PermissionNote } from "./permission-note";
import { RosterList, RosterMemberCard } from "./roster-list";
import { TeamSettingsForm } from "./team-settings-form";
import { WorkspaceTeamCard } from "./workspace-team-card";
import {
  WorkspaceEmpty,
  WorkspaceSignInPrompt,
  WorkspaceUnavailable,
} from "./workspace-states";
import { WorkspaceSkeleton } from "./workspace-skeleton";

const TEAM: ManagedTeam = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "nova-esports",
  name: "Nova Esports",
  game_key: "bgmi",
  region_code: "india",
  description: "A competitive BGMI squad.",
  current_level: "competitive",
  target_level: "semi-pro",
  recruiting: true,
  is_public: true,
  member_count: 4,
  role: "owner",
};

const MEMBERS: RosterMemberView[] = [
  { key: "u-captain", role: "captain", game_role: "IGL", is_self: true },
  { key: "u-player", role: "player", game_role: null, is_self: false },
];

const SECRET = "11111111-1111-4111-8111-111111111111";

describe("WorkspaceTeamCard", () => {
  it("shows identity, game, region, count and the caller's own basis", () => {
    const html = renderToStaticMarkup(<WorkspaceTeamCard team={TEAM} />);
    expect(html).toContain("Nova Esports");
    expect(html).toContain("@nova-esports");
    expect(html).toContain("BGMI");
    expect(html).toContain("india");
    expect(html).toContain("4 members");
    expect(html).toContain("Owner — you manage this team");
    expect(html).toContain(`/workspace/teams/${TEAM.id}`);
    expect(html).toContain("/settings");
    expect(html).toContain("/roster");
    expect(html).toContain("/teams/nova-esports");
  });

  it("marks captain and member bases distinctly", () => {
    const captain = renderToStaticMarkup(
      <WorkspaceTeamCard team={{ ...TEAM, role: "captain" }} />,
    );
    expect(captain).toContain("Captain — you manage this team");
    const member = renderToStaticMarkup(<WorkspaceTeamCard team={{ ...TEAM, role: "member" }} />);
    expect(member).toContain("Member — read-only");
  });

  it("never renders ownership or applicant internals", () => {
    const tainted = { ...TEAM, owner_user_id: SECRET, applicant_user_id: SECRET };
    const html = renderToStaticMarkup(<WorkspaceTeamCard team={tainted as unknown as ManagedTeam} />);
    expect(html).not.toContain("owner_user_id");
    expect(html).not.toContain("applicant_user_id");
    expect(html).not.toContain(SECRET);
  });
});

describe("PermissionNote", () => {
  it("explains each basis with its unavailable capabilities", () => {
    for (const role of ["owner", "captain"] as const) {
      const html = renderToStaticMarkup(<PermissionNote role={role} />);
      expect(html).toContain("Your permissions");
      expect(html).toContain("unavailable in this phase");
    }
    const html = renderToStaticMarkup(<PermissionNote role="member" />);
    expect(html).toContain("read-only");
  });

  it("states the co-captain, org, suspension and transfer boundaries", () => {
    const html = renderToStaticMarkup(<PermissionNote role="owner" />);
    expect(html).toContain("Co-captains hold no management rights");
    expect(html).toContain("Organization membership never implies team authority");
    expect(html).toContain("Suspended accounts cannot write");
    expect(html).toContain("Ownership transfer is unavailable");
  });
});

describe("TeamSettingsForm — validation presentation, no write path", () => {
  it("renders editable fields with current values and locked identity fields", () => {
    const html = renderToStaticMarkup(<TeamSettingsForm team={TEAM} />);
    for (const id of [
      "settings-name",
      "settings-region",
      "settings-current-level",
      "settings-target-level",
      "settings-description",
      "settings-recruiting",
      "settings-public",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain("Nova Esports");
    expect(html).toContain("@nova-esports");
    expect(html).toContain("locked");
    expect(html).toContain(TEAM.id);
    expect(html).toContain("self-reported");
  });

  it("offers no ownership or organization control", () => {
    const html = renderToStaticMarkup(<TeamSettingsForm team={TEAM} />);
    expect(html).not.toContain("owner_user_id");
    expect(html).not.toContain("organization_id");
    expect(html).not.toContain('name="slug"');
    expect(html).not.toContain('name="gameKey"');
  });

  it("wires the settings action and shows the enabled writes hint", () => {
    const html = renderToStaticMarkup(<TeamSettingsForm team={TEAM} />);
    expect(html).toContain("Save changes");
    expect(html).toContain("Slug, game and ownership stay locked after creation");
    expect(html).toContain('name="team_id"');
  });
});

describe("RosterList", () => {
  it("highlights captains, shows game roles and marks the caller's row", () => {
    const html = renderToStaticMarkup(<RosterList members={MEMBERS} />);
    expect(html).toContain("Captain");
    expect(html).toContain("IGL");
    expect(html).toContain("Flexible role");
    expect(html).toContain("you");
    expect(html).toContain("Roster changes are disabled in this phase");
  });

  it("renders an honest empty state instead of inventing members", () => {
    const html = renderToStaticMarkup(<RosterList members={[]} />);
    expect(html).toContain("Empty roster");
    expect(html).toContain("No members yet.");
  });

  it("never renders raw user ids", () => {
    const html = renderToStaticMarkup(
      <RosterList
        members={[{ key: SECRET, role: "player", game_role: "Scout", is_self: false }]}
      />,
    );
    expect(html).not.toContain(SECRET);
  });

  it("uses a responsive grid that collapses to one column on mobile", () => {
    const html = renderToStaticMarkup(
      <RosterMemberCard member={MEMBERS[0] as RosterMemberView} />,
    );
    expect(html).toContain("<li");
    const list = renderToStaticMarkup(<RosterList members={MEMBERS} />);
    expect(list).toContain("grid");
    expect(list).toContain("sm:grid-cols-2");
  });
});

describe("Workspace states", () => {
  it("prompts sign-in without inventing access", () => {
    const html = renderToStaticMarkup(<WorkspaceSignInPrompt />);
    expect(html).toContain("Team workspace");
    expect(html).toContain("Sign in to manage your teams.");
  });

  it("renders a generic unavailable alert with retry", () => {
    const html = renderToStaticMarkup(<WorkspaceUnavailable />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Workspace unavailable");
    expect(html).toContain("Try again");
  });

  it("renders an honest empty state linking to creation", () => {
    const html = renderToStaticMarkup(<WorkspaceEmpty />);
    expect(html).toContain("No teams yet");
    expect(html).toContain('href="/teams/new"');
  });

  it("announces the skeleton loading region", () => {
    const html = renderToStaticMarkup(<WorkspaceSkeleton />);
    expect(html).toContain('aria-label="Loading team workspace"');
  });
});
