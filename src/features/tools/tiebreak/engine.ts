// P7 tie-break & qualification simulator — pure deterministic engine.
// No I/O, no dates, no randomness: every operation takes a TiebreakScenario
// and returns a new one (immutable updates) or throws ScenarioError. The
// runner renders derived standings; it never recomputes rules.
//
// Load-bearing rules:
// - Totals are exact integer sums of value × weight (max |total| = 8 ×
//   10^6 × 10^3 = 8×10^9, far below 2^53 — no floating point anywhere).
// - Ranking is total-first, then criteria in explicit priority order, each
//   with its own direction (higher-wins / lower-wins). No hidden secondary
//   sort exists: teams equal on the total and every criterion stay tied.
// - Display order inside a tie group is entry order and is never a rank.
//   Alphabetical name order never influences competition ranking.
// - Missing values count as 0 and are always flagged (assumed: true) in
//   breakdowns — the engine never invents data silently.
// - Qualification cutoff ties are contested, never auto-resolved.

import {
  MAX_CRITERIA,
  MAX_CRITERION_NAME_LENGTH,
  MAX_SCENARIO_NAME_LENGTH,
  MAX_SCORE_VALUE,
  MAX_TEAMS,
  MAX_TEAM_NAME_LENGTH,
  MAX_WEIGHT,
  MIN_SCORE_VALUE,
  MIN_WEIGHT,
  type ScoreDirection,
} from "./schema";

export type { ScoreDirection };

export interface TiebreakCriterion {
  readonly id: string; // local handle (c1, c2, …) for operations only
  readonly name: string; // preserved exactly as entered
  readonly weight: number;
  readonly direction: ScoreDirection;
}

export interface TeamEntry {
  readonly id: string; // local handle (t1, t2, …) for operations only
  readonly seq: number; // entry order; display tie-break only, never a rank
  readonly displayName: string; // preserved exactly as entered
  /** Entered values keyed by criterion id. Absent key = not entered. */
  readonly values: Readonly<Record<string, number>>;
}

export interface TiebreakScenario {
  readonly name: string | null;
  readonly criteria: ReadonlyArray<TiebreakCriterion>;
  readonly teams: ReadonlyArray<TeamEntry>;
  /** 0 = no cutoff configured; otherwise "top N qualify". */
  readonly cutoff: number;
  readonly nextTeamSeq: number;
  readonly nextCriterionSeq: number;
}

export type QualificationStatus = "no-cutoff" | "qualified" | "out" | "contested";

export interface ScoreContribution {
  readonly criterionId: string;
  readonly name: string;
  readonly weight: number;
  readonly direction: ScoreDirection;
  readonly value: number | null; // null = not entered
  readonly assumed: boolean; // true when counted as 0 without entry
  readonly contribution: number; // effective value × weight
}

export interface DecidedBy {
  readonly criterionName: string;
  readonly teamValue: number;
  readonly otherValue: number;
  readonly otherName: string;
  readonly direction: ScoreDirection;
}

export interface TeamStanding {
  readonly teamId: string;
  readonly displayName: string;
  readonly total: number;
  readonly contributions: ReadonlyArray<ScoreContribution>;
  /** Standard competition ranking ("1224"): tied teams share a rank. */
  readonly rank: number;
  readonly tieSize: number;
  readonly tieMates: ReadonlyArray<string>; // display names of tied teams
  readonly decidedBy: DecidedBy | null; // null when top of group or tied
  readonly explanation: string;
  readonly qualification: QualificationStatus;
  readonly qualificationNote: string | null;
}

export interface StandingsResult {
  readonly standings: ReadonlyArray<TeamStanding>;
  readonly teamCount: number;
  readonly criterionCount: number;
  readonly cutoff: number;
  readonly cutoffContested: boolean;
  readonly assumedCount: number; // values counted as 0 without entry
}

