import type {
  CompetitionResult,
  ExplanationFact,
  RuleEvaluation,
  RuleId,
  ScoringConfig,
  StandingsEntry,
  StandingsResult,
  Team,
  TeamAggregates,
  TieGroup,
} from "../types";
import { RULE_IDS } from "../types";
import { computeAggregates, evaluateRule } from "./rules";
import { buildSeparationSummary, buildUnresolvedSummary } from "./explain";

/**
 * Tie-Breaker Resolver — Deterministic resolution engine.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no auth,
 * no Date.now(), no Math.random(). Same input always yields same output.
 *
 * Contract: first decisive rule wins per tied group, recursively.
 * A rule that cannot separate a subgroup yields NO separation and the
 * engine continues with the next rule. Unresolved subgroups stay
 * explicitly unresolved — never alphabetical, random, or insertion order.
 */

export const TIE_BREAKER_ENGINE_VERSION = "tie-breaker-engine/1";

export interface ResolveInput {
  readonly teams: readonly Team[];
  /** Only complete results participate; incomplete rows are ignored defensively. */
  readonly results: readonly CompetitionResult[];
  readonly scoring: ScoringConfig;
  readonly ruleOrder: readonly RuleId[];
}

interface Slot {
  readonly memberIds: readonly string[];
  readonly unresolved: boolean;
}

function assertContract(input: ResolveInput): void {
  if (input.teams.length < 2) throw new Error("At least 2 teams are required to resolve standings");
  const ids = new Set<string>();
  for (const t of input.teams) {
    if (!t.id || !t.name.trim()) throw new Error("Every team needs an id and a name");
    if (ids.has(t.id)) throw new Error("Duplicate team id in engine input");
    ids.add(t.id);
  }
  if (input.ruleOrder.length === 0) throw new Error("At least one ranking rule is required");
  for (const r of input.ruleOrder) {
    if (!(RULE_IDS as readonly string[]).includes(r)) throw new Error(`Unknown ranking rule: ${r}`);
  }
  for (const r of input.results) {
    if (!ids.has(r.teamAId) || !ids.has(r.teamBId)) throw new Error("Result references an unknown team");
    if (r.teamAId === r.teamBId) throw new Error("A result cannot pair a team with itself");
    if (r.outcome.kind === "win" && r.outcome.winnerTeamId !== r.teamAId && r.outcome.winnerTeamId !== r.teamBId) {
      throw new Error("Winner must be one of the two teams in the result");
    }
    for (const v of [r.mapsA, r.mapsB, r.roundsA, r.roundsB]) {
      if (v !== undefined && v !== null && (!Number.isInteger(v) || v < 0)) {
        throw new Error("Scores must be non-negative whole numbers");
      }
    }
    if (r.mapsA !== undefined && r.mapsA !== null && r.mapsB !== undefined && r.mapsB !== null && r.outcome.kind === "win") {
      const winnerMaps = r.outcome.winnerTeamId === r.teamAId ? r.mapsA : r.mapsB;
      const loserMaps = r.outcome.winnerTeamId === r.teamAId ? r.mapsB : r.mapsA;
      if (winnerMaps < loserMaps) throw new Error("Winner's map score cannot be lower than the loser's");
    }
  }
  if (!Number.isInteger(input.scoring.win) || input.scoring.win < 0 || input.scoring.win > 10) {
    throw new Error("Scoring values must be whole numbers from 0 to 10");
  }
  if (!Number.isInteger(input.scoring.draw) || input.scoring.draw < 0 || input.scoring.draw > 10) {
    throw new Error("Scoring values must be whole numbers from 0 to 10");
  }
  if (!Number.isInteger(input.scoring.loss) || input.scoring.loss < 0 || input.scoring.loss > 10) {
    throw new Error("Scoring values must be whole numbers from 0 to 10");
  }
}

