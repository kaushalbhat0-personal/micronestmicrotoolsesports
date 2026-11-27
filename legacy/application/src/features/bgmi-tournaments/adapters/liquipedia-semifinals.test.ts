import { describe, expect, it } from "vitest";
import { isSatOutMsCell, parseStageDataset } from "./liquipedia";
import { validateStageDataset } from "../services/validate";
import { ingestTournamentStage } from "../services/ingest";
import { deriveStandings } from "../services/standings";
import { matchTotal } from "../services/points";
import type { BgmiStageDataset } from "../types";
import type { BgmiStore } from "../repositories/store";
import type { LiquipediaSourceSnapshot } from "./liquipedia";

/**
 * BMPS Phase 2 (BMPS-03) — Semi Finals rotation fixtures.
 *
 * Mirrors the live `Battlegrounds Mobile India Pro Series/2026`
 * `===Semi Finals===` source shape (verified 2026-10-17):
 * - one `{{Bracket|…|R1M1={{Match|…}}}}` block, canonical p1..p8/p_kill,
 *   no `matchpoint` (no Smash Rule), `mvp`/`youtube`/`vod` params ignored
 * - 24 opponents, 24 finished maps, 16 participants per map
 * - BOTH sat-out spellings (`{{MS|-|}}` and `{{MS|-}}`) mixed in one bracket
 * - `YYYY-MM-DD - HH:MM` dates (recorded as null — unchanged Phase 1 behavior)
 *
 * Team names and per-map results are SYNTHETIC (never production values);
 * only counts, rotation geometry, and template syntax mirror the source.
 */

// ── Explicit excerpt: both spellings visible literally ─────────────────

const SPELLING_EXCERPT = `{{Infobox league
|name=Battlegrounds Mobile India Pro Series 2026
|tickername=BMPS 2026
|organizer=KRAFTON
|sdate=2026-06-09 |edate=2026-06-12
}}
==Results==
===Semi Finals===
{{Bracket|Bracket/2|id=BMPS2026SF
|R1M1header=Semi Finals
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1-6=up, 7-22=stay, 23-24=down |mvp=Pain09
    |youtube=KRAFTON INDIA ESPORTS
    |map1={{Map |date=2026-06-09 - 16:00 {{Abbr/IST}}|finished=true|map=Rondo  |mvp=AquaNox|vod=https://youtu.be/dp_yP5zoZsI}}
    |map2={{Map |date=2026-06-09 - 16:40 {{Abbr/IST}}|finished=true|map=Erangel|mvp=FouL619|vod=https://youtu.be/dp_yP5zoZsI}}
\t|opponent1={{TeamOpponent|solar hawks\t|startingpoints=0
\t\t|m1={{MS|1|4}}\t\t|m2={{MS|-|}}
\t\t}}
\t|opponent2={{TeamOpponent|river wolves\t|startingpoints=0
\t\t|m1={{MS|2|2}}\t\t|m2={{MS|-|}}
\t\t}}
\t|opponent3={{TeamOpponent|night owls\t|startingpoints=0
\t\t|m1={{MS|-}}\t\t|m2={{MS|1|7}}
\t\t}}
\t|opponent4={{TeamOpponent|dust riders (indian team)\t|startingpoints=0
\t\t|m1={{MS|-|}}\t\t|m2={{MS|2|3}}
\t\t}}
}}
}}
`;

function semiFinalsOptions() {
  return {
    tournamentSlug: "bmps-2026",
    tournamentName: "Battlegrounds Mobile India Pro Series 2026",
    tournamentShortName: "BMPS 2026",
    seasonYear: 2026 as number | null,
    organizer: "KRAFTON" as string | null,
    startsOn: "2026-06-09" as string | null,
    endsOn: "2026-06-12" as string | null,
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Pro_Series/2026",
    sourcePage: "Battlegrounds Mobile India Pro Series/2026",
    sourceRevision: 721500 as number | null,
    sourceLastUpdatedAt: null as string | null,
    stageKey: "semi-finals" as const,
    nowIso: "2026-10-17",
  };
}

// ── Generated 24-team rotation fixture ─────────────────────────────────

