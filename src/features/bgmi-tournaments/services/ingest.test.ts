import { describe, expect, it } from "vitest";
import { ingestTournamentStage } from "./ingest";
import type { LiquipediaSourceSnapshot } from "../adapters/liquipedia";
import type { BgmiStore } from "../repositories/store";
import type { BgmiStageDataset } from "../types";

const WIKITEXT = `{{Infobox league
|name=BGMI Masters Series<br> Season 5
|organizer=NODWIN Gaming
|sdate=2026-08-10 |edate=2026-09-06
}}
===Grand Finals===
{{Bracket|Bracket/2|id=bgms2026gf
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|map1= {{Map|date=2026-09-04 16:00 {{Abbr/IST}}|finished=true|map=Erangel|vod=}}
    |map2= {{Map|date=2026-09-04 16:40 {{Abbr/IST}}|finished=true|map=Miramar|vod=}}
\t|opponent1={{TeamOpponent|team a\t|startingpoints=5
\t\t|m1={{MS|1|4}}\t\t|m2={{MS|2|2}}
\t\t}}
\t|opponent2={{TeamOpponent|team b\t|startingpoints=0
\t\t|m1={{MS|2|2}}\t\t|m2={{MS|1|4}}
\t\t}}
}}
}}
===Playoffs===
{{Bracket|Bracket/2|id=bgms2026pl
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|map1= {{Map|finished=true|map=Rondo|vod=}}
\t|opponent1={{TeamOpponent|team a\t|startingpoints=0
\t\t|m1={{MS|not-a-number|x}}
\t\t}}
\t|opponent2={{TeamOpponent|team b\t|startingpoints=0
\t\t|m1={{MS|2|2}}
\t\t}}
}}
}}
`;

function snapshot(revisionId: number | null = 720523): LiquipediaSourceSnapshot {
  return {
    pageTitle: "BGMI Masters Series/Season 5",
    wikitext: WIKITEXT,
    revisionId,
    lastUpdatedAt: "2026-10-03T16:50:39Z",
    sourceUrl: "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5",
  };
}

/** Minimal in-memory store: records writes so tests can assert all-or-nothing. */
function createFakeStore(): BgmiStore & {
  published: BgmiStageDataset[];
  runs: Array<{ runId: string; status: string; errorSummary?: string | undefined }>;
} {
  const published: BgmiStageDataset[] = [];
  const runs: Array<{ runId: string; status: string; errorSummary?: string | undefined }> = [];
  const revisions = new Map<string, number | null>();
  return {
    published,
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
      published.push(dataset);
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

describe("ingestTournamentStage", () => {
  it("publishes a valid stage on first run", async () => {
    const store = createFakeStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bmsd-2026",
      stageKey: "grand-finals",
      snapshot: snapshot(),
      runId: "run-1",
    });
    expect(report.outcome).toBe("inserted");
    expect(report.teamsCount).toBe(2);
    expect(report.matchesCompleted).toBe(2);
    expect(report.sourceRevision).toBe(720523);
    expect(store.published).toHaveLength(1);
    expect(store.runs.some((r) => r.runId === "run-1" && r.status === "succeeded")).toBe(true);
  });

  it("is idempotent: same revision re-runs write nothing", async () => {
    const store = createFakeStore();
    await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "grand-finals", snapshot: snapshot(), runId: "run-1" });
    const second = await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "grand-finals", snapshot: snapshot(), runId: "run-2" });
    expect(second.outcome).toBe("unchanged");
    expect(store.published).toHaveLength(1);
  });

  it("revises when the source revision changes", async () => {
    const store = createFakeStore();
    await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "grand-finals", snapshot: snapshot(720523), runId: "run-1" });
    const second = await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "grand-finals", snapshot: snapshot(720524), runId: "run-2" });
    expect(second.outcome).toBe("revised");
    expect(store.published).toHaveLength(2);
  });

  it("writes nothing when parsing fails (all-or-nothing)", async () => {
    const store = createFakeStore();
    const bad: LiquipediaSourceSnapshot = { ...snapshot(), wikitext: "no brackets here" };
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bmsd-2026",
      stageKey: "grand-finals",
      snapshot: bad,
      runId: "run-bad",
    });
    expect(report.outcome).toBe("failed");
    expect(store.published).toHaveLength(0);
    expect(store.runs.some((r) => r.runId === "run-bad" && r.status === "failed")).toBe(true);
  });

  it("isolates stage failures: a broken playoffs run leaves grand-finals intact", async () => {
    const store = createFakeStore();
    const gf = await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "grand-finals", snapshot: snapshot(), runId: "run-gf" });
    const pl = await ingestTournamentStage({ store, tournamentSlug: "bmsd-2026", stageKey: "playoffs", snapshot: snapshot(), runId: "run-pl" });
    expect(gf.outcome).toBe("inserted");
    // The fixture's playoffs bracket carries a malformed MS cell.
    expect(pl.outcome).toBe("failed");
    expect(store.published).toHaveLength(1);
    expect(store.published[0]?.stage.slug).toBe("grand-finals");
  });

  it("rejects unknown tournaments and unsupported stages", async () => {
    const store = createFakeStore();
    const unknown = await ingestTournamentStage({ store, tournamentSlug: "nope-2026", stageKey: "grand-finals", snapshot: snapshot(), runId: "r1" });
    expect(unknown.outcome).toBe("failed");
    expect(store.published).toHaveLength(0);
  });
});
