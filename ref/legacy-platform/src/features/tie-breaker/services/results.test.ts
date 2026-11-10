import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addResult, deleteResult, listResults, updateResult } from "./results";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");
vi.mock("@/server/repositories/tie-breaker-results");

const supabase = {} as SupabaseClient;
const ORG = "org-1";
const USER = "user-1";
const COMP = "comp-1";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function comp(status: compRepo.TieBreakerStatus = "draft"): compRepo.TieBreakerCompetitionRow {
  return {
    id: COMP,
    organization_id: ORG,
    created_by: USER,
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

function team(id: string, name: string): teamRepo.TieBreakerTeamRow {
  return { id, competition_id: COMP, organization_id: ORG, name, short_name: null, logo_url: null, created_at: "", updated_at: "" };
}

function resultRow(overrides: Partial<resultRepo.TieBreakerResultRow> = {}): resultRepo.TieBreakerResultRow {
  return {
    id: "res-1",
    competition_id: COMP,
    organization_id: ORG,
    team_a_id: A,
    team_b_id: B,
    winner: "team_a",
    maps_a: 2,
    maps_b: 0,
    rounds_a: null,
    rounds_b: null,
    played_at: null,
    notes: null,
    is_complete: true,
    created_by: USER,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const completeInput = {
  teamAId: A,
  teamBId: B,
  winnerTeamId: A,
  isDraw: false,
  mapsA: 2,
  mapsB: 0,
  roundsA: null,
  roundsB: null,
  playedAt: null,
  notes: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue([team(A, "Falcons"), team(B, "Sentinels")]);
  vi.mocked(resultRepo.findTieBreakerResultsByPair).mockResolvedValue([]);
  vi.mocked(compRepo.updateTieBreakerCompetition).mockResolvedValue(comp("active"));
});

describe("result service", () => {
  it("adds a complete result and promotes draft → active", async () => {
    vi.mocked(resultRepo.createTieBreakerResult).mockResolvedValue(resultRow());
    const { result, duplicatePair } = await addResult(supabase, ORG, USER, COMP, completeInput);
    expect(result.is_complete).toBe(true);
    expect(duplicatePair).toBe(false);
    expect(compRepo.updateTieBreakerCompetition).toHaveBeenCalledWith(supabase, COMP, { status: "active" });
  });

  it("saves incomplete results without promoting or counting them", async () => {
    vi.mocked(resultRepo.createTieBreakerResult).mockResolvedValue(resultRow({ winner: null, is_complete: false }));
    const { result } = await addResult(supabase, ORG, USER, COMP, { ...completeInput, winnerTeamId: null });
    expect(result.is_complete).toBe(false);
    expect(compRepo.updateTieBreakerCompetition).not.toHaveBeenCalled();
  });

  it("flags duplicate pairs instead of rejecting them", async () => {
    vi.mocked(resultRepo.createTieBreakerResult).mockResolvedValue(resultRow({ id: "res-2" }));
    vi.mocked(resultRepo.findTieBreakerResultsByPair).mockResolvedValue([resultRow()]);
    const { duplicatePair } = await addResult(supabase, ORG, USER, COMP, completeInput);
    expect(duplicatePair).toBe(true);
  });

  it("rejects self-pairs, foreign teams, bad winners, and negative scores", async () => {
    // Schema violations surface as VALIDATION_ERROR with field-level details.
    await expect(addResult(supabase, ORG, USER, COMP, { ...completeInput, teamBId: A })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(addResult(supabase, ORG, USER, COMP, { ...completeInput, teamBId: C })).rejects.toThrow("belong to this competition");
    try {
      await addResult(supabase, ORG, USER, COMP, { ...completeInput, winnerTeamId: C });
      expect.unreachable();
    } catch (e) {
      const details = (e as { details?: { fieldErrors?: Record<string, string[]> } }).details;
      expect(details?.fieldErrors?.winnerTeamId?.join(" ")).toContain("one of the two teams");
    }
    await expect(addResult(supabase, ORG, USER, COMP, { ...completeInput, mapsA: -1 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(resultRepo.createTieBreakerResult).not.toHaveBeenCalled();
  });

  it("updates and deletes results with ownership and lock guards", async () => {
    vi.mocked(resultRepo.findTieBreakerResultById).mockResolvedValue(resultRow());
    vi.mocked(resultRepo.updateTieBreakerResult).mockResolvedValue(resultRow({ maps_a: 2, maps_b: 1 }));
    await expect(updateResult(supabase, ORG, COMP, "res-1", completeInput)).resolves.toMatchObject({ duplicatePair: false });
    vi.mocked(resultRepo.findTieBreakerResultById).mockResolvedValue(resultRow({ competition_id: "other" }));
    await expect(updateResult(supabase, ORG, COMP, "res-1", completeInput)).rejects.toThrow("does not belong");
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp("locked"));
    await expect(deleteResult(supabase, ORG, COMP, "res-1")).rejects.toThrow("locked official result");
  });

  it("lists results with duplicate-pair flags", async () => {
    vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([
      resultRow({ id: "r1" }),
      resultRow({ id: "r2" }),
    ]);
    const { results, duplicatePairIds } = await listResults(supabase, ORG, COMP);
    expect(results).toHaveLength(2);
    expect(duplicatePairIds).toEqual(expect.arrayContaining(["r1", "r2"]));
    await expect(listResults(supabase, "other-org", COMP)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
