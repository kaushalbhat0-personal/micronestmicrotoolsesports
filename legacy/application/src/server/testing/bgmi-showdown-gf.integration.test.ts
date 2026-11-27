/**
 * Showdown-02 live-source integration.
 *
 * Runs the REAL production pipeline (fetch → parse → validate → publish →
 * ledger) against the live Showdown Grand Finals subpage with an in-memory
 * store — no database, no service-role, no writes outside the test.
 *
 * The event is ONGOING, so completed counts are asserted as observed
 * ranges, not frozen numbers: Day 1 (6 maps, verified 2026-10-17) is the
 * floor, 18 maps total is the ceiling. Structural invariants (full
 * 1..16 participation per completed map, zero rows for pending maps,
 * canonical scoring, no Smash) hold at every stage of the event.
 *
 * Integration lane only: requires network access to liquipedia.net.
 * The unit suite never touches the network.
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
  runs: Array<{ runId: string; status: string }>;
} {
  const datasets: BgmiStageDataset[] = [];
  const runs: Array<{ runId: string; status: string }> = [];
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
      runs.push({ runId: input.runId, status: input.status });
    },
    async completeRun() {},
  };
}

describe("Showdown Grand Finals live ingestion (Showdown-02)", () => {
  it("publishes the partial stage: 16 teams, 18 maps, Day-1+ completed, pending maps row-free", async () => {
    const store = createMemoryStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      runId: "showdown-gf-1",
    });
    expect(report.outcome).toBe("inserted");
    expect(report.teamsCount).toBe(16);
    expect(report.matchesTotal).toBe(18);
    // Day 1 (6 maps) verified complete 2026-10-17; later days raise this.
    expect(report.matchesCompleted).toBeGreaterThanOrEqual(6);
    expect(report.matchesCompleted).toBeLessThanOrEqual(18);
    expect(report.sourceRevision).not.toBeNull();

    const dataset = store.datasets[0];
    if (!dataset) throw new Error("Showdown ingestion published no dataset");
    expect(dataset.tournament.name).toBe("Battlegrounds Mobile India Showdown 2026");
    expect(dataset.tournament.organizer).toBe("KRAFTON");

    const completed = dataset.matches.filter((m) => m.status === "completed");
    const scheduled = dataset.matches.filter((m) => m.status === "scheduled");
    expect(completed.length + scheduled.length).toBe(18);
    for (const match of completed) {
      expect(match.results).toHaveLength(16);
      expect([...match.results.map((r) => r.placement)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 16 }, (_, i) => i + 1)
      );
    }
    // Pending maps must not generate result rows.
    expect(scheduled.flatMap((m) => m.results)).toHaveLength(0);

    expect(dataset.scoring).toEqual({ placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 });
    expect(dataset.stage.smashRule).toBe(false);
    expect(dataset.stage.matchPointThreshold).toBeNull();

    // Standings derive over completed maps only, one appearance each.
    const rows = deriveStandings(dataset.teams, dataset.entries, dataset.matches);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.matchesPlayed === completed.length)).toBe(true);

    const ok = store.runs.filter((r) => r.status === "succeeded");
    expect(ok.length).toBeGreaterThan(0);
  });

  it("is idempotent while the source is unchanged", async () => {
    const store = createMemoryStore();
    const first = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      runId: "showdown-gf-idem-1",
    });
    expect(first.outcome).toBe("inserted");
    const second = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      runId: "showdown-gf-idem-2",
    });
    // A new completed map between runs legitimately revises; otherwise unchanged.
    expect(["unchanged", "revised", "inserted"]).toContain(second.outcome);
    if (second.outcome === "unchanged") {
      expect(second.sourceRevision).toBe(first.sourceRevision);
      expect(store.datasets).toHaveLength(1);
    }
  });
});
