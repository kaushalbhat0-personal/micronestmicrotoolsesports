import { describe, expect, it } from "vitest";
import {
  extractStageSection,
  getCatalogEntry,
  isEmptyMsCell,
  isSatOutMsCell,
  parseStageDataset,
  parseTournamentStage,
} from "./liquipedia";
import { validateStageDataset } from "../services/validate";
import { ingestTournamentStage } from "../services/ingest";
import { deriveStandings } from "../services/standings";
import type { BgmiStageDataset } from "../types";
import type { BgmiStore } from "../repositories/store";
import type { LiquipediaSourceSnapshot } from "./liquipedia";

/**
 * Showdown-02 — ongoing Showdown Grand Finals fixtures.
 *
 * Mirrors the live `Battlegrounds Mobile India Showdown/2026/Grand Finals`
 * subpage shape (verified 2026-10-17, Day 1 complete): 16 opponents,
 * 18 maps, maps 1–6 `finished=true` with numeric `{{MS|p|f}}`, maps 7–18
 * `finished=` empty with `{{MS||}}` no-data cells, Match-level
 * `finished=`/`matchpoint=` empty, canonical p1..p8/p_kill, no infobox,
 * `=={{Stage|Grand Finals}}==` heading.
 *
 * Team names and per-map results are SYNTHETIC; counts, rotation-free
 * full participation, and template syntax mirror the source.
 */

const SHOWDOWN_TEAMS = [
  "meta ninza",
  "8bit",
  "rntx",
  "blitz epigrotive gaming",
  "team apex gaming",
  "nebula esports",
  "team soul",
  "k9 esports (indian team)",
  "blue army",
  "godlike esports",
  "team outrage",
  "gladiators esports",
  "myth official",
  "welt esports",
  "genesis esports (indian team)",
  "wyld fangs",
];

const SHOWDOWN_MAPS: Array<{ name: string; date: string }> = [
  { name: "Rondo", date: "2026-10-16 - 13:45 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-16 - 14:35 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-16 - 15:17 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-16 - 17:20 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-16 - 17:56 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-16 - 18:40 {{Abbr/IST}}" },
  { name: "Rondo", date: "2026-10-17 - 13:45 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-17 - 14:25 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-17 - 15:10 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-17 - 15:50 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-17 - 16:40 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-17 - 17:20 {{Abbr/IST}}" },
  { name: "Rondo", date: "2026-10-18 - 13:45 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-18 - 14:25 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-18 - 15:10 {{Abbr/IST}}" },
  { name: "Erangel", date: "2026-10-18 - 15:50 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-18 - 16:40 {{Abbr/IST}}" },
  { name: "Miramar", date: "2026-10-18 - 17:20 {{Abbr/IST}}" },
];

