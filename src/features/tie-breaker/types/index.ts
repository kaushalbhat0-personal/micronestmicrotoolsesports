/**
 * Tie-Breaker Resolver — Domain types.
 *
 * Pure types only. No React, no Supabase, no browser APIs.
 * Persistence row shapes live in `src/server/repositories/tie-breaker-*.ts`;
 * these are the in-memory engine + service contract types.
 */

export type RuleId = "points" | "h2h" | "map_diff" | "round_diff" | "wins";

export const RULE_IDS: readonly RuleId[] = ["points", "h2h", "map_diff", "round_diff", "wins"];

export type RulePresetId = "round_robin" | "group_stage" | "swiss_lite";

export type CompetitionStatus = "draft" | "active" | "locked";

export type RoundLabel = "rounds" | "games";

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string | undefined;
  readonly logoUrl?: string | undefined;
}

export type ResultOutcome = { readonly kind: "win"; readonly winnerTeamId: string } | { readonly kind: "draw" };

export interface CompetitionResult {
  readonly id: string;
  readonly teamAId: string;
  readonly teamBId: string;
  readonly outcome: ResultOutcome;
  /** Maps won by team A / team B. Absent when map scores were not recorded. */
  readonly mapsA?: number | undefined;
  readonly mapsB?: number | undefined;
  /** Rounds (or games) won by team A / team B. Absent when not recorded. */
  readonly roundsA?: number | undefined;
  readonly roundsB?: number | undefined;
  /** Only complete results participate in ranking. Incomplete rows are stored but ignored. */
  readonly isComplete: boolean;
}

export interface ScoringConfig {
  readonly win: number;
  readonly draw: number;
  readonly loss: number;
  readonly drawsEnabled: boolean;
  readonly roundLabel: RoundLabel;
}

export const DEFAULT_SCORING: ScoringConfig = {
  win: 3,
  draw: 1,
  loss: 0,
  drawsEnabled: false,
  roundLabel: "rounds",
};

export type RuleOrder = readonly RuleId[];

export interface TeamAggregates {
  readonly teamId: string;
  readonly points: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly mapsWon: number;
  readonly mapsLost: number;
  readonly mapDiff: number;
  readonly hasMapData: boolean;
  readonly roundsWon: number;
  readonly roundsLost: number;
  readonly roundDiff: number;
  readonly hasRoundData: boolean;
}

/** A group of teams the configured rules could not separate. Never a ranking. */
export interface TieGroup {
  readonly memberIds: readonly string[];
  readonly reason: string;
  /** First rule that could have helped but lacked data, if any — drives "add scores" hints. */
  readonly nextRule?: RuleId | undefined;
}

export interface StandingsEntry {
  readonly teamId: string;
  readonly position: number;
  readonly points: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly mapDiff: number;
  readonly roundDiff: number;
  /** Rule that placed this team above the next team/group. Null when tied-unresolved or last. */
  readonly decisiveRule?: RuleId | undefined;
  /** True when this team sits inside an explicitly unresolved tied group. */
  readonly tied: boolean;
  /** Fellow members of the unresolved group (empty when not tied). */
  readonly tiedWith: readonly string[];
}

export interface RuleEvaluation {
  readonly rule: RuleId;
  /** Compared value per team. Null means the rule had no usable data for that team. */
  readonly values: Readonly<Record<string, number | null>>;
  readonly separated: boolean;
  readonly note: string;
}

/** Structured explanation facts. Renderers turn these into organizer / public / compact copy. */
export interface ExplanationFact {
  readonly scope: "separation" | "unresolved";
  readonly teamIds: readonly string[];
  readonly checkedRules: readonly RuleEvaluation[];
  readonly decisiveRule?: RuleId | undefined;
  readonly summary: string;
}

export interface StandingsResult {
  readonly entries: readonly StandingsEntry[];
  readonly tieGroups: readonly TieGroup[];
  readonly evaluations: readonly RuleEvaluation[];
  readonly explanations: readonly ExplanationFact[];
  readonly rulesApplied: readonly RuleId[];
  readonly engineVersion: string;
}

export interface LockPrerequisites {
  readonly teamCount: number;
  readonly completeResultCount: number;
  readonly hasPointsRule: boolean;
  readonly ruleCount: number;
  readonly incompleteResultCount: number;
  readonly unresolvedGroupCount: number;
}

export interface LockSnapshot {
  readonly competitionName: string;
  readonly description?: string | undefined;
  readonly recordNumber: string;
  readonly lockedAt: string;
  readonly ruleOrder: readonly RuleId[];
  readonly scoring: ScoringConfig;
    readonly standings: readonly StandingsEntry[];
    readonly explanations: readonly ExplanationFact[];
    readonly teamNames: Readonly<Record<string, string>>;
    readonly organizationName: string;
    readonly organizationLogoUrl?: string | undefined;
  }

/** Allowlisted public projection. Never contains notes, internal IDs, or draft data. */
export interface PublicShareRecord {
  readonly recordNumber: string;
  readonly competitionName: string;
  readonly description?: string | undefined;
  readonly lockedAt: string;
  readonly ruleOrder: readonly RuleId[];
  readonly scoring: ScoringConfig;
  readonly standings: readonly StandingsEntry[];
  readonly teamNames: Readonly<Record<string, string>>;
  readonly explanations: readonly ExplanationFact[];
  readonly organizationName: string;
  readonly organizationLogoUrl?: string | undefined;
}
