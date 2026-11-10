/**
 * BGMI Tournament Hub — ingestion pipeline.
 *
 * One pipeline per catalogued tournament stage:
 *   fetch snapshot → parse → validate (all-or-nothing) → publish → report.
 *
 * Safety properties (mirroring Meta-Parser staging/promotion semantics):
 * - Validation runs ENTIRELY before any write. A failed run writes
 *   nothing: the previous published dataset stays intact.
 * - Per-stage isolation: one malformed stage never destroys sibling
 *   stages (each stage is an independent run with its own ledger row).
 * - Idempotent re-runs: same source revision + same parser version →
 *   `unchanged`, zero writes. Changed source → verified replace.
 * - No partial publication: publish only happens after the full dataset
 *   validates; the public page never shows a half-written stage.
 */

import {
  assertCanonicalScoring,
  fetchTournamentSource,
  getCatalogEntry,
  parseTournamentStage,
  type LiquipediaSourceSnapshot,
  type SupportedStageKey,
} from "../adapters/liquipedia";
import type { BgmiStageDataset } from "../types";
import type { BgmiStore } from "../repositories/store";
import { validateStageDataset } from "./validate";

export interface StageIngestOptions {
  readonly store: BgmiStore;
  readonly tournamentSlug: string;
  readonly stageKey: SupportedStageKey;
  /**
   * Test seam: bypass the network with a pre-fetched snapshot.
   * Production always fetches via the adapter.
   */
  readonly snapshot?: LiquipediaSourceSnapshot;
  readonly runId?: string;
}

export interface StageIngestReport {
  readonly tournamentSlug: string;
  readonly stageSlug: string;
  readonly outcome: "inserted" | "unchanged" | "revised" | "failed";
  readonly teamsCount: number;
  readonly matchesCompleted: number;
  readonly matchesTotal: number;
  readonly sourceRevision: number | null;
  readonly warnings: readonly string[];
  readonly error?: string;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}

/** Ingest a single tournament stage with failure isolation. Never throws. */
export async function ingestTournamentStage(options: StageIngestOptions): Promise<StageIngestReport> {
  const runId = options.runId ?? `bgmi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const base = {
    tournamentSlug: options.tournamentSlug,
    stageSlug: options.stageKey,
    teamsCount: 0,
    matchesCompleted: 0,
    matchesTotal: 0,
    sourceRevision: null as number | null,
    warnings: [] as string[],
  };

  const fail = async (message: string): Promise<StageIngestReport> => {
    try {
      await options.store.recordRun({
        runId,
        tournamentSlug: options.tournamentSlug,
        stageSlug: options.stageKey,
        status: "failed",
        errorSummary: message.slice(0, 500),
      });
    } catch {
      // ledger write failure is non-fatal
    }
    return { ...base, outcome: "failed", error: message.slice(0, 500) };
  };

  const entry = getCatalogEntry(options.tournamentSlug);
  if (!entry) return fail(`Unknown tournament: ${options.tournamentSlug}`);
  if (!entry.stages.includes(options.stageKey)) {
    return fail(`Stage not supported for ${options.tournamentSlug}: ${options.stageKey}`);
  }

  let snapshot: LiquipediaSourceSnapshot;
  try {
    snapshot = options.snapshot ?? (await fetchTournamentSource(entry.sourcePage));
  } catch (error) {
    return fail(`fetch failed: ${errorMessage(error)}`);
  }

  let dataset: BgmiStageDataset;
  try {
    dataset = parseTournamentStage(snapshot, entry, options.stageKey);
    assertCanonicalScoring(dataset);
    const { warnings } = validateStageDataset(dataset);
    base.warnings.push(...warnings.map((w) => `${w.code}: ${w.message}`));
  } catch (error) {
    return fail(`parse/validate failed: ${errorMessage(error)}`);
  }

  let datasetForPublish: BgmiStageDataset = dataset;
  let wasPresent = false;
  try {
    const storedTournament = await options.store.getTournament(entry.slug);
    const storedStage = storedTournament
      ? await options.store.getStage(storedTournament.id, options.stageKey)
      : null;
    if (
      storedTournament &&
      storedStage &&
      storedTournament.sourceRevision !== null &&
      snapshot.revisionId !== null &&
      storedTournament.sourceRevision === snapshot.revisionId &&
      storedStage.sourceRevision === snapshot.revisionId
    ) {
      try {
        await options.store.recordRun({
          runId,
          tournamentSlug: entry.slug,
          stageSlug: options.stageKey,
          status: "succeeded",
          sourceRevision: snapshot.revisionId,
          publishedRevision: storedStage.sourceRevision,
          matchesCompleted: dataset.matches.filter((m) => m.status === "completed").length,
          teamsCount: dataset.teams.length,
        });
      } catch {
        // non-fatal
      }
      return {
        ...base,
        outcome: "unchanged",
        teamsCount: dataset.teams.length,
        matchesCompleted: dataset.matches.filter((m) => m.status === "completed").length,
        matchesTotal: dataset.matches.length,
        sourceRevision: snapshot.revisionId,
      };
    }
    const wasPresentBefore = storedStage !== null;
    wasPresent = wasPresentBefore;
    // Publish only after full validation above — never partial.
    datasetForPublish = dataset;
    await options.store.publishDataset(datasetForPublish);
  } catch (error) {
    return fail(`publish failed: ${errorMessage(error)}`);
  }

  const matchesCompleted = datasetForPublish.matches.filter((m) => m.status === "completed").length;
  try {
    await options.store.recordRun({
      runId,
      tournamentSlug: entry.slug,
      stageSlug: options.stageKey,
      status: "succeeded",
      sourceRevision: snapshot.revisionId,
      publishedRevision: snapshot.revisionId,
      matchesCompleted,
      teamsCount: datasetForPublish.teams.length,
    });
  } catch {
    // non-fatal
  }

  return {
    tournamentSlug: entry.slug,
    stageSlug: options.stageKey,
    outcome: wasPresent ? "revised" : "inserted",
    teamsCount: datasetForPublish.teams.length,
    matchesCompleted,
    matchesTotal: datasetForPublish.matches.length,
    sourceRevision: snapshot.revisionId,
    warnings: base.warnings,
  };
}