function buildShowdownGfWikitext(): string {
  const maps = SHOWDOWN_MAPS.map((m, i) => {
    const n = i + 1;
    const finished = n <= 6;
    return `|map${n}={{Map |date=${m.date}|finished=${finished ? "true" : ""}|map=${m.name}\t|mvp=${finished ? `Player${n}` : ""}\t\t\t\t\t|vod=${finished ? `https://youtu.be/gf${n}` : ""}}}`;
  }).join("\n    ");

  const opponents = SHOWDOWN_TEAMS.map((name, teamIdx) => {
    const cells = SHOWDOWN_MAPS.map((_, i) => {
      const n = i + 1;
      if (n > 6) return `|m${n}={{MS||}}`;
      // Full-participation rotation of winners keeps 1..16 per map.
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
|R1M1={{Match|finished=\t|matchpoint=
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1=up,2-6=stayup
    |youtube=KRAFTON INDIA ESPORTS
    ${maps}
${opponents}
}}
}}
`;
}

function showdownOptions() {
  return {
    tournamentSlug: "bgmi-showdown-2026",
    tournamentName: "Battlegrounds Mobile India Showdown 2026",
    tournamentShortName: "Showdown 2026",
    seasonYear: 2026 as number | null,
    organizer: "KRAFTON" as string | null,
    startsOn: "2026-09-22" as string | null,
    endsOn: "2026-10-18" as string | null,
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Showdown/2026/Grand_Finals",
    sourcePage: "Battlegrounds Mobile India Showdown/2026/Grand Finals",
    sourceRevision: 900001 as number | null,
    sourceLastUpdatedAt: null as string | null,
    stageKey: "grand-finals" as const,
    nowIso: "2026-10-17",
  };
}

function snapshotFor(wikitext: string): LiquipediaSourceSnapshot {
  return {
    pageTitle: "Battlegrounds Mobile India Showdown/2026/Grand Finals",
    wikitext,
    revisionId: 900001,
    lastUpdatedAt: "2026-10-16T14:00:00Z",
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Showdown/2026/Grand_Finals",
  };
}

function createFakeStore(): BgmiStore & {
  published: BgmiStageDataset[];
  runs: Array<{ runId: string; status: string }>;
} {
  const published: BgmiStageDataset[] = [];
  const runs: Array<{ runId: string; status: string }> = [];
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
      runs.push({ runId: input.runId, status: input.status });
    },
    async completeRun() {},
  };
}

describe("Showdown empty-cell handling (Showdown-02)", () => {
  it("treats {{MS||}} and whitespace-only cells as no-data (not sat-out, not result)", () => {
    expect(isEmptyMsCell("{{MS||}}")).toBe(true);
    expect(isEmptyMsCell("{{MS|}}")).toBe(true);
    expect(isEmptyMsCell("{{MS|  |  }}")).toBe(true);
    expect(isEmptyMsCell("{{MS||}}  ")).toBe(true);
  });

  it("does not treat sat-outs, results, or malformed cells as empty", () => {
    expect(isEmptyMsCell("{{MS|-}}")).toBe(false);
    expect(isEmptyMsCell("{{MS|-|}}")).toBe(false);
    expect(isEmptyMsCell("{{MS|1|4}}")).toBe(false);
    expect(isEmptyMsCell("{{MS}}")).toBe(false);
    expect(isEmptyMsCell("{{MS|5|-}}")).toBe(false);
    expect(isEmptyMsCell("{{MS|-|5}}")).toBe(false);
    expect(isEmptyMsCell("{{MS|foo=bar}}")).toBe(false);
    expect(isEmptyMsCell("{{MS||foo=bar}}")).toBe(false);
    expect(isEmptyMsCell("")).toBe(false);
    // And the sat-out helper still rejects empties (disjoint meanings).
    expect(isSatOutMsCell("{{MS||}}")).toBe(false);
  });

  it("still fails closed on malformed populated cells", () => {
    for (const bad of ["{{MS|not-a-number|x}}", "{{MS|5|-}}", "{{MS|-|5}}", "{{MS}}", "{{MS|foo|bar}}"]) {
      const wikitext = buildShowdownGfWikitext().replace("{{MS||}}", bad);
      // The first upcoming cell becomes malformed → parse must throw,
      // never silently publish a gap.
      expect(() => parseStageDataset(wikitext, showdownOptions())).toThrow(/Unparseable MS cell/);
    }
  });
});

describe("Showdown alternate Stage heading (Showdown-02)", () => {
  it("locates =={{Stage|Grand Finals}}== subpage sections", () => {
    const section = extractStageSection(buildShowdownGfWikitext(), "Grand Finals");
    expect(section).not.toBeNull();
    expect(section).toContain("BMSD2026GF");
  });

  it("keeps resolving plain ===Grand Finals=== sections first", () => {
    const plain = "==Results==\n===Grand Finals===\n{{Bracket|id=plain}}\n===Playoffs===\n{{Bracket|id=other}}";
    expect(extractStageSection(plain, "Grand Finals")).toContain("id=plain");
    expect(extractStageSection(plain, "Semi Finals")).toBeNull();
  });

  it("does not confuse template-titled non-stage sections", () => {
    const other = "=={{Stage|Playoffs}}==\n{{Bracket|id=po}}";
    expect(extractStageSection(other, "Grand Finals")).toBeNull();
    expect(extractStageSection(other, "Playoffs")).toContain("id=po");
  });
});

describe("Showdown partial Grand Finals stage (Showdown-02)", () => {
  it("parses 6 completed maps and 12 pending maps with no pending result rows", () => {
    const dataset = parseStageDataset(buildShowdownGfWikitext(), showdownOptions());
    expect(dataset.teams).toHaveLength(16);
    expect(dataset.matches).toHaveLength(18);
    const completed = dataset.matches.filter((m) => m.status === "completed");
    const scheduled = dataset.matches.filter((m) => m.status === "scheduled");
    expect(completed).toHaveLength(6);
    expect(scheduled).toHaveLength(12);
    for (const match of completed) {
      expect(match.results).toHaveLength(16);
      expect([...match.results.map((r) => r.placement)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 16 }, (_, i) => i + 1)
      );
    }
    expect(scheduled.flatMap((m) => m.results)).toHaveLength(0);
    // Showdown dialect dates (spaced hyphen) must populate scheduledAt.
    const byNumber = new Map(dataset.matches.map((m) => [m.matchNumber, m]));
    expect(byNumber.get(1)?.scheduledAt).toBe("2026-10-16T08:15:00.000Z");
    expect(byNumber.get(2)?.scheduledAt).toBe("2026-10-16T09:05:00.000Z");
    expect(byNumber.get(7)?.scheduledAt).toBe("2026-10-17T08:15:00.000Z");
    expect(byNumber.get(13)?.scheduledAt).toBe("2026-10-18T08:15:00.000Z");
    for (const match of completed) {
      expect(match.scheduledAt).not.toBeNull();
    }
    expect(dataset.matches.every((m) => m.scheduledAt !== null)).toBe(true);
    expect(dataset.stage.status).toBe("ongoing");
    expect(dataset.tournament.status).toBe("ongoing");
    expect(dataset.stage.smashRule).toBe(false);
    expect(dataset.stage.matchPointThreshold).toBeNull();
    expect(dataset.scoring).toEqual({ placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 });
    expect(validateStageDataset(dataset).warnings).toEqual([]);
    const rows = deriveStandings(dataset.teams, dataset.entries, dataset.matches);
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => r.matchesPlayed === 6)).toBe(true);
  });

  it("carries catalog metadata for infobox-less subpage sources", () => {
    const entry = getCatalogEntry("bgmi-showdown-2026");
    if (!entry) throw new Error("showdown catalog entry missing");
    const dataset = parseTournamentStage(snapshotFor(buildShowdownGfWikitext()), entry, "grand-finals", "2026-10-17");
    expect(dataset.tournament.name).toBe("Battlegrounds Mobile India Showdown 2026");
    expect(dataset.tournament.organizer).toBe("KRAFTON");
    expect(dataset.tournament.startsOn).toBe("2026-09-22");
    expect(dataset.tournament.endsOn).toBe("2026-10-18");
    expect(dataset.tournament.status).toBe("ongoing");
  });

  it("rejects a finished map left with a data gap (no silent partial publication)", () => {
    // A completed map missing one team's result must fail validation so
    // the previous publication stays intact — this is also how a source
    // row deletion surfaces instead of corrupting history.
    const dataset = parseStageDataset(buildShowdownGfWikitext(), showdownOptions());
    const match = dataset.matches[0];
    if (!match) throw new Error("fixture has no matches");
    const victim = match.results.find((r) => r.placement === 8);
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== match.matchNumber ? m : { ...m, results: m.results.filter((r) => r !== victim) }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/has 15 results for 16 teams/);
  });

  it("publishes the partial stage and stays idempotent", async () => {
    const store = createFakeStore();
    const snapshot = snapshotFor(buildShowdownGfWikitext());
    const first = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      snapshot,
      runId: "showdown-1",
    });
    expect(first.outcome).toBe("inserted");
    expect(first.teamsCount).toBe(16);
    expect(first.matchesCompleted).toBe(6);
    expect(first.matchesTotal).toBe(18);
    const second = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      snapshot,
      runId: "showdown-2",
    });
    expect(second.outcome).toBe("unchanged");
    expect(store.published).toHaveLength(1);
  });

  it("fails a gapped finished map through ingestion with nothing published", async () => {
    const store = createFakeStore();
    // Mark map 7 finished while its cells are still empty: the completed
    // map has zero results and must fail before any write.
    const wikitext = buildShowdownGfWikitext().replace(
      "|map7={{Map |date=2026-10-17 - 13:45 {{Abbr/IST}}|finished=|map=Rondo",
      "|map7={{Map |date=2026-10-17 - 13:45 {{Abbr/IST}}|finished=true|map=Rondo"
    );
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "grand-finals",
      snapshot: snapshotFor(wikitext),
      runId: "showdown-gap",
    });
    expect(report.outcome).toBe("failed");
    expect(report.error).toContain("has no results");
    expect(store.published).toHaveLength(0);
  });
});

describe("Showdown catalog boundaries (Showdown-02)", () => {
  it("registers bgmi-showdown-2026 without colliding with bmsd-2026", () => {
    const showdown = getCatalogEntry("bgmi-showdown-2026");
    expect(showdown?.sourcePage).toBe("Battlegrounds Mobile India Showdown/2026/Grand Finals");
    expect(showdown?.stages).toEqual(["grand-finals"]);
    expect(showdown?.name).toBe("Battlegrounds Mobile India Showdown 2026");
    const masters = getCatalogEntry("bmsd-2026");
    expect(masters?.sourcePage).toBe("BGMI Masters Series/Season 5");
    expect(masters?.slug).not.toBe(showdown?.slug);
  });

  it("rejects unsupported Showdown stages at the catalog gate", async () => {
    const store = createFakeStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bgmi-showdown-2026",
      stageKey: "playoffs",
      snapshot: snapshotFor(buildShowdownGfWikitext()),
      runId: "showdown-gate",
    });
    expect(report.outcome).toBe("failed");
    expect(report.error).toContain("Stage not supported");
    expect(store.published).toHaveLength(0);
  });
});
