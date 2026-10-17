/**
 * BGMI Tournament Hub — stage dataset validation.
 *
 * Runs ENTIRELY before any database write. Any failure rejects the whole
 * stage run: the previous published dataset stays intact and the error is
 * recorded in the ingestion ledger.
 *
 * Checks:
 * - source scoring table is the canonical 2026 table (no silent rescoring)
 * - completed matches: every listed team played, placements form a strict
 *   1..N permutation (no duplicates, no gaps), finishes within bounds
 * - per-result arithmetic: placement + finish points = match total
 * - stage: starting points non-negative, every match team has an entry,
 *   every entry team appears in the bracket
 * - source `placement=` hints: when present for EVERY team, the derived
 *   rank order must agree; partial hints are advisory only (Liquipedia
 *   editors fill these sporadically) and never fail a run
 */

import { integrationError } from "@/lib/errors";
import type { BgmiStageDataset } from "../types";
import { isCanonicalTable2026, matchTotal } from "./points";

export interface StageValidationWarning {
  readonly code: string;
  readonly message: string;
}

const MAX_FINISHES_PER_MATCH = 32;
const MAX_TEAMS_PER_MATCH = 32;

function fail(message: string): never {
  throw integrationError(`BGMI stage validation failed: ${message}`);
}

export function validateStageDataset(dataset: BgmiStageDataset): { warnings: StageValidationWarning[] } {
  const warnings: StageValidationWarning[] = [];
  const { placementPoints, finishPointValue } = dataset.scoring;

  if (!isCanonicalTable2026(placementPoints, finishPointValue)) {
    fail(
      `source scoring table changed (p1..p8=${placementPoints.join(",")}, p_kill=${finishPointValue}); refusing to ingest`
    );
  }

  if (dataset.teams.length === 0) fail("no teams in bracket");
  if (dataset.teams.length > MAX_TEAMS_PER_MATCH) fail(`too many teams: ${dataset.teams.length}`);

  const teamKeys = new Set(dataset.teams.map((t) => t.canonicalName));
  if (teamKeys.size !== dataset.teams.length) fail("duplicate team identity in bracket");

  const entryByTeam = new Map(dataset.entries.map((e) => [e.teamCanonical, e]));
  if (entryByTeam.size !== dataset.entries.length) fail("duplicate stage entry");
  for (const team of dataset.teams) {
    const entry = entryByTeam.get(team.canonicalName);
    if (!entry) fail(`bracket team has no stage entry: ${team.canonicalName}`);
    if (!Number.isInteger(entry.startingPoints) || entry.startingPoints < 0) {
      fail(`invalid starting points for ${team.canonicalName}`);
    }
  }
  for (const entry of dataset.entries) {
    if (!teamKeys.has(entry.teamCanonical)) fail(`stage entry has no bracket team: ${entry.teamCanonical}`);
  }

  const completedMatches = dataset.matches.filter((m) => m.status === "completed");
  for (const match of dataset.matches) {
    if (match.results.length === 0 && match.status === "completed") {
      fail(`completed match ${match.matchNumber} has no results`);
    }
    for (const result of match.results) {
      if (!teamKeys.has(result.teamCanonical)) fail(`match ${match.matchNumber}: unknown team ${result.teamCanonical}`);
      if (!Number.isInteger(result.placement) || result.placement < 1 || result.placement > dataset.teams.length) {
        fail(`match ${match.matchNumber}: placement out of range for ${result.teamCanonical}`);
      }
      if (!Number.isInteger(result.finishes) || result.finishes < 0 || result.finishes > MAX_FINISHES_PER_MATCH) {
        fail(`match ${match.matchNumber}: finishes out of range for ${result.teamCanonical}`);
      }
      const expected = matchTotal({ placement: result.placement, finishes: result.finishes });
      if (
        result.placementPoints !== expected.placementPoints ||
        result.finishPoints !== expected.finishPoints ||
        result.totalPoints !== expected.total
      ) {
        fail(`match ${match.matchNumber}: arithmetic mismatch for ${result.teamCanonical}`);
      }
    }
    if (match.status === "completed") {
      if (match.results.length !== dataset.teams.length) {
        fail(
          `completed match ${match.matchNumber} has ${match.results.length} results for ${dataset.teams.length} teams`
        );
      }
      const placements = match.results.map((r) => r.placement).sort((a, b) => a - b);
      for (let i = 0; i < placements.length; i += 1) {
        if (placements[i] !== i + 1) fail(`completed match ${match.matchNumber}: placements are not a 1..N permutation`);
      }
    }
  }

  // Source placement hints: binding only when complete.
  const hints = dataset.entries.filter((e) => e.sourcePlacement !== null);
  if (hints.length > 0 && hints.length < dataset.entries.length) {
    warnings.push({
      code: "partial-source-placement",
      message: `${hints.length}/${dataset.entries.length} teams carry a source placement hint; hints are advisory only`,
    });
  }
  if (hints.length === dataset.entries.length && completedMatches.length > 0) {
    const totals = new Map<string, number>();
    for (const entry of dataset.entries) totals.set(entry.teamCanonical, entry.startingPoints);
    for (const match of completedMatches) {
      for (const result of match.results) {
        totals.set(result.teamCanonical, (totals.get(result.teamCanonical) ?? 0) + result.totalPoints);
      }
    }
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const rankByTeam = new Map(ranked.map(([key], index) => [key, index + 1]));
    const mismatches = hints.filter((h) => rankByTeam.get(h.teamCanonical) !== h.sourcePlacement);
    if (mismatches.length > 0) {
      fail(
        `derived ranks disagree with complete source placements: ${mismatches
          .map((m) => `${m.teamCanonical} (source ${m.sourcePlacement}, derived ${rankByTeam.get(m.teamCanonical)})`)
          .join("; ")}`
      );
    }
  }

  const scheduledWithResults = dataset.matches.filter((m) => m.status === "scheduled" && m.results.length > 0);
  if (scheduledWithResults.length > 0) {
    warnings.push({
      code: "scheduled-with-results",
      message: `${scheduledWithResults.length} scheduled match(es) carry results; treating results as authoritative`,
    });
  }

  return { warnings };
}