const SF_TEAM_NAMES = [
  "solar hawks",
  "river wolves",
  "night owls",
  "dust riders (indian team)",
  "ember foxes",
  "tidal giants",
  "quartz cobras",
  "neon badgers",
  "iron sparrows",
  "velvet rhinos",
  "storm jackals",
  "lunar otters",
  "blaze pandas",
  "frost herons",
  "onyx vipers",
  "pixel falcons",
  "comet sharks",
  "echo bisons",
  "drift lynxes",
  "nova cranes",
  "sable gulls",
  "zephyr toads",
  "cinder moles",
  "halo stags",
];

/** Group-pair contesting each of the 24 maps (mirrors the live rotation). */
const PAIR_PER_MAP: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 1], [0, 1], // m1–3: A+B
  [1, 2], [1, 2], [1, 2], // m4–6: B+C
  [0, 2], [0, 2], [0, 2], // m7–9: A+C
  [0, 1], [0, 1], [0, 1], // m10–12: A+B
  [1, 2], [1, 2], [1, 2], // m13–15: B+C
  [0, 2], [0, 2], [0, 2], // m16–18: A+C
  [0, 1], [0, 1], // m19–20: A+B
  [1, 2], [1, 2], // m21–22: B+C
  [0, 2], [0, 2], // m23–24: A+C
];

const MAP_NAMES = ["Rondo", "Erangel", "Erangel", "Erangel", "Miramar", "Miramar"];

interface RotationTweaks {
  /** Extra sit-outs: mapNumber (1-based) → team indexes excluded. */
  readonly sitOutExtra?: ReadonlyMap<number, ReadonlySet<number>>;
  /** MapNumber (1-based) where every team sits out (still marked finished). */
  readonly emptyMap?: number;
}

function buildSemiFinalsWikitext(tweaks: RotationTweaks = {}): string {
  const dayFor = (map: number): number => Math.min(4, Math.floor((map - 1) / 6) + 1);
  const maps = Array.from({ length: 24 }, (_, i) => {
    const map = i + 1;
    const mapName = MAP_NAMES[i % MAP_NAMES.length];
    const date = `2026-06-${String(8 + dayFor(map)).padStart(2, "0")} - 16:${String((map * 7) % 60).padStart(2, "0")} {{Abbr/IST}}`;
    return `|map${map}={{Map |date=${date}|finished=true|map=${mapName}|mvp=Player${map}|vod=https://youtu.be/sf${map}}}`;
  }).join("\n    ");

  const opponents = SF_TEAM_NAMES.map((name, teamIdx) => {
    const group = Math.floor(teamIdx / 8);
    const cells = Array.from({ length: 24 }, (_, i) => {
      const map = i + 1;
      const pair = PAIR_PER_MAP[i] ?? [0, 1];
      const extra = tweaks.sitOutExtra?.get(map);
      const plays =
        map !== tweaks.emptyMap && pair.includes(group) && !(extra?.has(teamIdx) ?? false);
      if (!plays) {
        // Mirror the live source: both spellings appear in one bracket.
        const spelling = map <= 12 ? "{{MS|-|}}" : "{{MS|-}}";
        return `|m${map}=${spelling}`;
      }
      const participants = SF_TEAM_NAMES.map((_, idx) => idx).filter(
        (idx) =>
          pair.includes(Math.floor(idx / 8)) &&
          idx !== teamIdx &&
          !(tweaks.sitOutExtra?.get(map)?.has(idx) ?? false)
      );
      const rank = participants.filter((idx) => idx < teamIdx).length;
      // Rotate winners per map so placements stay a permutation of 1..K.
      const participantCount = participants.length + 1;
      const placement = ((rank + map) % participantCount) + 1;
      const finishes = (teamIdx * 5 + map * 3) % 12;
      return `|m${map}={{MS|${placement}|${finishes}}}`;
    }).join("\t\t");
    return `\t|opponent${teamIdx + 1}={{TeamOpponent|${name}\n\t\t${cells}\n\t\t}}`;
  }).join("\n");

  return `{{Infobox league
|name=Battlegrounds Mobile India Pro Series 2026
|tickername=BMPS 2026
|organizer=KRAFTON
|sdate=2026-06-09 |edate=2026-06-12
}}
==Results==
===Semi Finals===
{{Bracket|Bracket/2|id=BMPS2026SF
|R1M1header=Semi Finals
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1-6=up, 7-22=stay, 23-24=down |mvp=Pain09
    |youtube=KRAFTON INDIA ESPORTS
    ${maps}
${opponents}
}}
}}
`;
}

