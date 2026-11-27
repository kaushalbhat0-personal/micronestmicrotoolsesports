import type { RuleEvaluation, RuleId } from "../types";
import { RULE_LABELS } from "../presets";

/**
 * Tie-Breaker Resolver — Explanation text builders.
 *
 * Pure string building from structured evaluation facts. No JSX, no UI copy
 * beyond plain-language sentences. Private notes never enter these builders.
 */

function formatValue(rule: RuleId, value: number | null): string {
  if (value === null) return "no data";
  if (rule === "map_diff" || rule === "round_diff") {
    return value > 0 ? `+${value}` : `${value}`;
  }
  return `${value}`;
}

function rulePhrase(rule: RuleId): string {
  if (rule === "h2h") return "Head-to-head";
  return RULE_LABELS[rule];
}

function listNames(names: readonly string[]): string {
  if (names.length === 1) return names[0] as string;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Falcons and Sentinels finished on 12 points." style opener for a tied check. */
function tiedLine(ids: readonly string[], names: readonly string[], evaluation: RuleEvaluation): string {
  const rule = evaluation.rule;
  const firstValue = evaluation.values[ids[0] as string] ?? null;
  if (rule === "points") return `${listNames(names)} finished on ${formatValue(rule, firstValue)} points`;
  if (rule === "h2h") return `${rulePhrase(rule)} among ${listNames(names)} was tied`;
  if (rule === "wins") return `${listNames(names)} each finished on ${formatValue(rule, firstValue)} wins`;
  return `${listNames(names)} were tied on ${rulePhrase(rule).toLowerCase()} (${formatValue(rule, firstValue)})`;
}

function decisiveLine(
  upperNames: readonly string[],
  lowerNames: readonly string[],
  rule: RuleId,
  values: Readonly<Record<string, number | null>>,
  upperIds: readonly string[],
  lowerIds: readonly string[],
): string {
  const upperValues = upperIds.map((id) => formatValue(rule, values[id] ?? null)).join(", ");
  const lowerValues = lowerIds.map((id) => formatValue(rule, values[id] ?? null)).join(", ");
  return `${rulePhrase(rule)} therefore placed ${listNames(upperNames)} above ${listNames(lowerNames)} (${upperValues} vs ${lowerValues})`;
}

export function buildSeparationSummary(
  groupNames: readonly string[],
  groupIds: readonly string[],
  checked: readonly RuleEvaluation[],
  decisive: RuleId,
  decisiveValues: Readonly<Record<string, number | null>>,
  upperIds: readonly string[],
  lowerIds: readonly string[],
  nameOf: (id: string) => string,
): string {
  const lines: string[] = [];
  const tiedChecks = checked.filter((e) => e.rule !== decisive);
  if (tiedChecks.length === 0) {
    lines.push(`${listNames(groupNames)} were compared on ${rulePhrase(decisive).toLowerCase()}`);
  } else {
    const first = tiedChecks[0] as RuleEvaluation;
    lines.push(`${tiedLine(groupIds, groupNames, first)}.`);
    for (const e of tiedChecks.slice(1)) {
      lines.push(`${rulePhrase(e.rule)} was also tied.`);
    }
  }
  lines.push(
    `${decisiveLine(upperIds.map(nameOf), lowerIds.map(nameOf), decisive, decisiveValues, upperIds, lowerIds)}.`,
  );
  return lines.join(" ");
}

export function buildUnresolvedSummary(
  names: readonly string[],
  checked: readonly RuleEvaluation[],
  roundLabel: string,
): string {
  const parts: string[] = [];
  parts.push(`${listNames(names)} remain tied under your current rules.`);
  if (checked.length > 0) {
    const tried = checked.map((e) => rulePhrase(e.rule).toLowerCase()).join(", ");
    parts.push(`Checked: ${tried}.`);
  }
  const missing = checked.filter((e) => Object.values(e.values).some((v) => v === null));
  if (missing.length > 0) {
    parts.push(
      `Adding missing ${roundLabel === "games" ? "game" : "round"} or map scores may help the next rule decide.`,
    );
  }
  parts.push("You can finish and lock with this tie marked as officially tied.");
  return parts.join(" ");
}