export type ScenarioErrorCode =
  | "INVALID_INPUT"
  | "DUPLICATE_TEAM"
  | "DUPLICATE_CRITERION"
  | "UNKNOWN_TEAM"
  | "UNKNOWN_CRITERION"
  | "TOO_MANY_TEAMS"
  | "TOO_MANY_CRITERIA"
  | "CUTOFF_OUT_OF_RANGE";

export class ScenarioError extends Error {
  readonly code: ScenarioErrorCode;

  constructor(code: ScenarioErrorCode, message: string) {
    super(message);
    this.name = "ScenarioError";
    this.code = code;
  }
}

/**
 * Name normalization for duplicate detection (same convention as P6):
 * trim, collapse inner whitespace, lowercase. Display values are always
 * preserved verbatim.
 */
export function normalizeEntryName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function checkTeamName(displayName: string): void {
  const trimmed = displayName.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_TEAM_NAME_LENGTH) {
    throw new ScenarioError("INVALID_INPUT", "Team name must be 2–40 characters.");
  }
}

function checkCriterionName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > MAX_CRITERION_NAME_LENGTH) {
    throw new ScenarioError("INVALID_INPUT", "Criterion name must be 2–32 characters.");
  }
}

function checkWeight(weight: number): void {
  if (!Number.isInteger(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
    throw new ScenarioError(
      "INVALID_INPUT",
      `Weight must be a whole number from ${MIN_WEIGHT} to ${MAX_WEIGHT}.`,
    );
  }
}

function checkScoreValue(value: number): void {
  if (!Number.isInteger(value) || value < MIN_SCORE_VALUE || value > MAX_SCORE_VALUE) {
    throw new ScenarioError(
      "INVALID_INPUT",
      `Scores must be whole numbers from ${MIN_SCORE_VALUE} to ${MAX_SCORE_VALUE}.`,
    );
  }
}

function checkCutoff(cutoff: number): void {
  if (!Number.isInteger(cutoff) || cutoff < 0 || cutoff > MAX_TEAMS) {
    throw new ScenarioError(
      "CUTOFF_OUT_OF_RANGE",
      `Cutoff must be a whole number from 0 (off) to ${MAX_TEAMS}.`,
    );
  }
}

function findTeam(scenario: TiebreakScenario, teamId: string): TeamEntry {
  const team = scenario.teams.find((t) => t.id === teamId);
  if (team === undefined) {
    throw new ScenarioError("UNKNOWN_TEAM", "That team is not in this scenario.");
  }
  return team;
}

function findCriterion(scenario: TiebreakScenario, criterionId: string): TiebreakCriterion {
  const criterion = scenario.criteria.find((c) => c.id === criterionId);
  if (criterion === undefined) {
    throw new ScenarioError("UNKNOWN_CRITERION", "That criterion is not in this scenario.");
  }
  return criterion;
}

export interface CreateScenarioInput {
  name?: string | undefined;
  cutoff?: number | undefined;
}

export function createScenario(input: CreateScenarioInput = {}): TiebreakScenario {
  const name = input.name?.trim() ?? "";
  if (name.length > MAX_SCENARIO_NAME_LENGTH) {
    throw new ScenarioError("INVALID_INPUT", "Scenario name may be at most 48 characters.");
  }
  const cutoff = input.cutoff ?? 0;
  checkCutoff(cutoff);
  return {
    name: name === "" ? null : name,
    criteria: [],
    teams: [],
    cutoff,
    nextTeamSeq: 1,
    nextCriterionSeq: 1,
  };
}

export function setScenarioMeta(
  scenario: TiebreakScenario,
  patch: { name?: string | undefined; cutoff?: number | undefined },
): TiebreakScenario {
  const name = patch.name === undefined ? (scenario.name ?? "") : patch.name.trim();
  if (name.length > MAX_SCENARIO_NAME_LENGTH) {
    throw new ScenarioError("INVALID_INPUT", "Scenario name may be at most 48 characters.");
  }
  const cutoff = patch.cutoff ?? scenario.cutoff;
  checkCutoff(cutoff);
  return { ...scenario, name: name === "" ? null : name, cutoff };
}

export function addTeam(scenario: TiebreakScenario, displayName: string): TiebreakScenario {
  checkTeamName(displayName);
  if (scenario.teams.length >= MAX_TEAMS) {
    throw new ScenarioError(
      "TOO_MANY_TEAMS",
      `This scenario holds at most ${MAX_TEAMS} teams. Remove one first.`,
    );
  }
  const normalized = normalizeEntryName(displayName);
  const clash = scenario.teams.find((t) => normalizeEntryName(t.displayName) === normalized);
  if (clash !== undefined) {
    throw new ScenarioError(
      "DUPLICATE_TEAM",
      `"${clash.displayName}" is already in this scenario (names match case-insensitively).`,
    );
  }
  const team: TeamEntry = {
    id: `t${scenario.nextTeamSeq}`,
    seq: scenario.nextTeamSeq,
    displayName: displayName.trim(),
    values: {},
  };
  return { ...scenario, teams: [...scenario.teams, team], nextTeamSeq: scenario.nextTeamSeq + 1 };
}

export function renameTeam(
  scenario: TiebreakScenario,
  teamId: string,
  displayName: string,
): TiebreakScenario {
  checkTeamName(displayName);
  findTeam(scenario, teamId);
  const normalized = normalizeEntryName(displayName);
  const clash = scenario.teams.find(
    (t) => t.id !== teamId && normalizeEntryName(t.displayName) === normalized,
  );
  if (clash !== undefined) {
    throw new ScenarioError(
      "DUPLICATE_TEAM",
      `"${clash.displayName}" is already in this scenario (names match case-insensitively).`,
    );
  }
  return {
    ...scenario,
    teams: scenario.teams.map((t) =>
      t.id === teamId ? { ...t, displayName: displayName.trim() } : t,
    ),
  };
}

export function removeTeam(scenario: TiebreakScenario, teamId: string): TiebreakScenario {
  findTeam(scenario, teamId);
  return { ...scenario, teams: scenario.teams.filter((t) => t.id !== teamId) };
}

/**
 * Set (or clear with null) a team's value for a criterion. Clearing removes
 * the key, returning the entry to "not entered" (counted as 0, flagged).
 */
export function setTeamValue(
  scenario: TiebreakScenario,
  teamId: string,
  criterionId: string,
  value: number | null,
): TiebreakScenario {
  findTeam(scenario, teamId);
  findCriterion(scenario, criterionId);
  if (value !== null) {
    checkScoreValue(value);
  }
  return {
    ...scenario,
    teams: scenario.teams.map((team) => {
      if (team.id !== teamId) {
        return team;
      }
      const values = { ...team.values };
      if (value === null) {
        delete values[criterionId];
      } else {
        values[criterionId] = value;
      }
      return { ...team, values };
    }),
  };
}

export interface CriterionInput {
  name: string;
  weight: number;
  direction: ScoreDirection;
}

export function addCriterion(scenario: TiebreakScenario, input: CriterionInput): TiebreakScenario {
  checkCriterionName(input.name);
  checkWeight(input.weight);
  if (input.direction !== "high" && input.direction !== "low") {
    throw new ScenarioError("INVALID_INPUT", "Direction must be higher-wins or lower-wins.");
  }
  if (scenario.criteria.length >= MAX_CRITERIA) {
    throw new ScenarioError(
      "TOO_MANY_CRITERIA",
      `This scenario holds at most ${MAX_CRITERIA} criteria. Remove one first.`,
    );
  }
  const normalized = normalizeEntryName(input.name);
  const clash = scenario.criteria.find((c) => normalizeEntryName(c.name) === normalized);
  if (clash !== undefined) {
    throw new ScenarioError(
      "DUPLICATE_CRITERION",
      `"${clash.name}" is already a criterion (names match case-insensitively).`,
    );
  }
  const criterion: TiebreakCriterion = {
    id: `c${scenario.nextCriterionSeq}`,
    name: input.name.trim(),
    weight: input.weight,
    direction: input.direction,
  };
  return {
    ...scenario,
    criteria: [...scenario.criteria, criterion],
    nextCriterionSeq: scenario.nextCriterionSeq + 1,
  };
}

export function updateCriterion(
  scenario: TiebreakScenario,
  criterionId: string,
  patch: Partial<CriterionInput>,
): TiebreakScenario {
  const current = findCriterion(scenario, criterionId);
  const name = patch.name === undefined ? current.name : patch.name;
  const weight = patch.weight ?? current.weight;
  const direction = patch.direction ?? current.direction;
  checkCriterionName(name);
  checkWeight(weight);
  if (direction !== "high" && direction !== "low") {
    throw new ScenarioError("INVALID_INPUT", "Direction must be higher-wins or lower-wins.");
  }
  const normalized = normalizeEntryName(name);
  const clash = scenario.criteria.find(
    (c) => c.id !== criterionId && normalizeEntryName(c.name) === normalized,
  );
  if (clash !== undefined) {
    throw new ScenarioError(
      "DUPLICATE_CRITERION",
      `"${clash.name}" is already a criterion (names match case-insensitively).`,
    );
  }
  return {
    ...scenario,
    criteria: scenario.criteria.map((c) =>
      c.id === criterionId ? { ...c, name: name.trim(), weight, direction } : c,
    ),
  };
}

/**
 * Remove a criterion and every value entered for it. This is the op's
 * explicit purpose (the runner confirms first); values belong to the
 * deleted criterion and are never silently kept or reassigned.
 */
export function removeCriterion(scenario: TiebreakScenario, criterionId: string): TiebreakScenario {
  findCriterion(scenario, criterionId);
  return {
    ...scenario,
    criteria: scenario.criteria.filter((c) => c.id !== criterionId),
    teams: scenario.teams.map((team) => {
      if (!(criterionId in team.values)) {
        return team;
      }
      const values = { ...team.values };
      delete values[criterionId];
      return { ...team, values };
    }),
  };
}

/**
 * Move a criterion up or down the priority order. At either end this is a
 * no-op returning the scenario unchanged (the runner disables the button).
 */
export function moveCriterion(
  scenario: TiebreakScenario,
  criterionId: string,
  direction: "up" | "down",
): TiebreakScenario {
  const index = scenario.criteria.findIndex((c) => c.id === criterionId);
  if (index === -1) {
    throw new ScenarioError("UNKNOWN_CRITERION", "That criterion is not in this scenario.");
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= scenario.criteria.length) {
    return scenario;
  }
  const criteria = [...scenario.criteria];
  const [moved] = criteria.splice(index, 1);
  criteria.splice(target, 0, moved!);
  return { ...scenario, criteria };
}

/** Effective value: entered, else 0 (always flagged via `assumed`). */
function effectiveValue(team: TeamEntry, criterionId: string): { value: number | null; effective: number } {
  const entered = team.values[criterionId];
  if (entered === undefined) {
    return { value: null, effective: 0 };
  }
  return { value: entered, effective: entered };
}

/** Negative when a sorts ahead of b; never consults names. */
function compareTeams(
  a: TeamEntry,
  b: TeamEntry,
  criteria: ReadonlyArray<TiebreakCriterion>,
  totals: ReadonlyMap<string, number>,
): number {
  const totalA = totals.get(a.id) ?? 0;
  const totalB = totals.get(b.id) ?? 0;
  if (totalA !== totalB) {
    return totalB - totalA;
  }
  for (const criterion of criteria) {
    const valueA = a.values[criterion.id] ?? 0;
    const valueB = b.values[criterion.id] ?? 0;
    if (valueA !== valueB) {
      return criterion.direction === "high" ? valueB - valueA : valueA - valueB;
    }
  }
  return 0;
}

function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${rank}th`;
  }
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

export function computeStandings(scenario: TiebreakScenario): StandingsResult {
  const totals = new Map<string, number>();
  const breakdowns = new Map<string, ScoreContribution[]>();
  let assumedCount = 0;

  for (const team of scenario.teams) {
    const contributions: ScoreContribution[] = scenario.criteria.map((criterion) => {
      const { value, effective } = effectiveValue(team, criterion.id);
      const assumed = value === null;
      if (assumed) {
        assumedCount += 1;
      }
      return {
        criterionId: criterion.id,
        name: criterion.name,
        weight: criterion.weight,
        direction: criterion.direction,
        value,
        assumed,
        contribution: effective * criterion.weight,
      };
    });
    breakdowns.set(
      team.id,
      contributions,
    );
    totals.set(team.id, contributions.reduce((sum, c) => sum + c.contribution, 0));
  }

  // Deterministic display order: entry order only. Names never sort.
  const ordered = [...scenario.teams].sort((a, b) => {
    const rank = compareTeams(a, b, scenario.criteria, totals);
    if (rank !== 0) {
      return rank;
    }
    return a.seq - b.seq;
  });

  // Tie groups: consecutive teams compareTeams() cannot separate.
  const groups: TeamEntry[][] = [];
  for (const team of ordered) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (
      last !== undefined &&
      prev !== undefined &&
      compareTeams(prev, team, scenario.criteria, totals) === 0
    ) {
      last.push(team);
    } else {
      groups.push([team]);
    }
  }

  const standings: TeamStanding[] = [];
  let ahead = 0;
  let cutoffContested = false;
  for (const group of groups) {
    const rank = ahead + 1;
    const tieSize = group.length;
    // Qualification from positions, never names: a group fully inside the
    // cutoff qualifies, fully outside is out, straddling is contested.
    const groupStart = ahead + 1;
    const groupEnd = ahead + group.length;
    let groupQualification: QualificationStatus = "no-cutoff";
    let groupQualificationNote: string | null = null;
    if (scenario.cutoff > 0) {
      if (groupEnd <= scenario.cutoff) {
        groupQualification = "qualified";
        groupQualificationNote = `Inside the top ${scenario.cutoff}.`;
      } else if (groupStart > scenario.cutoff) {
        groupQualification = "out";
        groupQualificationNote = `Outside the top ${scenario.cutoff}.`;
      } else {
        groupQualification = "contested";
        groupQualificationNote =
          `Tied across the top-${scenario.cutoff} cutoff — ` +
          `needs another criterion or a human decision. Not auto-qualified.`;
        cutoffContested = true;
      }
    }
    for (const team of group) {
      const mates = group.filter((m) => m.id !== team.id).map((m) => m.displayName);
      const total = totals.get(team.id) ?? 0;
      let decidedBy: DecidedBy | null = null;
      let explanation: string;
      if (tieSize > 1) {
        explanation =
          `Tied ${ordinal(rank)} with ${mates.map((m) => `"${m}"`).join(", ")}: ` +
          `identical on total ${total} and all ${scenario.criteria.length} ${scenario.criteria.length === 1 ? "criterion" : "criteria"} — ` +
          `needs another criterion or a human decision. Listed in entry order, not ranked order.`;
      } else {
        // Name the adjacent team sharing our total (above = the side we
        // lost the breaker to, else below = the side we beat). Teams in the
        // same tie group are handled above; only true neighbours qualify.
        const selfIndex = ordered.indexOf(team);
        const above = selfIndex > 0 ? ordered[selfIndex - 1] : undefined;
        const below = ordered[selfIndex + 1];
        const neighbour =
          above !== undefined && (totals.get(above.id) ?? 0) === total
            ? above
            : below !== undefined && (totals.get(below.id) ?? 0) === total
              ? below
              : undefined;
        if (neighbour !== undefined) {
          for (const criterion of scenario.criteria) {
            const mine = team.values[criterion.id] ?? 0;
            const theirs = neighbour.values[criterion.id] ?? 0;
            if (mine !== theirs) {
              decidedBy = {
                criterionName: criterion.name,
                teamValue: mine,
                otherValue: theirs,
                otherName: neighbour.displayName,
                direction: criterion.direction,
              };
              break;
            }
          }
          explanation =
            decidedBy === null
              ? `Ranked ${ordinal(rank)} of ${ordered.length} on total ${total}.`
              : `Ranked ${ordinal(rank)} of ${ordered.length} on total ${total}; ` +
                `tie with "${decidedBy.otherName}" broken by "${decidedBy.criterionName}" ` +
                `(${decidedBy.teamValue} vs ${decidedBy.otherValue}, ` +
                `${decidedBy.direction === "high" ? "higher" : "lower"} wins).`;
        } else {
          explanation = `Ranked ${ordinal(rank)} of ${ordered.length} on total ${total}.`;
        }
      }
      standings.push({
        teamId: team.id,
        displayName: team.displayName,
        total,
        contributions: breakdowns.get(team.id) ?? [],
        rank,
        tieSize,
        tieMates: mates,
        decidedBy,
        explanation,
        qualification: groupQualification,
        qualificationNote: groupQualificationNote,
      });
    }
    ahead += group.length;
  }

  return {
    standings,
    teamCount: scenario.teams.length,
    criterionCount: scenario.criteria.length,
    cutoff: scenario.cutoff,
    cutoffContested,
    assumedCount,
  };
}

/** Deterministic plain-text export. No internal ids, no official claims. */
export function buildScenarioSummary(scenario: TiebreakScenario): string {
  const result = computeStandings(scenario);
  const lines: string[] = [
    "Tie-Break & Qualification Simulator — scenario simulation (user-configured, not an official result)",
    `Scenario: ${scenario.name ?? "Unnamed scenario"}`,
    result.cutoff === 0
      ? "Cutoff: off (no qualification line)"
      : `Cutoff: top ${result.cutoff} qualify`,
    "",
    "Criteria (priority order):",
  ];
  if (scenario.criteria.length === 0) {
    lines.push("  (none — every team ties at total 0)");
  } else {
    scenario.criteria.forEach((criterion, index) => {
      lines.push(
        `  ${index + 1}. ${criterion.name} — weight ${criterion.weight}, ` +
          `${criterion.direction === "high" ? "higher" : "lower"} wins`,
      );
    });
  }
  lines.push("", "Standings:");
  if (result.standings.length === 0) {
    lines.push("  (no teams entered)");
  } else {
    for (const standing of result.standings) {
      const rankLabel =
        standing.tieSize > 1 ? `Tied ${ordinal(standing.rank)}` : ordinal(standing.rank);
      const qualLabel =
        standing.qualification === "no-cutoff"
          ? ""
          : standing.qualification === "qualified"
            ? " — QUALIFIED"
            : standing.qualification === "contested"
              ? " — CONTESTED AT CUTOFF"
              : " — OUT";
      lines.push(`  ${rankLabel}: ${standing.displayName} — total ${standing.total}${qualLabel}`);
      for (const part of standing.contributions) {
        const shown = part.value === null ? "not entered (counted as 0)" : String(part.value);
        lines.push(
          `      ${part.name}: ${shown} × ${part.weight} = ${part.contribution}`,
        );
      }
      lines.push(`      ${standing.explanation}`);
      if (standing.qualificationNote !== null && standing.qualification !== "no-cutoff") {
        lines.push(`      ${standing.qualificationNote}`);
      }
    }
  }
  if (result.assumedCount > 0) {
    lines.push(
      "",
      `Note: ${result.assumedCount} missing ${result.assumedCount === 1 ? "value was" : "values were"} counted as 0 (flagged above).`,
    );
  }
  lines.push(
    "",
    "Simulation based on your configured scoring rules. Not an official tournament result.",
  );
  return lines.join("\n");
}
