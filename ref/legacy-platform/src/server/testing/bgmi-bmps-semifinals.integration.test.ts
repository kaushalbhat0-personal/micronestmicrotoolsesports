/**
 * BMPS Phase 2 live-source integration (BMPS-03).
 *
 * Runs the REAL production pipeline (fetch → parse → validate → publish →
 * ledger) against the live Liquipedia BMPS 2026 page with an in-memory
 * store — no database, no service-role, no writes outside the test.
 *
 * Expectations come from the live source verified 2026-10-17
 * (`Battlegrounds Mobile India Pro Series/2026`, `===Semi Finals===`):
 *   Semi Finals: 24 teams, 24 completed matches, 16 results per match
 *   (384 results), 16 maps per team, canonical Points10 scoring, no Smash.
 *
 * Integration lane only (`npm run test:all` / `test:integration`):
 * requires network access to liquipedia.net. The unit suite never
 * touches the network. If the live source contradicts these expectations,
 * the failure IS the signal — do not adapt silently; report the drift.
 */
import { describe, expect, it } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

import { vi } from "vitest";
import { ingestTournamentStage } from "@/features/bgmi-tournaments/services/ingest";
import { deriveStandings } from "@/features/bgmi-tournaments/services/standings";
import type { BgmiStore } from "@/features/bgmi-tournaments/repositories/store";
import type { BgmiStageDataset } from "@/features/bgmi-tournaments/types";

function createMemoryStore(): BgmiStore & {
  datasets: BgmiStageDataset[];
  runs: Array<{ runId: string; status: string; errorSummary?: string | undefined }>;
} {
  const datasets: BgmiStageDataset[] = [];
  const runs: Array<{ runId: string; status: string; errorSummary?: string | undefined }> = [];
  const revisions = new Map<string, number | null>();
  return {
    datasets,
    runs,
    async getTournament(slug: string) {
      const rev = revisions.get(`t:${slug}`);
      if (rev === undefined) return null;
      return { id: `t:${slug}`, slug, sourceRevision: rev };
    },
    async getStage(tournamentId: string, stageSlug: string) {
      const rev = revisions.get(`s:${tournamentId}:${stageSlug}`);
      if (rev === undefined) return null;
      return { id: `s:${tournamentId}:${stageSlug}`, sourceRevision: rev };
    },
    async publishDataset(dataset: BgmiStageDataset) {
      datasets.push(dataset);
      revisions.set(`t:${dataset.tournament.slug}`, dataset.tournament.sourceRevision);
      revisions.set(`s:t:${dataset.tournament.slug}:${dataset.stage.slug}`, dataset.stage.sourceRevision);
      return { tournamentId: `t:${dataset.tournament.slug}`, stageId: "s" };
    },
    async recordRun(input) {
      runs.push({ runId: input.runId, status: input.status, errorSummary: input.errorSummary });
    },
    async completeRun() {},
  };
}

describe("BMPS Phase 2 live ingestion (BMPS-03)", () => {
  it("publishes Semi Finals: 24 teams, 24 matches, 384 results, 16 maps/team, no Smash", async () => {
    const store = createMemoryStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      runId: "bmps-sf-1",
    });
    expect(report.outcome).toBe("inserted");
    expect(report.teamsCount).toBe(24);
    expect(report.matchesCompleted).toBe(24);
    expect(report.matchesTotal).toBe(24);
    expect(report.sourceRevision).not.toBeNull();

    const dataset = store.datasets[0];
    if (!dataset) throw new Error("Semi Finals ingestion published no dataset");

    // 16 participants per completed match, placements exactly 1..16.
    for (const match of dataset.matches) {
      expect(match.status).toBe("completed");
      expect(match.results).toHaveLength(16);
      expect([...match.results.map((r) => r.placement)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 16 }, (_, i) => i + 1)
      );
    }
    const resultCount = dataset.matches.flatMap((m) => m.results).length;
    expect(resultCount).toBe(384);

    // Canonical scoring, no Smash Rule on Semi Finals.
    expect(dataset.scoring).toEqual({ placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 });
    expect(dataset.stage.smashRule).toBe(false);
    expect(dataset.stage.matchPointThreshold).toBeNull();

    // Equal participation: every team played exactly 16 maps.
    const appearances = new Map<string, number>();
    for (const match of dataset.matches) {
      for (const result of match.results) {
        appearances.set(result.teamCanonical, (appearances.get(result.teamCanonical) ?? 0) + 1);
      }
    }
    expect(appearances.size).toBe(24);
    expect(new Set(appearances.values())).toEqual(new Set([16]));

    // Standings reconstruct over the full rotation with no duplicates.
    const rows = deriveStandings(dataset.teams, dataset.entries, dataset.matches);
    expect(rows).toHaveLength(24);
    expect(rows.every((r) => r.matchesPlayed === 16)).toBe(true);
    const keys = rows.map((r) => r.teamCanonical);
    expect(new Set(keys).size).toBe(24);

    const ok = store.runs.filter((r) => r.status === "succeeded");
    expect(ok.length).toBeGreaterThan(0);
  });

  it("is idempotent: a second run writes nothing and reports unchanged", async () => {
    const store = createMemoryStore();
    const first = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      runId: "bmps-sf-idem-1",
    });
    expect(first.outcome).toBe("inserted");
    const second = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      runId: "bmps-sf-idem-2",
    });
    expect(second.outcome).toBe("unchanged");
    expect(second.sourceRevision).toBe(first.sourceRevision);
    expect(store.datasets).toHaveLength(1);
  });
});