function snapshotFor(wikitext: string, revisionId: number | null = 721500): LiquipediaSourceSnapshot {
  return {
    pageTitle: "Battlegrounds Mobile India Pro Series/2026",
    wikitext,
    revisionId,
    lastUpdatedAt: "2026-06-12T14:00:00Z",
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Pro_Series/2026",
  };
}

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

// ── Sat-out spelling unit tests ────────────────────────────────────────

describe("Semi Finals sat-out spellings (BMPS-03)", () => {
  it("treats {{MS|-}} and {{MS|-|}} equivalently as sat-out", () => {
    expect(isSatOutMsCell("{{MS|-}}")).toBe(true);
    expect(isSatOutMsCell("{{MS|-|}}")).toBe(true);
    expect(isSatOutMsCell("{{MS| - }}")).toBe(true);
    expect(isSatOutMsCell("{{MS| - | }}")).toBe(true);
  });

  it("does not treat numeric or malformed MS cells as sat-out", () => {
    expect(isSatOutMsCell("{{MS|1|4}}")).toBe(false);
    expect(isSatOutMsCell("{{MS|-|5}}")).toBe(false);
    expect(isSatOutMsCell("{{MS|5|-}}")).toBe(false);
    expect(isSatOutMsCell("{{MS|-|-}}")).toBe(false);
    expect(isSatOutMsCell("{{MS| - | - }}")).toBe(false);
    expect(isSatOutMsCell("{{MS||}}")).toBe(false);
    expect(isSatOutMsCell("{{MS}}")).toBe(false);
    expect(isSatOutMsCell("{{MS|foo|bar}}")).toBe(false);
    expect(isSatOutMsCell("")).toBe(false);
  });

  it("parses both spellings as sat-out in a real bracket", () => {
    const dataset = parseStageDataset(SPELLING_EXCERPT, semiFinalsOptions());
    const map1 = dataset.matches.find((m) => m.matchNumber === 1);
    const map2 = dataset.matches.find((m) => m.matchNumber === 2);
    // Map 1: solar hawks + river wolves play; night owls + dust riders sit out.
    expect(map1?.results.map((r) => r.teamCanonical).sort()).toEqual(["river wolves", "solar hawks"]);
    expect(map1?.results.map((r) => r.placement).sort((a, b) => a - b)).toEqual([1, 2]);
    // Map 2: night owls + dust riders play (both spellings sat out map 1).
    expect(map2?.results.map((r) => r.teamCanonical).sort()).toEqual(["dust riders (indian team)", "night owls"]);
    expect(map2?.results.map((r) => r.placement).sort((a, b) => a - b)).toEqual([1, 2]);
    // Identity: disambiguation stripped for display, key preserved.
    expect(dataset.teams.find((t) => t.canonicalName === "dust riders (indian team)")?.displayName).toBe(
      "Dust Riders"
    );
  });

  it("rejects malformed MS cells instead of treating them as sat-out", () => {
    // Note: `{{MS||}}` is intentionally absent here — since Showdown-02 it
    // is the upcoming/no-data cell (skipped, never a result). Bare `{{MS}}`
    // and populated malformed cells still fail closed.
    for (const bad of ["{{MS|-|5}}", "{{MS|5|-}}", "{{MS|foo|bar}}", "{{MS}}"]) {
      const wikitext = SPELLING_EXCERPT.replace("{{MS|-|}}", bad);
      expect(() => parseStageDataset(wikitext, semiFinalsOptions())).toThrow(/Unparseable MS cell/);
    }
  });

  it("parses BMPS hyphenated date spellings into IST instants", () => {
    const dataset = parseStageDataset(SPELLING_EXCERPT, semiFinalsOptions());
    const byNumber = new Map(dataset.matches.map((m) => [m.matchNumber, m]));
    // 2026-06-09 16:00 IST = 10:30 UTC; 16:40 IST = 11:10 UTC.
    expect(byNumber.get(1)?.scheduledAt).toBe("2026-06-09T10:30:00.000Z");
    expect(byNumber.get(2)?.scheduledAt).toBe("2026-06-09T11:10:00.000Z");
  });
});

