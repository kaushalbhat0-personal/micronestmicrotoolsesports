import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertLockPrerequisites,
  buildLockSnapshot,
  requireTieBreakerOwned,
  resolveOwnedCompetition,
  toCreateCompetitionInput,
} from "./tie-breaker-foundation";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import * as teamRepo from "@/server/repositories/tie-breaker-teams";
import * as resultRepo from "@/server/repositories/tie-breaker-results";
import { AppError } from "@/lib/errors";

vi.mock("@/server/repositories/tie-breaker-competitions");
vi.mock("@/server/repositories/tie-breaker-teams");
vi.mock("@/server/repositories/tie-breaker-results");

const supabase = {} as SupabaseClient;
const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function comp(overrides: Partial<compRepo.TieBreakerCompetitionRow> = {}): compRepo.TieBreakerCompetitionRow {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    organization_id: ORG,
    created_by: USER,
    name: "Monsoon Cup — Group A",
    description: null,
    status: "active",
    scoring_win: 3,
    scoring_draw: 1,
    scoring_loss: 0,
    draws_enabled: false,
    round_label: "rounds",
    rule_order: ["points", "h2h", "map_diff"],
    preset_ref: "round_robin",
    share_token: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    record_number: null,
    locked_at: null,
    locked_snapshot: null,
    cloned_from: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp());
  vi.mocked(teamRepo.listTieBreakerTeamsByCompetition).mockResolvedValue([
    {
      id: "11111111-1111-4111-8111-111111111111",
      competition_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organization_id: ORG,
      name: "Falcons",
      short_name: null,
      logo_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      competition_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organization_id: ORG,
      name: "Sentinels",
      short_name: null,
      logo_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
  vi.mocked(resultRepo.listTieBreakerResultsByCompetition).mockResolvedValue([
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      competition_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      organization_id: ORG,
      team_a_id: "11111111-1111-4111-8111-111111111111",
      team_b_id: "22222222-2222-4222-8222-222222222222",
      winner: "team_a",
      maps_a: 2,
      maps_b: 0,
      rounds_a: null,
      rounds_b: null,
      played_at: null,
      notes: "Private note — never shared",
      is_complete: true,
      created_by: USER,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]);
});

describe("tie-breaker foundation service", () => {
  it("builds a create-competition input from validated data", () => {
    const created = toCreateCompetitionInput(ORG, USER, {
      name: "Monsoon Cup",
      description: null,
      scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" },
      ruleOrder: ["points", "h2h"],
      presetRef: "round_robin",
    });
    expect(created.organization_id).toBe(ORG);
    expect(created.rule_order).toEqual(["points", "h2h"]);
  });

  it("rejects competition input without points in rule order", () => {
    expect(() =>
      toCreateCompetitionInput(ORG, USER, {
        name: "X",
        description: null,
        scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" },
        ruleOrder: ["h2h", "wins"],
        presetRef: null,
      }),
    ).toThrow();
  });

  it("resolves owned competition standings through the pure engine", async () => {
    const { standings } = await resolveOwnedCompetition(supabase, ORG, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(standings.entries.map((e) => e.teamId)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("refuses cross-organization access", async () => {
    await expect(resolveOwnedCompetition(supabase, "other-org", "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses to resolve a locked competition as editable", async () => {
    vi.mocked(compRepo.findTieBreakerCompetitionById).mockResolvedValue(comp({ status: "locked" }));
    await expect(resolveOwnedCompetition(supabase, ORG, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")).rejects.toThrow(
      "locked official result",
    );
  });

  it("enforces lock prerequisites with actionable messages", () => {
    const base = {
      teamCount: 4,
      completeResultCount: 3,
      incompleteResultCount: 0,
      unresolvedGroupCount: 0,
      ruleOrder: ["points", "h2h"],
      allowIncomplete: false,
      allowUnresolved: false,
    };
    expect(() => assertLockPrerequisites(base)).not.toThrow();
    expect(() => assertLockPrerequisites({ ...base, teamCount: 1 })).toThrow("at least 2 teams");
    expect(() => assertLockPrerequisites({ ...base, completeResultCount: 0 })).toThrow("completed result");
    expect(() => assertLockPrerequisites({ ...base, incompleteResultCount: 1 })).toThrow("incomplete");
    expect(() => assertLockPrerequisites({ ...base, incompleteResultCount: 1, allowIncomplete: true })).not.toThrow();
    expect(() => assertLockPrerequisites({ ...base, unresolvedGroupCount: 1 })).toThrow("remain tied");
    expect(() => assertLockPrerequisites({ ...base, unresolvedGroupCount: 1, allowUnresolved: true })).not.toThrow();
  });

  it("builds a snapshot without private notes", () => {
    const snapshot = buildLockSnapshot({
      competitionName: "Monsoon Cup",
      description: null,
      recordNumber: "TB-2026-00001",
      lockedAt: new Date().toISOString(),
      ruleOrder: ["points", "h2h"],
      scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" },
      standings: {
        entries: [],
        tieGroups: [],
        evaluations: [],
        explanations: [],
        rulesApplied: ["points", "h2h"],
        engineVersion: "tie-breaker-engine/1",
      },
      teamNames: {},
      organizationName: "Acme",
      organizationLogoUrl: null,
    });
    expect(snapshot.recordNumber).toBe("TB-2026-00001");
    expect(JSON.stringify(snapshot)).not.toContain("Private note");
  });

  it("requireTieBreakerOwned distinguishes missing from foreign rows", () => {
    try {
      requireTieBreakerOwned(null, ORG);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("NOT_FOUND");
    }
    try {
      requireTieBreakerOwned(comp({ organization_id: "other" }), ORG);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
    }
  });
});
