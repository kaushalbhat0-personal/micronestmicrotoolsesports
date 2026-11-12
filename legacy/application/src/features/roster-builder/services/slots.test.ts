import { describe, expect, it } from "vitest";
import { parseRosterText } from "./parser";
import {
  addTeam,
  assignSlots,
  buildWorkingModel,
  movePlayerDown,
  movePlayerUp,
  moveTeamDown,
  moveTeamUp,
  removeTeam,
  reorderTeams,
} from "./slots";
import { type ParsedRow, type WorkingTeam } from "../types";

function model(text: string) {
  const result = parseRosterText(text);
  if (!result.ok) throw new Error(`expected ok: ${result.error.message}`);
  return buildWorkingModel(result.rows);
}

function teamKeys(teams: ReadonlyArray<WorkingTeam>): string[] {
  return teams.map((t) => t.teamKey);
}

describe("buildWorkingModel", () => {
  it("orders teams first-seen and players in input order", () => {
    const { teams } = model("Bravo\tKaran\nAlpha\tRahul\nBravo\tZed");
    expect(teamKeys(teams)).toEqual(["bravo", "alpha"]);
    expect(teams[0]?.players.map((p) => p.playerDisplay)).toEqual(["Karan", "Zed"]);
    expect(teams[0]?.teamDisplay).toBe("Bravo");
  });

  it("keeps the first-seen display name for variant spellings", () => {
    const { teams } = model("Alpha\tRahul\nALPHA\tKaran");
    expect(teams).toHaveLength(1);
    expect(teams[0]?.teamDisplay).toBe("Alpha");
    expect(teams[0]?.players).toHaveLength(2);
  });

  it("drops missing and malformed rows (issues cover them, not the model)", () => {
    const { teams } = model("Alpha\tRahul\n\tKaran\nBravo\t\nAlpha,Karan");
    expect(teamKeys(teams)).toEqual(["alpha"]);
    expect(teams[0]?.players.map((p) => p.playerDisplay)).toEqual(["Rahul"]);
  });

  it("never mutates the input rows", () => {
    const result = parseRosterText("Bravo\tKaran\nAlpha\tRahul");
    if (!result.ok) throw new Error("expected ok");
    const snapshot = JSON.parse(JSON.stringify(result.rows)) as unknown;
    buildWorkingModel(result.rows as ParsedRow[]);
    expect(result.rows).toEqual(snapshot);
  });
});

describe("assignSlots", () => {
  it("derives contiguous slots from order (index + 1, no gaps)", () => {
    const { teams } = model("Bravo\tKaran\nAlpha\tRahul\nCharlie\tZed");
    expect(assignSlots(teams)).toEqual([
      { slot: 1, teamKey: "bravo", teamDisplay: "Bravo", playerCount: 1 },
      { slot: 2, teamKey: "alpha", teamDisplay: "Alpha", playerCount: 1 },
      { slot: 3, teamKey: "charlie", teamDisplay: "Charlie", playerCount: 1 },
    ]);
  });

  it("renumbers after reorder", () => {
    const { teams } = model("A\t1\nB\t2\nC\t3");
    const moved = moveTeamUp(teams, "c");
    expect(assignSlots(moved).map((s) => s.teamKey)).toEqual(["a", "c", "b"]);
    expect(assignSlots(moved).map((s) => s.slot)).toEqual([1, 2, 3]);
  });
});

describe("moveTeamUp / moveTeamDown", () => {
  it("moves teams and leaves the input untouched", () => {
    const { teams } = model("A\t1\nB\t2\nC\t3");
    expect(teamKeys(moveTeamDown(teams, "a"))).toEqual(["b", "a", "c"]);
    expect(teamKeys(moveTeamUp(teams, "c"))).toEqual(["a", "c", "b"]);
    expect(teamKeys(teams)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op at the boundaries and for unknown keys", () => {
    const { teams } = model("A\t1\nB\t2");
    expect(teamKeys(moveTeamUp(teams, "a"))).toEqual(["a", "b"]);
    expect(teamKeys(moveTeamDown(teams, "b"))).toEqual(["a", "b"]);
    expect(teamKeys(moveTeamUp(teams, "zzz"))).toEqual(["a", "b"]);
    expect(teamKeys(moveTeamDown(teams, "zzz"))).toEqual(["a", "b"]);
  });
});

describe("reorderTeams", () => {
  it("moves by position and clamps out-of-range targets", () => {
    const { teams } = model("A\t1\nB\t2\nC\t3");
    expect(teamKeys(reorderTeams(teams, 0, 2))).toEqual(["b", "c", "a"]);
    expect(teamKeys(reorderTeams(teams, 2, 0))).toEqual(["c", "a", "b"]);
    expect(teamKeys(reorderTeams(teams, 0, 99))).toEqual(["b", "c", "a"]);
    expect(teamKeys(reorderTeams(teams, 5, 0))).toEqual(["a", "b", "c"]);
    expect(teamKeys(reorderTeams(teams, 1, 1))).toEqual(["a", "b", "c"]);
  });
});

describe("movePlayerUp / movePlayerDown", () => {
  it("reorders players within a team only", () => {
    const { teams } = model("A\t1\nA\t2\nB\t3");
    const down = movePlayerDown(teams, "a", "r1");
    expect(down[0]?.players.map((p) => p.playerDisplay)).toEqual(["2", "1"]);
    expect(down[1]?.players.map((p) => p.playerDisplay)).toEqual(["3"]);
    const up = movePlayerUp(down, "a", "r1");
    expect(up[0]?.players.map((p) => p.playerDisplay)).toEqual(["1", "2"]);
  });

  it("is a no-op at boundaries and for unknown rows/teams", () => {
    const { teams } = model("A\t1\nA\t2");
    expect(movePlayerUp(teams, "a", "r1")[0]?.players.map((p) => p.rowId)).toEqual(["r1", "r2"]);
    expect(movePlayerDown(teams, "a", "r2")[0]?.players.map((p) => p.rowId)).toEqual(["r1", "r2"]);
    expect(movePlayerUp(teams, "zzz", "r1")).toEqual(movePlayerUp(teams, "zzz", "r1"));
    expect(teamKeys(teams)).toEqual(["a"]);
  });
});

describe("addTeam / removeTeam", () => {
  it("adds empty teams and rejects blanks and duplicates", () => {
    const { teams } = model("A\t1");
    const added = addTeam(teams, "  Bravo  ");
    expect(added.added).toBe(true);
    expect(added.teams[1]).toMatchObject({ teamKey: "bravo", teamDisplay: "Bravo", players: [] });
    expect(addTeam(added.teams, "BRAVO").added).toBe(false);
    expect(addTeam(added.teams, "   ").added).toBe(false);
    expect(teamKeys(teams)).toEqual(["a"]);
  });

  it("removes teams with their players in the quarantine payload", () => {
    const { teams } = model("A\t1\nA\t2\nB\t3");
    const { teams: rest, removed } = removeTeam(teams, "a");
    expect(teamKeys(rest)).toEqual(["b"]);
    expect(removed).toMatchObject({ teamKey: "a", teamDisplay: "A" });
    expect(removed?.players.map((p) => p.playerDisplay)).toEqual(["1", "2"]);
    expect(teamKeys(teams)).toEqual(["a", "b"]);
  });

  it("returns null removal for unknown teams", () => {
    const { teams } = model("A\t1");
    const { teams: rest, removed } = removeTeam(teams, "zzz");
    expect(removed).toBeNull();
    expect(teamKeys(rest)).toEqual(["a"]);
  });
});