export function resolveStandings(input: ResolveInput): StandingsResult {
  assertContract(input);

  const teamIds = input.teams.map((t) => t.id);
  const nameOf = (id: string): string => input.teams.find((t) => t.id === id)?.name ?? id;
  const aggregates = computeAggregates(teamIds, input.results, input.scoring);

  const evaluations: RuleEvaluation[] = [];
  const explanations: ExplanationFact[] = [];
  const decisiveOf = new Map<string, RuleId | undefined>();
  for (const id of teamIds) decisiveOf.set(id, undefined);

  function resolveGroup(ids: readonly string[], startIndex: number, inherited: readonly RuleEvaluation[]): Slot[] {
    if (ids.length <= 1) return [{ memberIds: ids, unresolved: false }];

    const own: RuleEvaluation[] = [];
    for (let i = startIndex; i < input.ruleOrder.length; i++) {
      const rule = input.ruleOrder[i] as RuleId;
      const outcome = evaluateRule(rule, ids, aggregates, input.results, input.scoring);
      evaluations.push(outcome.evaluation);
      own.push(outcome.evaluation);
      if (!outcome.separates) continue;

      const partitions = outcome.partitions;
      const chain: readonly RuleEvaluation[] = [...inherited, ...own];
      // Overwrite semantics: the deeper (later) rule that touches a team
      // explains that team's final position within the subgroup.
      for (const part of partitions) {
        for (const id of part) decisiveOf.set(id, rule);
      }
      const upperIds = partitions.slice(0, -1).flat();
      const lowerIds = partitions[partitions.length - 1] as readonly string[];
      explanations.push({
        scope: "separation",
        teamIds: ids,
        checkedRules: chain,
        decisiveRule: rule,
        summary: buildSeparationSummary(
          ids.map(nameOf),
          ids,
          chain,
          rule,
          outcome.evaluation.values,
          upperIds,
          lowerIds,
          nameOf,
        ),
      });
      return partitions.flatMap((part) =>
        part.length === 1
          ? [{ memberIds: part, unresolved: false }]
          : resolveGroup(part, i + 1, [...inherited, ...own]),
      );
    }

    // No remaining rule separates this subgroup — explicitly unresolved.
    const chain: readonly RuleEvaluation[] = [...inherited, ...own];
    explanations.push({
      scope: "unresolved",
      teamIds: ids,
      checkedRules: chain,
      decisiveRule: undefined,
      summary: buildUnresolvedSummary(
        [...ids].map(nameOf),
        chain,
        input.scoring.roundLabel,
      ),
    });
    return [{ memberIds: ids, unresolved: true }];
  }

  const slots = resolveGroup(teamIds, 0, []);

  const tieGroups: TieGroup[] = [];
  const entries: StandingsEntry[] = [];
  let position = 1;
  for (const slot of slots) {
    if (slot.unresolved && slot.memberIds.length > 1) {
      // Display order inside an unresolved group is alphabetical by name for
      // readability ONLY — flagged as tied, never a ranking.
      const ordered = [...slot.memberIds].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      const checkedForGroup = explanations.find(
        (e) => e.scope === "unresolved" && e.teamIds.length === slot.memberIds.length && slot.memberIds.every((id) => e.teamIds.includes(id)),
      );
      const nextRule = checkedForGroup
        ? (input.ruleOrder.find((r) =>
            checkedForGroup.checkedRules.some((e) => e.rule === r && Object.values(e.values).some((v) => v === null)),
          ) ?? undefined)
        : undefined;
      tieGroups.push({
        memberIds: ordered,
        reason: "These teams remain tied under the configured rules",
        nextRule,
      });
      for (const id of ordered) {
        const agg = aggregates.get(id) as TeamAggregates;
        entries.push({
          teamId: id,
          position,
          points: agg.points,
          wins: agg.wins,
          draws: agg.draws,
          losses: agg.losses,
          mapDiff: agg.mapDiff,
          roundDiff: agg.roundDiff,
          decisiveRule: undefined,
          tied: true,
          tiedWith: ordered.filter((o) => o !== id),
        });
        position += 1;
      }
    } else {
      for (const id of slot.memberIds) {
        const agg = aggregates.get(id) as TeamAggregates;
        entries.push({
          teamId: id,
          position,
          points: agg.points,
          wins: agg.wins,
          draws: agg.draws,
          losses: agg.losses,
          mapDiff: agg.mapDiff,
          roundDiff: agg.roundDiff,
          decisiveRule: decisiveOf.get(id) ?? undefined,
          tied: false,
          tiedWith: [],
        });
        position += 1;
      }
    }
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    tieGroups: Object.freeze(tieGroups),
    evaluations: Object.freeze(evaluations),
    explanations: Object.freeze(explanations),
    rulesApplied: Object.freeze([...input.ruleOrder]),
    engineVersion: TIE_BREAKER_ENGINE_VERSION,
  }) as StandingsResult;
}