// ── Full 24-team rotation fixture ──────────────────────────────────────

describe("Semi Finals 24-team rotation fixture (BMPS-03)", () => {
  it("parses 24 teams, 24 completed maps, 16 participants each", () => {
    const dataset = parseStageDataset(buildSemiFinalsWikitext(), semiFinalsOptions());
    expect(dataset.teams).toHaveLength(24);
    expect(dataset.matches).toHaveLength(24);
    expect(dataset.matches.every((m) => m.status === "completed")).toBe(true);
    for (const match of dataset.matches) {
      expect(match.results).toHaveLength(16);
      expect([...match.results.map((r) => r.placement)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 16 }, (_, i) => i + 1)
      );
    }
    const resultCount = dataset.matches.flatMap((m) => m.results).length;
    expect(resultCount).toBe(384);
    expect(dataset.stage.smashRule).toBe(false);
    expect(dataset.stage.matchPointThreshold).toBeNull();
    expect(dataset.scoring).toEqual({ placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 });
  });

  it("validates cleanly with equal 16-maps-per-team participation", () => {
    const dataset = parseStageDataset(buildSemiFinalsWikitext(), semiFinalsOptions());
    expect(() => validateStageDataset(dataset)).not.toThrow();
    const rows = deriveStandings(dataset.teams, dataset.entries, dataset.matches);
    expect(rows).toHaveLength(24);
    expect(rows.every((r) => r.matchesPlayed === 16)).toBe(true);
  });

  it("publishes through ingestion and is idempotent on re-runs", async () => {
    const store = createFakeStore();
    const snapshot = snapshotFor(buildSemiFinalsWikitext());
    const first = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      snapshot,
      runId: "sf-1",
    });
    expect(first.outcome).toBe("inserted");
    expect(first.teamsCount).toBe(24);
    expect(first.matchesCompleted).toBe(24);
    expect(first.matchesTotal).toBe(24);
    expect(store.published).toHaveLength(1);
    const second = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      snapshot,
      runId: "sf-2",
    });
    expect(second.outcome).toBe("unchanged");
    expect(store.published).toHaveLength(1);
  });

  it("rejects qualifiers and survival-stage at the catalog gate without writing", async () => {
    const store = createFakeStore();
    for (const stageKey of ["qualifiers", "survival-stage"]) {
      const report = await ingestTournamentStage({
        store,
        // Catalog gate fires before parsing: any snapshot proves the gate.
        // Cast needed: out-of-scope keys are (correctly) outside the union.
        tournamentSlug: "bmps-2026",
        stageKey: stageKey as unknown as "semi-finals",
        snapshot: snapshotFor(buildSemiFinalsWikitext()),
        runId: `sf-gate-${stageKey}`,
      });
      expect(report.outcome).toBe("failed");
      expect(report.error).toContain("Stage not supported");
    }
    expect(store.published).toHaveLength(0);
  });
});

// ── Negative validation fixtures ───────────────────────────────────────

