import { describe, expect, it } from "vitest";
import { parseStageDataset } from "./liquipedia";
import { validateStageDataset } from "../services/validate";

/**
 * BMPS Phase 1 syntax fixtures (synthetic teams, BMPS-observed syntax).
 *
 * Covers what the audit found on the live BMPS 2026 page for Grand Finals
 * and Last Chance: `mvp` params on Match/Map, `vod` URLs, `youtube`
 * channel param, the `YYYY-MM-DD - HH:MM` date spelling, small
 * `startingpoints` values, and no `matchpoint` (no Smash Rule).
 * No production results are embedded — values are invented for the
 * contract, counts stay tiny.
 */
const BMPS_GF_SYNTAX = `{{Infobox league
|name=Battlegrounds Mobile India Pro Series 2026
|tickername=BMPS 2026
|organizer=KRAFTON
|sdate=2026-06-09 |edate=2026-06-21
}}
==Results==
===Last Chance===
{{Bracket|Bracket/2|id=BMPS2026LC
|R1M1header=Last Chance
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1-2=up,3-16=down |mvp=Scout
    |youtube=KRAFTON INDIA ESPORTS
    |map1={{Map |date=2026-06-13 - 15:30 {{Abbr/IST}}|finished=true|map=Rondo\t|mvp=Kaalan\t\t\t|vod=https://youtu.be/euM8EKFrLL0}}
    |map2={{Map |date=2026-06-13 - 16:15 {{Abbr/IST}}|finished=true|map=Erangel\t|mvp=Pain\t\t\t|vod=https://youtu.be/euM8EKFrLL0}}
\t|opponent1={{TeamOpponent|alpha squad\t|startingpoints=2
\t\t|m1={{MS|1|4}}\t\t|m2={{MS|2|2}}
\t\t}}
\t|opponent2={{TeamOpponent|bravo club\t|startingpoints=0
\t\t|m1={{MS|2|2}}\t\t|m2={{MS|1|4}}
\t\t}}
}}
}}
===Grand Finals===
{{Bracket|Bracket/2|id=BMPS2026GF
|R1M1header=Grand Finals
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|bg=1=up |mvp=Slug
    |youtube=KRAFTON INDIA ESPORTS
    |map1={{Map |date=2026-06-19 - 16:15 {{Abbr/IST}}|finished=true|map=Rondo  |mvp=Justin\t\t\t\t\t|vod=https://youtu.be/LTDLhyT9PNo}}
    |map2={{Map |date=2026-06-19 - 17:00 {{Abbr/IST}}|finished=true|map=Erangel|mvp=Aadi\t\t\t\t\t|vod=https://youtu.be/LTDLhyT9PNo}}
\t|opponent1={{TeamOpponent|alpha squad\t|startingpoints=1
\t\t|m1={{MS|9|2}}\t\t|m2={{MS|2|3}}
\t\t}}
\t|opponent2={{TeamOpponent|bravo club\t|startingpoints=0
\t\t|m1={{MS|2|12}}\t\t|m2={{MS|1|13}}
\t\t}}
}}
}}
`;

function baseOptions(stageKey: "grand-finals" | "last-chance") {
  return {
    tournamentSlug: "bmps-2026",
    tournamentName: "Battlegrounds Mobile India Pro Series 2026",
    tournamentShortName: "BMPS 2026",
    seasonYear: 2026 as number | null,
    organizer: "KRAFTON" as string | null,
    startsOn: "2026-06-09" as string | null,
    endsOn: "2026-06-21" as string | null,
    sourceUrl: "https://liquipedia.net/pubgmobile/Battlegrounds_Mobile_India_Pro_Series/2026",
    sourcePage: "Battlegrounds Mobile India Pro Series/2026",
    sourceRevision: 721389 as number | null,
    sourceLastUpdatedAt: null as string | null,
    stageKey,
    nowIso: "2026-10-17",
  };
}

describe("BMPS Phase 1 parser syntax (BMPS-02)", () => {
  it("parses Last Chance syntax with mvp/vod/youtube params ignored", () => {
    const dataset = parseStageDataset(BMPS_GF_SYNTAX, baseOptions("last-chance"));
    expect(dataset.stage.slug).toBe("last-chance");
    expect(dataset.stage.smashRule).toBe(false);
    expect(dataset.stage.matchPointThreshold).toBeNull();
    expect(dataset.teams).toHaveLength(2);
    expect(dataset.matches).toHaveLength(2);
    // VODs flow through; mvp/youtube params are ignored without failure.
    expect(dataset.matches[0]?.vodUrl).toBe("https://youtu.be/euM8EKFrLL0");
    expect(dataset.matches[0]?.mapName).toBe("Rondo");
    expect(validateStageDataset(dataset).warnings).toEqual([]);
  });

  it("parses Grand Finals syntax and keeps starting points", () => {
    const dataset = parseStageDataset(BMPS_GF_SYNTAX, baseOptions("grand-finals"));
    expect(dataset.stage.smashRule).toBe(false);
    const byTeam = new Map(dataset.entries.map((e) => [e.teamCanonical, e.startingPoints]));
    expect(byTeam.get("alpha squad")).toBe(1);
    // alpha: sp 1 + m1 (9th=0 + 2) + m2 (2nd=6 + 3) = 12
    const alphaMatchTotals = dataset.matches.map(
      (m) => m.results.find((r) => r.teamCanonical === "alpha squad")?.totalPoints ?? 0
    );
    expect(alphaMatchTotals).toEqual([2, 9]);
    expect(12 - 1).toBe(alphaMatchTotals[0]! + alphaMatchTotals[1]!);
  });

  it("leans on the shared Points10 scoring for BMPS stages", () => {
    const dataset = parseStageDataset(BMPS_GF_SYNTAX, baseOptions("grand-finals"));
    expect(dataset.scoring).toEqual({ placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 });
  });

  it("parses BMPS hyphenated date spellings into IST instants", () => {
    // BMPS uses `YYYY-MM-DD - HH:MM`; the parser accepts this alongside the
    // BMSD `YYYY-MM-DD HH:MM` dialect (both IST → UTC).
    const dataset = parseStageDataset(BMPS_GF_SYNTAX, baseOptions("grand-finals"));
    const byNumber = new Map(dataset.matches.map((m) => [m.matchNumber, m]));
    // 2026-06-19 16:15 IST = 10:45 UTC; 17:00 IST = 11:30 UTC.
    expect(byNumber.get(1)?.scheduledAt).toBe("2026-06-19T10:45:00.000Z");
    expect(byNumber.get(2)?.scheduledAt).toBe("2026-06-19T11:30:00.000Z");
  });
});
