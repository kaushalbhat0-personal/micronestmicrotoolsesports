// P7 tiebreak engine tests (pure, no database).
// Covers the full contract: empty/single/multi-team scenarios, exact score
// math, weights (incl. negative and zero), criterion priority, equal scores,
// resolved and unresolved ties, duplicates, missing values, invalid input,
// numeric limits, cutoffs (incl. ties across the line), determinism,
// immutability, and malformed input.

import { describe, expect, it } from "vitest";
import {
  ScenarioError,
  addCriterion,
  addTeam,
  buildScenarioSummary,
  computeStandings,
  createScenario,
  moveCriterion,
  normalizeEntryName,
  removeCriterion,
  removeTeam,
  renameTeam,
  setScenarioMeta,
  setTeamValue,
  updateCriterion,
  type TiebreakScenario,
} from "@/features/tools/tiebreak/engine";

function expectScenarioError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ScenarioError);
    expect((error as ScenarioError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ScenarioError(${code}) but nothing threw`);
}

/** Two criteria, three teams, distinct totals. */
function basic(): TiebreakScenario {
  let s = createScenario({ name: "Group A", cutoff: 2 });
  s = addCriterion(s, { name: "Placement", weight: 10, direction: "high" });
  s = addCriterion(s, { name: "Eliminations", weight: 1, direction: "high" });
  s = addTeam(s, "Alpha");
  s = addTeam(s, "Bravo");
  s = addTeam(s, "Charlie");
  const placement = s.criteria[0]!.id;
  const elims = s.criteria[1]!.id;
  s = setTeamValue(s, "t1", placement, 5);
  s = setTeamValue(s, "t1", elims, 12);
  s = setTeamValue(s, "t2", placement, 3);
  s = setTeamValue(s, "t2", elims, 20);
  s = setTeamValue(s, "t3", placement, 1);
  s = setTeamValue(s, "t3", elims, 4);
  return s;
}

describe("scenario setup", () => {
  it("starts empty with no cutoff", () => {
    const s = createScenario();
    expect(s.teams).toHaveLength(0);
    expect(s.criteria).toHaveLength(0);
    expect(s.cutoff).toBe(0);
    const result = computeStandings(s);
    expect(result.standings).toHaveLength(0);
    expect(result.cutoffContested).toBe(false);
  });

  it("rejects bad names and cutoffs", () => {
    expectScenarioError(() => createScenario({ cutoff: -1 }), "CUTOFF_OUT_OF_RANGE");
    expectScenarioError(() => createScenario({ cutoff: 25 }), "CUTOFF_OUT_OF_RANGE");
    expectScenarioError(() => createScenario({ name: "x".repeat(49) }), "INVALID_INPUT");
    expectScenarioError(() => setScenarioMeta(createScenario(), { cutoff: 99 }), "CUTOFF_OUT_OF_RANGE");
  });

  it("ranks a single team first with no tie", () => {
    let s = createScenario({ cutoff: 1 });
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addTeam(s, "Solo");
    const [standing] = computeStandings(s).standings;
    expect(standing?.rank).toBe(1);
    expect(standing?.tieSize).toBe(1);
    expect(standing?.qualification).toBe("qualified");
  });
});

describe("teams and criteria management", () => {
  it("rejects duplicate team and criterion names via normalization", () => {
    let s = createScenario();
    s = addTeam(s, "Team  Soul");
    expectScenarioError(() => addTeam(s, "team soul"), "DUPLICATE_TEAM");
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    expectScenarioError(
      () => addCriterion(s, { name: "  POINTS ", weight: 2, direction: "high" }),
      "DUPLICATE_CRITERION",
    );
    s = addTeam(s, "Rivals");
    expectScenarioError(() => renameTeam(s, "t1", "  RIVALS "), "DUPLICATE_TEAM");
  });

  it("enforces capacity caps and unknown ids", () => {
    let s = createScenario();
    for (let i = 0; i < 24; i += 1) {
      s = addTeam(s, `Team${i}`);
    }
    expectScenarioError(() => addTeam(s, "Extra"), "TOO_MANY_TEAMS");
    let c: TiebreakScenario = createScenario();
    for (let i = 0; i < 8; i += 1) {
      c = addCriterion(c, { name: `Crit${i}`, weight: 1, direction: "high" });
    }
    expectScenarioError(
      () => addCriterion(c, { name: "Ninth", weight: 1, direction: "high" }),
      "TOO_MANY_CRITERIA",
    );
    expectScenarioError(() => removeTeam(s, "t99"), "UNKNOWN_TEAM");
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    const pid = s.criteria[0]!.id;
    expectScenarioError(() => setTeamValue(s, "t1", "c99", 5), "UNKNOWN_CRITERION");
    expectScenarioError(() => setTeamValue(s, "t1", pid, 1_000_001), "INVALID_INPUT");
    expectScenarioError(() => moveCriterion(s, "c99", "up"), "UNKNOWN_CRITERION");
  });

  it("reorders criterion priority and drops values with a removed criterion", () => {
    let s = basic();
    const first = s.criteria[0]!.id;
    const second = s.criteria[1]!.id;
    s = moveCriterion(s, second, "up");
    expect(s.criteria[0]!.id).toBe(second);
    // Moving past the end is a no-op, not an error.
    const same = moveCriterion(s, second, "up");
    expect(same.criteria[0]!.id).toBe(second);
    s = removeCriterion(s, first);
    expect(s.criteria).toHaveLength(1);
    expect(s.teams.every((t) => !(first in t.values))).toBe(true);
  });

  it("updates weights and directions", () => {
    let s = basic();
    const id = s.criteria[0]!.id;
    s = updateCriterion(s, id, { weight: -3, direction: "low" });
    expect(s.criteria[0]).toMatchObject({ weight: -3, direction: "low" });
    expectScenarioError(() => updateCriterion(s, id, { weight: 5000 }), "INVALID_INPUT");
  });
});

describe("normalizeEntryName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeEntryName("  Team   Soul ")).toBe("team soul");
  });
});

describe("score calculation", () => {
  it("computes exact integer totals and per-criterion contributions", () => {
    const result = computeStandings(basic());
    const alpha = result.standings.find((st) => st.displayName === "Alpha")!;
    // 5×10 + 12×1 = 62.
    expect(alpha.total).toBe(62);
    expect(alpha.contributions).toEqual([
      expect.objectContaining({ name: "Placement", value: 5, weight: 10, contribution: 50, assumed: false }),
      expect.objectContaining({ name: "Eliminations", value: 12, weight: 1, contribution: 12, assumed: false }),
    ]);
    const totals = result.standings.map((st) => st.total);
    expect(totals).toEqual([62, 50, 14]);
  });

  it("applies negative and zero weights exactly", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 2, direction: "high" });
    s = addCriterion(s, { name: "Deaths", weight: -1, direction: "low" });
    s = addCriterion(s, { name: "Tracked", weight: 0, direction: "high" });
    s = addTeam(s, "Alpha");
    const points = s.criteria[0]!.id;
    const deaths = s.criteria[1]!.id;
    const tracked = s.criteria[2]!.id;
    s = setTeamValue(s, "t1", points, 10);
    s = setTeamValue(s, "t1", deaths, 3);
    s = setTeamValue(s, "t1", tracked, 99);
    const [standing] = computeStandings(s).standings;
    // 10×2 + 3×(-1) + 99×0 = 17.
    expect(standing?.total).toBe(17);
  });

  it("stays exact at the numeric limits", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Big", weight: 1000, direction: "high" });
    s = addTeam(s, "Max");
    s = setTeamValue(s, "t1", "c1", 1_000_000);
    const [standing] = computeStandings(s).standings;
    expect(standing?.total).toBe(1_000_000_000);
    expect(Number.isSafeInteger(standing?.total ?? NaN)).toBe(true);
    // 8 criteria × max value × max weight stays an exact integer.
    let wide = createScenario();
    for (let i = 0; i < 8; i += 1) {
      wide = addCriterion(wide, { name: `C${i}`, weight: 1000, direction: "high" });
    }
    wide = addTeam(wide, "Wide");
    for (const c of wide.criteria) {
      wide = setTeamValue(wide, "t1", c.id, 1_000_000);
    }
    const [w] = computeStandings(wide).standings;
    expect(w?.total).toBe(8_000_000_000);
    expect(Number.isSafeInteger(w?.total ?? NaN)).toBe(true);
  });
});

describe("ties", () => {
  function tiedTotals(): TiebreakScenario {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addCriterion(s, { name: "Wins", weight: 0, direction: "high" });
    s = addTeam(s, "Alpha");
    s = addTeam(s, "Bravo");
    s = addTeam(s, "Charlie");
    const points = s.criteria[0]!.id;
    const wins = s.criteria[1]!.id;
    // Alpha and Bravo tie on total 10; Bravo leads on Wins.
    s = setTeamValue(s, "t1", points, 10);
    s = setTeamValue(s, "t1", wins, 1);
    s = setTeamValue(s, "t2", points, 10);
    s = setTeamValue(s, "t2", wins, 3);
    s = setTeamValue(s, "t3", points, 4);
    return s;
  }

  it("breaks total ties by the first differing criterion in priority order", () => {
    const result = computeStandings(tiedTotals());
    expect(result.standings.map((st) => st.displayName)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(result.standings.map((st) => st.rank)).toEqual([1, 2, 3]);
    const alpha = result.standings[1]!;
    expect(alpha.decidedBy).toMatchObject({
      criterionName: "Wins",
      teamValue: 1,
      otherValue: 3,
      otherName: "Bravo",
    });
    expect(alpha.explanation).toContain('broken by "Wins" (1 vs 3, higher wins)');
  });

  it("honors lower-wins directions and later-priority criteria", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addCriterion(s, { name: "Deaths", weight: 0, direction: "low" });
    s = addTeam(s, "Alpha");
    s = addTeam(s, "Bravo");
    const points = s.criteria[0]!.id;
    const deaths = s.criteria[1]!.id;
    s = setTeamValue(s, "t1", points, 10);
    s = setTeamValue(s, "t1", deaths, 9);
    s = setTeamValue(s, "t2", points, 10);
    s = setTeamValue(s, "t2", deaths, 4);
    const result = computeStandings(s);
    expect(result.standings.map((st) => st.displayName)).toEqual(["Bravo", "Alpha"]);
    expect(result.standings[1]!.explanation).toContain("(9 vs 4, lower wins)");
  });

  it("leaves fully equal teams tied with no invented winner", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addTeam(s, "Zulu");
    s = addTeam(s, "Alpha");
    s = addTeam(s, "Mike");
    s = setTeamValue(s, "t1", "c1", 7);
    s = setTeamValue(s, "t2", "c1", 7);
    s = setTeamValue(s, "t3", "c1", 7);
    const result = computeStandings(s);
    // Entry order on display (never alphabetical), shared rank 1, next rank 4.
    expect(result.standings.map((st) => st.displayName)).toEqual(["Zulu", "Alpha", "Mike"]);
    expect(result.standings.map((st) => st.rank)).toEqual([1, 1, 1]);
    expect(result.standings[0]!.tieSize).toBe(3);
    expect(result.standings[0]!.decidedBy).toBeNull();
    expect(result.standings[0]!.explanation).toContain("needs another criterion or a human decision");
  });

  it("uses competition ranking after a tie (1224)", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    for (const name of ["A1", "A2", "B1", "C1"]) {
      s = addTeam(s, name);
    }
    s = setTeamValue(s, "t1", "c1", 10);
    s = setTeamValue(s, "t2", "c1", 10);
    s = setTeamValue(s, "t3", "c1", 5);
    s = setTeamValue(s, "t4", "c1", 1);
    expect(computeStandings(s).standings.map((st) => st.rank)).toEqual([1, 1, 3, 4]);
  });

  it("flags missing values as assumed-zero without inventing entries", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 3, direction: "high" });
    s = addTeam(s, "Alpha");
    s = addTeam(s, "Bravo");
    s = setTeamValue(s, "t1", "c1", 4);
    const result = computeStandings(s);
    const bravo = result.standings.find((st) => st.displayName === "Bravo")!;
    expect(bravo.total).toBe(0);
    expect(bravo.contributions[0]).toMatchObject({ value: null, assumed: true, contribution: 0 });
    expect(result.assumedCount).toBe(1);
  });
});

describe("qualification", () => {
  it("qualifies the top N cleanly when no tie crosses the line", () => {
    const result = computeStandings(basic()); // cutoff 2, totals 62/50/14
    expect(result.standings.map((st) => st.qualification)).toEqual([
      "qualified",
      "qualified",
      "out",
    ]);
    expect(result.cutoffContested).toBe(false);
  });

  it("contests a tie across the cutoff instead of picking a winner", () => {
    let s = createScenario({ cutoff: 1 });
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addTeam(s, "Alpha");
    s = addTeam(s, "Bravo");
    s = addTeam(s, "Charlie");
    s = setTeamValue(s, "t1", "c1", 9);
    s = setTeamValue(s, "t2", "c1", 9);
    s = setTeamValue(s, "t3", "c1", 2);
    const result = computeStandings(s);
    expect(result.standings.map((st) => st.qualification)).toEqual([
      "contested",
      "contested",
      "out",
    ]);
    expect(result.cutoffContested).toBe(true);
    expect(result.standings[0]!.qualificationNote).toContain("human decision");
    expect(result.standings[0]!.qualificationNote).toContain("Not auto-qualified");
  });

  it("reports no-cutoff for every team when the cutoff is off", () => {
    let s = basic();
    s = setScenarioMeta(s, { cutoff: 0 });
    const result = computeStandings(s);
    expect(result.standings.every((st) => st.qualification === "no-cutoff")).toBe(true);
    expect(result.cutoffContested).toBe(false);
  });

  it("leaves a cutoff larger than the field uncontested", () => {
    let s = basic();
    s = setScenarioMeta(s, { cutoff: 24 });
    const result = computeStandings(s);
    expect(result.standings.every((st) => st.qualification === "qualified")).toBe(true);
    expect(result.cutoffContested).toBe(false);
  });
});

describe("determinism and immutability", () => {
  it("computes identical standings on repeated runs", () => {
    const first = computeStandings(basic());
    const second = computeStandings(basic());
    expect(second).toEqual(first);
    expect(buildScenarioSummary(basic())).toBe(buildScenarioSummary(basic()));
  });

  it("never mutates its input", () => {
    const before = basic();
    const frozen = structuredClone(before);
    Object.freeze(before);
    computeStandings(before);
    buildScenarioSummary(before);
    expect(before).toEqual(frozen);
  });
});

describe("summary", () => {
  it("explains the calculation with no internal ids or official claims", () => {
    const summary = buildScenarioSummary(basic());
    expect(summary).toContain("Tie-Break & Qualification Simulator — scenario simulation");
    expect(summary).toContain("Cutoff: top 2 qualify");
    expect(summary).toContain("Placement — weight 10, higher wins");
    expect(summary).toContain("Alpha — total 62");
    expect(summary).toContain("QUALIFIED");
    expect(summary).toContain("Simulation based on your configured scoring rules");
    expect(summary).toContain("Not an official tournament result");
    expect(summary).not.toContain("t1");
    expect(summary).not.toContain("c1");
    expect(summary).not.toMatch(/officially|approved|verified/i);
  });

  it("names missing-data assumptions and empty states honestly", () => {
    let s = createScenario();
    s = addCriterion(s, { name: "Points", weight: 1, direction: "high" });
    s = addTeam(s, "Alpha");
    const summary = buildScenarioSummary(s);
    expect(summary).toContain("not entered (counted as 0)");
    expect(summary).toContain("counted as 0");
    expect(buildScenarioSummary(createScenario())).toContain("(no teams entered)");
  });
});