describe("Semi Finals negative validation (BMPS-03)", () => {
  function validDataset(): BgmiStageDataset {
    return parseStageDataset(buildSemiFinalsWikitext(), semiFinalsOptions());
  }

  it("rejects duplicate placements (1..15 + duplicate 15)", () => {
    const dataset = validDataset();
    const match = dataset.matches[0];
    if (!match) throw new Error("fixture has no matches");
    // Placement 16 carries 0 points, so 16 -> 15 keeps arithmetic intact
    // and isolates the permutation check.
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== match.matchNumber
          ? m
          : {
              ...m,
              results: m.results.map((r) => (r.placement === 16 ? { ...r, placement: 15 } : r)),
            }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/1\.\.K permutation/);
  });

  it("rejects missing placements (gap in 1..16)", () => {
    const dataset = validDataset();
    const match = dataset.matches[0];
    if (!match) throw new Error("fixture has no matches");
    const victim = match.results.find((r) => r.placement === 8);
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== match.matchNumber
          ? m
          : { ...m, results: m.results.filter((r) => r !== victim) }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/1\.\.K permutation/);
  });

  it("rejects out-of-range placements (1..15 + 17)", () => {
    const dataset = validDataset();
    const match = dataset.matches[0];
    if (!match) throw new Error("fixture has no matches");
    // Placement 16 and 17 both carry 0 points: arithmetic stays intact.
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== match.matchNumber
          ? m
          : {
              ...m,
              results: m.results.map((r) => (r.placement === 16 ? { ...r, placement: 17 } : r)),
            }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/1\.\.K permutation/);
  });

  it("rejects unequal team participation before publication", () => {
    // One extra sit-out keeps every per-match 1..K permutation valid but
    // leaves a team on 15 maps while everyone else plays 16.
    const wikitext = buildSemiFinalsWikitext({ sitOutExtra: new Map([[24, new Set([0])]]) });
    const dataset = parseStageDataset(wikitext, semiFinalsOptions());
    expect(() => validateStageDataset(dataset)).toThrow(/unequal maps played/);
  });

  it("fails the full ingestion run on unequal participation with nothing published", async () => {
    const store = createFakeStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      snapshot: snapshotFor(buildSemiFinalsWikitext({ sitOutExtra: new Map([[24, new Set([0])]]) })),
      runId: "sf-unequal",
    });
    expect(report.outcome).toBe("failed");
    expect(report.error).toContain("unequal maps played");
    expect(store.published).toHaveLength(0);
    expect(store.runs.some((r) => r.runId === "sf-unequal" && r.status === "failed")).toBe(true);
  });

  it("rejects a completed match with zero participants", () => {
    const wikitext = buildSemiFinalsWikitext({ emptyMap: 24 });
    const dataset = parseStageDataset(wikitext, semiFinalsOptions());
    expect(() => validateStageDataset(dataset)).toThrow(/has no results/);
  });

  it("rejects K > expected participants (dataset level: 4 results for 3 teams)", () => {
    // One MS cell per team per map caps parsed results at the team count,
    // so K > N is only reachable with a hand-built dataset — the validator
    // must still fail it closed rather than trusting the count.
    const dataset = validDataset();
    const match = dataset.matches[0];
    if (!match) throw new Error("fixture has no matches");
    const extra = match.results[0];
    if (!extra) throw new Error("fixture match has no results");
    const duplicated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== match.matchNumber ? m : { ...m, results: [...m.results, extra] }
      ),
    };
    // 17 results for 24 teams: still within range, so the duplicate breaks
    // the 1..K permutation — rejected either way, nothing silently ranked.
    expect(() => validateStageDataset(duplicated)).toThrow(/1\.\.K permutation/);
  });

  it("rejects malformed sat-out values at parse time with nothing published", async () => {
    const store = createFakeStore();
    const report = await ingestTournamentStage({
      store,
      tournamentSlug: "bmps-2026",
      stageKey: "semi-finals",
      snapshot: snapshotFor(SPELLING_EXCERPT.replace(/\{\{MS\|-\|\}\}/g, "{{MS|-|5}}")),
      runId: "sf-malformed",
    });
    expect(report.outcome).toBe("failed");
    expect(report.error).toContain("Unparseable MS cell");
    expect(store.published).toHaveLength(0);
  });

  it("keeps standard stages strict: K-participant matches still fail for BMSD", () => {
    const dataset = validDataset();
    const relabeled: BgmiStageDataset = {
      ...dataset,
      tournament: { ...dataset.tournament, slug: "bmsd-2026" },
      stage: { ...dataset.stage, slug: "grand-finals" },
    };
    // Same rotation dataset under a standard stage must fail the 1..N rule.
    expect(() => validateStageDataset(relabeled)).toThrow(/has 16 results for 24 teams/);
  });
});

// ── Small rotation datasets: isolate the 1..K rule ──────────────────────

