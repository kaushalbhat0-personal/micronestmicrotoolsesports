/**
 * BMPS Phase 1 live-source integration (BMPS-02).
 *
 * Runs the REAL production pipeline (fetch → parse → validate → publish →
 * ledger) against the live Liquipedia BMPS 2026 page with an in-memory
 * store — no database, no service-role, no writes outside the test.
 *
 * Expectations come from the BMPS-01 audit (§6):
 *   Grand Finals: 16 teams, 18 completed matches, 288 results, no Smash
 *   Last Chance:  16 teams, 12 completed matches, 192 results, no Smash
 *
 * Integration lane only (`npm run test:all`): requires network access to
 * liquipedia.net. The unit suite never touches the network.
 */
import { describe, expect, it } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

import { vi } from "vitest";
import { ingestTournamentStage } from "@/features/bgmi-tournaments/services/ingest";
import type { BgmiStore } from "@/features/bgmi-tournaments/repositories/store";
import type { BgmiStageDataset } from "@/features/bgmi-tournaments/types";
import type { SupportedStageKey } from "@/features/bgmi-tournaments/adapters/liquipedia";

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

async function ingestLive(store: BgmiStore, stage: SupportedStageKey, runId: string) {
  return ingestTournamentStage({ store, tournamentSlug: "bmps-2026", stageKey: stage, runId });
}

describe("BMPS Phase 1 live ingestion (BMPS-02)", () => {
  it("publishes Grand Finals: 16 teams, 18 matches, 288 results, no Smash", async () => {
    const store = createMemoryStore();
    const report = await ingestLive(store, "grand-finals", "bmps-gf-1");
    expect(report.outcome).toBe("inserted");
    expect(report.teamsCount).toBe(16);
    expect(report.matchesCompleted).toBe(18);
    expect(report.matchesTotal).toBe(18);
    expect(report.sourceRevision).not.toBeNull();
    const dataset = store.datasets[0];
    const resultCount = dataset?.matches.flatMap((m) => m.results).length ?? 0;
    expect(resultCount).toBe(288);
    expect(dataset?.stage.smashRule).toBe(false);
    expect(dataset?.stage.matchPointThreshold).toBeNull();
    const ok = store.runs.filter((r) => r.status === "succeeded");
    expect(ok.length).toBeGreaterThan(0);
  });

  it("publishes Last Chance: 16 teams, 12 matches, 192 results, no Smash", async () => {
    const store = createMemoryStore();
    const report = await ingestLive(store, "last-chance", "bmps-lc-1");
    expect(report.outcome).toBe("inserted");
    expect(report.teamsCount).toBe(16);
    expect(report.matchesCompleted).toBe(12);
    expect(report.matchesTotal).toBe(12);
    const dataset = store.datasets[0];
    const resultCount = dataset?.matches.flatMap((m) => m.results).length ?? 0;
    expect(resultCount).toBe(192);
    expect(dataset?.stage.smashRule).toBe(false);
  });

  it("is idempotent: a second run writes nothing and reports unchanged", async () => {
    const store = createMemoryStore();
    const first = await ingestLive(store, "grand-finals", "bmps-gf-idem-1");
    expect(first.outcome).toBe("inserted");
    const second = await ingestLive(store, "grand-finals", "bmps-gf-idem-2");
    expect(second.outcome).toBe("unchanged");
    expect(second.sourceRevision).toBe(first.sourceRevision);
    expect(store.datasets).toHaveLength(1);
  });
});
