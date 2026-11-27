// P2 workspace reader tests (no network, no Supabase project).
// The fake client implements the exact surfaces the reader uses:
// auth.getUser, rpc(ensure_app_user), and a minimal thenable query builder
// for the teams / team_members selects. Covers: session-derived identity
// (no caller IDs), owner/captain/member basis resolution (co-captain stays
// member), strict 12-key mapping, roster views without user_ids rendered,
// 404-equivalence, generic errors, and suspended/unauthenticated handling.

import { describe, expect, it } from "vitest";
import {
  SuspendedError,
  UnauthenticatedError,
} from "@/features/player-profile/domain/app-user";
import { WorkspaceOperationError, WorkspaceValidationError } from "@/features/teams/domain/workspace";
import { getManagedTeam, listManagedTeams, listTeamRoster } from "./workspace";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const TEAM_ID = "33333333-3333-4333-8333-333333333333";

const TEAM_ROW = {
  id: TEAM_ID,
  slug: "nova-esports",
  name: "Nova Esports",
  game_key: "bgmi",
  region_code: "india",
  description: "A competitive BGMI squad.",
  current_level: "competitive",
  target_level: "semi-pro",
  recruiting: true,
  is_public: true,
  owner_user_id: OWNER_ID,
  created_by: OWNER_ID,
};

interface FakeOptions {
  sessionUserId?: string | null;
  appUserStatus?: string;
  teams?: Record<string, unknown>[];
  memberships?: Record<string, unknown>[];
  roster?: Record<string, unknown>[];
  memberCount?: number;
  failTable?: string | null;
}

function fakeClient(options: FakeOptions = {}) {
  const {
    sessionUserId = OWNER_ID,
    appUserStatus = "active",
    teams = [TEAM_ROW],
    memberships = [],
    roster = [],
    memberCount = 3,
    failTable = null,
  } = options;
  const tableCalls: string[] = [];

  const resolveQuery = (table: string, selectArgs: unknown[]) => {
    tableCalls.push(table);
    if (failTable === table) {
      return { data: null, error: { message: "boom" }, count: null };
    }
    const isCount = selectArgs.some(
      (arg) => typeof arg === "object" && arg !== null && "count" in (arg as Record<string, unknown>),
    );
    if (table === "teams") {
      return { data: teams, error: null, count: null };
    }
    if (table === "team_members" && isCount) {
      return { data: [], error: null, count: memberCount };
    }
    if (table === "team_members" && memberships.length > 0 && roster.length === 0) {
      return { data: memberships, error: null, count: null };
    }
    if (table === "team_members") {
      return { data: roster.length > 0 ? roster : memberships, error: null, count: null };
    }
    return { data: [], error: null, count: null };
  };

  const makeQuery = (table: string) => {
    let selectArgs: unknown[] = [];
    const q = {
      select: (...args: unknown[]) => {
        selectArgs = args;
        return q;
      },
      eq: () => q,
      order: () => q,
      limit: () => q,
      single: () => q,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolveQuery(table, selectArgs)).then(resolve),
    };
    return q;
  };

  const client = {
    tableCalls,
    auth: {
      getUser: async () =>
        sessionUserId === null
          ? { data: { user: null }, error: { message: "signed out" } }
          : { data: { user: { id: sessionUserId } }, error: null },
    },
    rpc: async (fn: string) => {
      if (fn !== "ensure_app_user") {
        return { data: null, error: { message: "unknown function" } };
      }
      if (sessionUserId === null) {
        return { data: null, error: { message: "no session" } };
      }
      return { data: [{ id: sessionUserId, status: appUserStatus }], error: null };
    },
    from: (table: string) => ({
      select: (...args: unknown[]) => makeQuery(table).select(...args),
    }),
  };
  return { client: client as never, tableCalls };
}

