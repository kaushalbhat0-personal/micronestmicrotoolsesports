import { describe, expect, it } from "vitest";
import { getCatalogEntry, parseTournamentStage, type LiquipediaSourceSnapshot } from "./liquipedia";
import { validateStageDataset } from "../services/validate";
import { deriveStandings } from "../services/standings";
import { ingestTournamentStage } from "../services/ingest";
import type { BgmiStageDataset } from "../types";
import type { BgmiStore } from "../repositories/store";

/**
 * Showdown completed Grand Finals regression (BMSD 2026 incident, Oct 2026).
 *
 * Mirrors the completed upstream subpage shape observed 2026-10-18
 * (rev 721716): Match-level `finished=true` + `matchpoint=126` (Smash Rule
 * Day 3), all 18 maps `finished=true` with full `{{MS|p|f}}` cells,
 * canonical p1..p8/p_kill. Team names and per-map results are SYNTHETIC;
 * structure, counts, and template syntax mirror the source.
 *
 * Guards the incident class: a completed source must parse to completed
 * statuses, validate cleanly, and replace a stale ongoing publication —
 * never leave the old dataset active.
 */

const TEAMS = [
  "meta ninza", "8bit", "rntx", "blitz epigrotive gaming", "team apex gaming", "nebula esports",
  "team soul", "k9 esports (indian team)", "blue army", "godlike esports", "team outrage",
  "gladiators esports", "myth official", "welt esports", "genesis esports (indian team)", "wyld fangs",
];

const MAPS = [
  "Rondo", "Erangel", "Erangel", "Erangel", "Miramar", "Miramar",
  "Rondo", "Erangel", "Erangel", "Erangel", "Miramar", "Miramar",
  "Rondo", "Erangel", "Erangel", "Erangel", "Miramar", "Miramar",
];

function buildCompletedWikitext(): string {
  const maps = MAPS.map((name, i) => {
    const n = i + 1;
    return `|map${n}={{Map |date=2026-10-${n <= 6 ? "16" : n <= 12 ? "17" : "18"} - 13:45 {{Abbr/IST}}|finished=true|map=${name}\t|mvp=Player${n}\t\t\t\t\t|vod=https://youtu.be/gf${n}}}`;
  }).join("\n    ");
  const opponents = TEAMS.map((name, teamIdx) => {
    const cells = MAPS.map((_, i) => {
      const n = i + 1;
      const placement = ((teamIdx + n) % 16) + 1;
      const finishes = (teamIdx * 3 + n * 5) % 14;
      return `|m${n}={{MS|${placement}|${finishes}}}`;
    }).join("\t\t");
    return `\t|opponent${teamIdx + 1}={{TeamOpponent|${name}\n\t\t${cells}\n\t\t}}`;
  }).join("\n");
  return `{{DISPLAYTITLE:BMSD 2026 - Grand Finals}}{{HiddenDataBox}}
==Format==
* '''BMSD 2026 - Grand Finals:''' October 16th - 18th, 2026
** 16 teams, 3 match days.
** 18 matches (6 each day).
=={{Stage|Grand Finals}}==
{{Bracket|Bracket/2|id=BMSD2026GF
|R1M1header=Grand Finals
|R1M1={{Match|finished=true\t|matchpoint=126
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1=up,2-6=stayup
    |youtube=KRAFTON INDIA ESPORTS
    ${maps}
${opponents}
}}
}}
`;
}

function snapshotFor(wikitext: string, revisionId: number): LiquipediaSourceSnapshot {
  return {
    pageTitle: "Battlegrounds Mobile India Showdown/2026/Grand Finals",
    wikitext,
    revisionId,
    lastUpdatedAt: "2026-10-18T12:11:34Z",
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Showdown/2026/Grand_Finals",
  };
}

function createFakeStore(): BgmiStore & { published: BgmiStageDataset[] } {
  const published: BgmiStageDataset[] = [];
  const revisions = new Map<string, number | null>();
  return {
    published,
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
    async recordRun() {},
    async completeRun() {},
  };
}

describe("Showdown completed Grand Finals (incident regression)", () => {
  it("parses the completed Smash-Rule source to completed statuses", () => {
    const entry = getCatalogEntry("bgmi-showdown-2026")!;
    const dataset = parseTournamentStage(snapshotFor(buildCompletedWikitext(), 721716), entry, "grand-finals", "2026-10-20");
    expect(dataset.matches).toHaveLength(18);
    expect(dataset.matches.filter((m) => m.status === "completed")).toHaveLength(18);
    expect(dataset.stage.status).toBe("completed");
    expect(dataset.tournament.status).toBe("completed");
    expect(dataset.stage.smashRule).toBe(true);
    expect(dataset.stage.matchPointThreshold).toBe(126);
    expect(validateStageDataset(dataset).warnings).toEqual([]);
    const rows = deriveStandings(dataset.teams, dataset.entries, dataset.matches);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.matchesPlayed === 18)).toBe(true);
  });

  it("replaces a stale ongoing publication when the source revision advances", async () => {
    const store = createFakeStore();
    // First publish an older revision (simulates the Oct-17 ongoing state).
    const partial = buildCompletedWikitext().replaceAll("|finished=true|map=", "|finished=|map=");
    const first = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      snapshot: snapshotFor(partial, 721646),
      runId: "incident-before",
    });
    expect(first.outcome).toBe("inserted");
    // Completed revision arrives: must publish (not suppress) with completed statuses.
    const second = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      snapshot: snapshotFor(buildCompletedWikitext(), 721716),
      runId: "incident-after",
    });
    expect(second.outcome).toBe("revised");
    expect(second.matchesCompleted).toBe(18);
    const latest = store.published[store.published.length - 1]!;
    expect(latest.stage.status).toBe("completed");
    expect(latest.tournament.status).toBe("completed");
    expect(latest.matches.filter((m) => m.status === "completed")).toHaveLength(18);
  });
});
