import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLockedRecord, getStandings } from "./standings";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");
vi.mock("@/server/repositories/tie-breaker-results");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const COMP = "comp-1";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function comp(status: compRepo.TieBreakerStatus = "active"): compRepo.TieBreakerCompetitionRow {
  return {
    id: COMP,
    organization_id: ORG,
    created_by: "user-1",
    name: "Monsoon Cup",
    description: null,
    status,
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "h2h"],
    preset_ref: null,
    share_token: "token-1",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function teams() {
  return [
    { id: A, competition_id: COMP, organization_id: ORG, name: "Falcons", short_name: null, logo_url: null, created_at: "", updated_at: "" },
    { id: B, competition_id: COMP, organization_id: ORG, name: "Sentinels", short_name: null, logo_url: null, created_at: "", updated_at: "" },
  ];
}

function winResult(): resultRepo.TieBreakerResultRow {
  return {
    id: "res-1",
    competition_id: COMP,
    organization_id: ORG,
    team_a_id: A,
    team_b_id: B,
    winner: "team_a",
    maps_a: null,
    maps_b: null,
    rounds_a: null,
    rounds_b: null,
    played_at: null,
    notes: null,
    is_complete: true,
    created_by: "user-1",
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue(teams());
  vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([winResult()]);
});

describe("standings service", () => {
  it("invokes the engine over owned rows and excludes incomplete results", async () => {
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([
      winResult(),
      { ...winResult(), id: "res-2", winner: null, is_complete: false },
    ]);
    const { standings } = await getStandings(supabase, ORG, COMP);
    expect(standings.entries.map((e) => e.teamId)).toEqual([A, B]);
    expect(standings.entries[0]?.points).toBe(3);
  });

  it("reflects scoring and rule-order changes without persisted state", async () => {
    const custom = { ...comp(), scoring_win: 2, scoring_draw: 1, scoring_loss: 0, rule_order: ["points", "wins"] };
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(custom);
    const { standings } = await getStandings(supabase, ORG, COMP);
    expect(standings.entries[0]?.points).toBe(2);
    expect(standings.rulesApplied).toEqual(["points", "wins"]);
  });

  it("denies cross-org standings reads", async () => {
    await expect(getStandings(supabase, "other-org", COMP)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns locked records and rejects unlocked ones as official", async () => {
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue({
      ...comp("locked"),
      record_number: "TB-2026-00001",
      locked_snapshot: { standings: [] },
    });
    await expect(getLockedRecord(supabase, ORG, COMP)).resolves.toMatchObject({ record_number: "TB-2026-00001" });
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
    await expect(getLockedRecord(supabase, ORG, COMP)).rejects.toThrow("no official result");
  });
});