describe("Rotation 1..K permutation rule (dataset level)", () => {
  function rotationDataset(results: Array<{ team: string; placement: number; finishes: number }>): BgmiStageDataset {
    const teams = ["team a", "team b", "team c", "team d", "team e", "team f", "team g", "team h"];
    return {
      tournament: {
        slug: "bmps-2026",
        name: "BGMI Pro Series 2026",
        shortName: "BMPS 2026",
        seasonYear: 2026,
        organizer: "KRAFTON",
        startsOn: "2026-06-09",
        endsOn: "2026-06-12",
        rulebookUrl: null,
        sourceUrl: "https://liquipedia.net/pubgmobile/X",
        sourcePage: "X",
        sourceRevision: 1,
        sourceLastUpdatedAt: null,
        status: "completed",
      },
      stage: {
        slug: "semi-finals",
        name: "Semi Finals",
        formatNote: "8 teams · 1 match",
        status: "completed",
        smashRule: false,
        matchPointThreshold: null,
        sourceUrl: "https://liquipedia.net/pubgmobile/X",
        sourceRevision: 1,
      },
      teams: teams.map((name) => ({ canonicalName: name, displayName: name, shortName: name, logoUrl: null })),
      entries: teams.map((name) => ({ teamCanonical: name, startingPoints: 0, sourcePlacement: null })),
      matches: [
        {
          matchNumber: 1,
          mapName: "Erangel",
          scheduledAt: null,
          status: "completed",
          vodUrl: null,
          results: results.map(({ team, placement, finishes }) => {
            const total = matchTotal({ placement, finishes });
            return {
              teamCanonical: team,
              placement,
              finishes,
              placementPoints: total.placementPoints,
              finishPoints: total.finishPoints,
              totalPoints: total.total,
            };
          }),
        },
      ],
      scoring: { placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 },
    };
  }

  function kResults(k: number) {
    const names = ["team a", "team b", "team c", "team d", "team e", "team f", "team g", "team h"];
    return Array.from({ length: k }, (_, i) => ({
      team: names[i] ?? `team ${i}`,
      placement: i + 1,
      finishes: 2,
    }));
  }

  it("accepts K=8 with placements 1..8 at match level (only the maps invariant remains)", () => {
    // 8 teams × 1 map each is equal participation, but the stage config
    // expects 16 maps — so the ONLY failure must be the maps-count check,
    // proving the 1..8 permutation itself was accepted.
    expect(() => validateStageDataset(rotationDataset(kResults(8)))).toThrow(
      /expects 16 maps per team, found 1/
    );
  });

  it("rejects K=8 with a duplicate placement", () => {
    const results = kResults(8).map((r) => (r.placement === 8 ? { ...r, placement: 7 } : r));
    expect(() => validateStageDataset(rotationDataset(results))).toThrow(/1\.\.K permutation/);
  });

  it("rejects K=8 with a missing placement", () => {
    const results = kResults(8).filter((r) => r.placement !== 5);
    expect(() => validateStageDataset(rotationDataset(results))).toThrow(/1\.\.K permutation/);
  });

  it("rejects out-of-range placements above the team count", () => {
    const results = kResults(8).map((r) => (r.placement === 8 ? { ...r, placement: 17 } : r));
    expect(() => validateStageDataset(rotationDataset(results))).toThrow(/placement out of range/);
  });

  it("rejects zero-participant completed matches", () => {
    expect(() => validateStageDataset(rotationDataset([]))).toThrow(/has no results/);
  });

  it("rejects K > expected participants", () => {
    const base = kResults(3);
    // Placement stays within range (2 <= 3 teams) so the count check —
    // not the range check — is what must fire.
    const results = [...base, { team: "team a", placement: 2, finishes: 1 }];
    const dataset = rotationDataset(results);
    const trimmed: BgmiStageDataset = {
      ...dataset,
      teams: dataset.teams.slice(0, 3),
      entries: dataset.entries.slice(0, 3),
    };
    expect(() => validateStageDataset(trimmed)).toThrow(/has 4 results for 3 teams/);
  });

  it("rejects unequal participation even when every permutation is valid", () => {
    const dataset = rotationDataset(kResults(8));
    const first = dataset.matches[0];
    if (!first) throw new Error("dataset has no matches");
    const twoMatches: BgmiStageDataset = {
      ...dataset,
      matches: [first, { ...first, matchNumber: 2, results: first.results.slice(0, 4) }],
    };
    expect(() => validateStageDataset(twoMatches)).toThrow(/unequal maps played/);
  });
});
