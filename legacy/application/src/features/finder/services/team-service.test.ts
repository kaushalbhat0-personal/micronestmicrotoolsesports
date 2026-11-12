import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertTeamCaptain, createMyTeam, updateMyTeam } from "./team-service";
import {
  createTeam,
  findTeamById,
  listTeamMembers,
  updateTeam,
  type FinderTeamRow,
} from "../repositories/finder";

vi.mock("../repositories/finder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/finder")>();
  return {
    ...actual,
    createTeam: vi.fn(),
    findTeamById: vi.fn(),
    listTeamMembers: vi.fn(),
    updateTeam: vi.fn(),
  };
});

const client = {} as unknown as SupabaseClient;

function teamRow(overrides: Partial<FinderTeamRow> = {}): FinderTeamRow {
  return {
    id: "team-1",
    slug: "night-hawks",
    name: "Night Hawks",
    logo_url: null,
    game: "bgmi",
    region: "IN-North",
    description: null,
    current_level: "community",
    target_level: "competitive",
    captain_user_id: "user-1",
    recruiting: true,
    contact_mode: "application_only",
    external_link: null,
    is_public: true,
    created_by: "user-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const validCreate = {
  slug: "night-hawks",
  name: "Night Hawks",
  game: "bgmi" as const,
  region: "IN-North",
  current_level: "community" as const,
  target_level: "competitive" as const,
  recruiting: true,
  contact_mode: "application_only" as const,
  is_public: true,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("team-service — create", () => {
  it("derives captain/owner from the session, never the client", async () => {
    vi.mocked(createTeam).mockResolvedValue(teamRow());
    const team = await createMyTeam(client, "user-1", validCreate);
    expect(team.slug).toBe("night-hawks");
    expect(createTeam).toHaveBeenCalledWith(
      client,
      "user-1",
      expect.objectContaining({ slug: "night-hawks", name: "Night Hawks" }),
    );
    // No client-supplied ownership field reaches the repository.
    const patch = vi.mocked(createTeam).mock.calls[0]?.[2] ?? {};
    expect(patch).not.toHaveProperty("captain_user_id");
    expect(patch).not.toHaveProperty("created_by");
  });

  it("rejects invalid slugs at the application layer", async () => {
    await expect(
      createMyTeam(client, "user-1", { ...validCreate, slug: "Bad Slug!" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(createTeam).not.toHaveBeenCalled();
  });

  it("maps slug conflicts to a safe conflict message", async () => {
    vi.mocked(createTeam).mockRejectedValue({
      code: "23505",
      message: 'duplicate key value violates unique constraint "finder_teams_slug_key"',
    });
    await expect(createMyTeam(client, "user-1", validCreate)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("team-service — captain authorization", () => {
  it("allows the captain and the creator", async () => {
    vi.mocked(findTeamById).mockResolvedValue(teamRow());
    await expect(assertTeamCaptain(client, "team-1", "user-1")).resolves.toMatchObject({
      id: "team-1",
    });
    vi.mocked(findTeamById).mockResolvedValue(
      teamRow({ captain_user_id: "other", created_by: "user-2" }),
    );
    await expect(assertTeamCaptain(client, "team-1", "user-2")).resolves.toBeDefined();
  });

  it("allows roster captains (member role path)", async () => {
    vi.mocked(findTeamById).mockResolvedValue(
      teamRow({ captain_user_id: "other", created_by: "other" }),
    );
    vi.mocked(listTeamMembers).mockResolvedValue([
      { team_id: "team-1", user_id: "user-9", role: "captain", game_role: null, joined_at: "" },
    ]);
    await expect(assertTeamCaptain(client, "team-1", "user-9")).resolves.toBeDefined();
  });

  it("rejects plain members and strangers", async () => {
    vi.mocked(findTeamById).mockResolvedValue(
      teamRow({ captain_user_id: "other", created_by: "other" }),
    );
    vi.mocked(listTeamMembers).mockResolvedValue([
      { team_id: "team-1", user_id: "user-9", role: "player", game_role: null, joined_at: "" },
    ]);
    await expect(assertTeamCaptain(client, "team-1", "user-9")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns not-found for unknown teams", async () => {
    vi.mocked(findTeamById).mockResolvedValue(null);
    await expect(assertTeamCaptain(client, "missing", "user-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("team-service — update", () => {
  it("blocks non-captain updates before any write", async () => {
    vi.mocked(findTeamById).mockResolvedValue(
      teamRow({ captain_user_id: "other", created_by: "other" }),
    );
    vi.mocked(listTeamMembers).mockResolvedValue([]);
    await expect(
      updateMyTeam(client, "user-2", "team-1", {
        name: "Hijacked",
        region: "IN-South",
        current_level: "community",
        target_level: "competitive",
        recruiting: true,
        contact_mode: "application_only",
        is_public: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateTeam).not.toHaveBeenCalled();
  });
});