describe("session identity", () => {
  it("rejects signed-out callers before any table touch", async () => {
    const { client, tableCalls } = fakeClient({ sessionUserId: null });
    await expect(listManagedTeams(client)).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(tableCalls).toEqual([]);
  });

  it("rejects suspended callers with a generic error", async () => {
    const { client } = fakeClient({ appUserStatus: "suspended" });
    const failure = await listManagedTeams(client).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SuspendedError);
    expect(String((failure as Error).message)).not.toContain("suspended");
  });
});

describe("basis resolution", () => {
  it("resolves owner when the session matches owner_user_id", async () => {
    const { client } = fakeClient();
    const teams = await listManagedTeams(client);
    expect(teams).toHaveLength(1);
    expect(teams[0]?.role).toBe("owner");
    expect(teams[0]?.member_count).toBe(3);
    expect(teams[0] ?? {}).not.toHaveProperty("owner_user_id");
    expect(teams[0] ?? {}).not.toHaveProperty("created_by");
  });

  it("resolves captain for member role=captain, member otherwise", async () => {
    const otherTeam = { ...TEAM_ROW, owner_user_id: OTHER_ID, created_by: OTHER_ID };
    const THIRD_ID = "44444444-4444-4444-8444-444444444444";
    const captain = fakeClient({
      sessionUserId: THIRD_ID,
      teams: [otherTeam],
      memberships: [{ team_id: TEAM_ID, role: "captain" }],
      roster: [],
    });
    const asCaptain = await listManagedTeams(captain.client);
    expect(asCaptain[0]?.role).toBe("captain");

    const coCaptain = fakeClient({
      sessionUserId: THIRD_ID,
      teams: [otherTeam],
      memberships: [{ team_id: TEAM_ID, role: "co-captain" }],
      roster: [],
    });
    // Co-captain holds NO rights: read-only member basis.
    expect((await listManagedTeams(coCaptain.client))[0]?.role).toBe("member");
  });
});

describe("getManagedTeam", () => {
  it("rejects malformed ids without touching tables", async () => {
    const { client, tableCalls } = fakeClient();
    await expect(getManagedTeam(client, "not-a-uuid")).rejects.toBeInstanceOf(
      WorkspaceValidationError,
    );
    expect(tableCalls).toEqual([]);
  });

  it("returns null for invisible teams (404-equivalence)", async () => {
    const { client } = fakeClient({ teams: [] });
    await expect(getManagedTeam(client, TEAM_ID)).resolves.toBeNull();
  });

  it("fails closed on extra keys and transport errors (generic, no detail)", async () => {
    const tainted = fakeClient({ teams: [{ ...TEAM_ROW, applicant_user_id: OTHER_ID }] });
    await expect(getManagedTeam(tainted.client, TEAM_ID)).rejects.toBeInstanceOf(
      WorkspaceOperationError,
    );
    const broken = fakeClient({ failTable: "teams" });
    const failure = await getManagedTeam(broken.client, TEAM_ID).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(WorkspaceOperationError);
    expect(String((failure as Error).message)).not.toContain("boom");
  });
});

describe("listTeamRoster", () => {
  const ROSTER = [
    { user_id: OWNER_ID, role: "captain", game_role: "IGL" },
    { user_id: OTHER_ID, role: "player", game_role: null },
  ];
  it("maps role/game-role/self markers without user_ids in values", async () => {
    const { client } = fakeClient({ roster: ROSTER, memberships: [] });
    const result = await listTeamRoster(client, TEAM_ID);
    expect(result?.team.role).toBe("owner");
    expect(result?.members).toHaveLength(2);
    expect(result?.members[0]).toMatchObject({ role: "captain", game_role: "IGL", is_self: true });
    expect(result?.members[1]).toMatchObject({ role: "player", game_role: null, is_self: false });
    const serialized = JSON.stringify(result?.members.map(({ key: _k, ...rest }) => rest));
    expect(serialized).not.toContain(OWNER_ID);
    expect(serialized).not.toContain(OTHER_ID);
  });

  it("returns null when the team is invisible", async () => {
    const { client } = fakeClient({ teams: [] });
    await expect(listTeamRoster(client, TEAM_ID)).resolves.toBeNull();
  });
});
