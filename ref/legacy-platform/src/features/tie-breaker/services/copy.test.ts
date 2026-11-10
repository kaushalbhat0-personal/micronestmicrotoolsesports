import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copyCompetitionForNext } from "./copy";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";
const COMP = "comp-1";

function source(): compRepo.TieBreakerCompetitionRow {
  return {
    id: COMP,
    organization_id: ORG,
    created_by: USER,
    name: "Monsoon Cup",
    description: "Group stage",
    status: "locked",
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "map_diff"],
    preset_ref: "group_stage",
    share_token: "token-old",
    record_number: "TB-2026-00001",
    locked_at: new Date().toISOString(),
    locked_snapshot: { standings: [] },
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function team(id: string, name: string): teamRepo.TieBreakerTeamRow {
  return { id, competition_id: COMP, organization_id: ORG, name, short_name: null, logo_url: null, created_at: "", updated_at: "" };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(source());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue([team("t1", "Falcons"), team("t2", "Sentinels")]);
  vi.mocked(compRepo.createTieBreakerCompetition).mockImplementation(async (_s, input) => ({
    ...source(),
    id: "comp-2",
    status: "draft" as const,
    name: input.name,
    share_token: "token-new",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: COMP,
  }));
  vi.mocked(teamRepo.createTieBreakerTeam).mockImplementation(async (_s, input) => ({
    id: `new-${input.name}`,
    competition_id: "comp-2",
    organization_id: ORG,
    name: input.name,
    short_name: null,
    logo_url: null,
    created_at: "",
    updated_at: "",
  }));
});

describe("copy for next competition", () => {
  it("copies structure and teams into an independent draft", async () => {
    const { competition, teams } = await copyCompetitionForNext(supabase, ORG, USER, COMP);
    expect(competition.status).toBe("draft");
    expect(competition.name).toBe("Monsoon Cup (2)");
    expect(competition.rule_order).toEqual(["points", "map_diff"]);
    expect(competition.preset_ref).toBe("group_stage");
    expect(competition.description).toBe("Group stage");
    expect(competition.cloned_from).toBe(COMP);
    expect(teams.map((t) => t.name)).toEqual(["Falcons", "Sentinels"]);
    expect(teams.every((t) => t.competition_id === "comp-2")).toBe(true);
  });

  it("excludes results, snapshot, record, and share token", async () => {
    const { competition } = await copyCompetitionForNext(supabase, ORG, USER, COMP);
    expect(competition.record_number).toBeNull();
    expect(competition.locked_at).toBeNull();
    expect(competition.locked_snapshot).toBeNull();
    expect(competition.share_token).toBe("token-new");
    expect(competition.status).not.toBe("locked");
  });

  it("supports a team subset and rejects foreign selections", async () => {
    const { teams } = await copyCompetitionForNext(supabase, ORG, USER, COMP, { teamIds: ["t1"] });
    expect(teams.map((t) => t.name)).toEqual(["Falcons"]);
    await expect(copyCompetitionForNext(supabase, ORG, USER, COMP, { teamIds: ["nope"] })).rejects.toThrow(
      "do not belong",
    );
  });

  it("denies cross-org copies", async () => {
    await expect(copyCompetitionForNext(supabase, "other-org", USER, COMP)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
