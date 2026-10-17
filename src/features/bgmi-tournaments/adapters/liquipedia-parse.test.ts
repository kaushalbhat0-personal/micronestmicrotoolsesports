import { describe, expect, it } from "vitest";
import {
  displayTeamName,
  extractSection,
  normalizeTeamKey,
  parseInfoboxLeague,
  parseMapDate,
  parseMatchBlock,
  parseStageDataset,
  findTemplates,
} from "./liquipedia";

/**
 * Fixture: real-syntax excerpt shaped exactly like the Liquipedia
 * `BGMI Masters Series/Season 5` Grand Finals bracket (rev 720523).
 * Team names, MS cells, and map rotation mirror the source structure;
 * values are a 3-team / 3-map slice so the contract stays readable.
 */
const GF_EXCERPT = `{{Infobox league
|name=BGMI Masters Series<br> Season 5
|tickername=BGMS S5
|organizer=NODWIN Gaming
|sdate=2026-08-10 |edate=2026-09-06
}}
==Results==
===Playoffs===
{{Bracket|Bracket/2|id=bgms2026pl
|R1M1={{Match|finished=true
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|map1= {{Map|date=2026-08-31 16:00 {{Abbr/IST}}|finished=true|map=Rondo  |vod=}}
    |map2= {{Map|date=2026-08-31 16:40 {{Abbr/IST}}|finished=false|map=Erangel|vod=}}
\t|opponent1={{TeamOpponent|nebula esports\t|startingpoints=27
\t\t|m1={{MS|8|11}}\t\t|m2={{MS|7|6}}
\t\t}}
\t|opponent2={{TeamOpponent|genesis esports (indian team)\t|startingpoints=20
\t\t|m1={{MS|-}}\t\t|m2={{MS|3|10}}
\t\t}}
\t|opponent3={{TeamOpponent|team soul\t\t|startingpoints=28
\t\t|m1={{MS|1|20}}\t\t|m2={{MS|2|6}}
\t\t}}
}}
}}
===Grand Finals===
{{Bracket|Bracket/2|id=bgms2026gf
|R1M1header=Grand Finals
|R1M1={{Match|finished=true\t|matchpoint=204
    |p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1
\t|map1= {{Map|date=2026-09-04 16:00 {{Abbr/IST}}|finished=true|map=Rondo  |vod=}}
    |map2= {{Map|date=2026-09-04 16:40 {{Abbr/IST}}|finished=true|map=Erangel|vod=}}
    |map3= {{Map|date=2026-09-05 16:00 {{Abbr/IST}}|finished=false|map=Miramar|vod=}}
\t|opponent1={{TeamOpponent|nebula esports\t|startingpoints=28
\t\t|m1={{MS|1|20}}\t\t|m2={{MS|2|6}}\t\t|m3={{MS|1|12}}
\t\t}}
\t|opponent2={{TeamOpponent|genesis esports (indian team)\t|startingpoints=20
\t\t|m1={{MS|14|6}}\t\t|m2={{MS|3|2}}\t\t|m3={{MS|2|12}}
\t\t}}
\t|opponent3={{TeamOpponent|team soul\t\t|startingpoints=28\t|placement=7
\t\t|m1={{MS|10|3}}\t\t|m2={{MS|15|4}}\t\t|m3={{MS|10|3}}
\t\t}}
}}
}}
`;

describe("Liquipedia adapter — template scanning", () => {
  it("finds top-level templates without leaking nested ones", () => {
    const blocks = findTemplates(GF_EXCERPT, "Bracket");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.raw.startsWith("{{Bracket|")).toBe(true);
    expect(blocks[0]?.raw.endsWith("}}")).toBe(true);
  });

  it("extracts H3 sections and stops at the next H3", () => {
    const section = extractSection(GF_EXCERPT, "Grand Finals");
    expect(section).not.toBeNull();
    expect(section).toContain("bgms2026gf");
    expect(section).not.toContain("bgms2026pl");
    expect(extractSection(GF_EXCERPT, "Semi Finals")).toBeNull();
  });

  it("parses the infobox without wiki markup leaking", () => {
    const meta = parseInfoboxLeague(GF_EXCERPT);
    expect(meta.name).toBe("BGMI Masters Series Season 5");
    expect(meta.organizer).toBe("NODWIN Gaming");
    expect(meta.startDate).toBe("2026-08-10");
    expect(meta.endDate).toBe("2026-09-06");
  });
});

describe("Liquipedia adapter — match parsing", () => {
  function grandFinalsMatch() {
    const section = extractSection(GF_EXCERPT, "Grand Finals") ?? "";
    const bracket = findTemplates(section, "Bracket")[0];
    const match = findTemplates(bracket?.inner ?? "", "Match")[0];
    return parseMatchBlock(match?.inner ?? "");
  }

  it("reads scoring, smash threshold, maps, and opponents", () => {
    const parsed = grandFinalsMatch();
    expect(parsed.placementPoints).toEqual([10, 6, 5, 4, 3, 2, 1, 1]);
    expect(parsed.finishPointValue).toBe(1);
    expect(parsed.matchPoint).toBe(204);
    expect(parsed.maps.size).toBe(3);
    expect(parsed.teams).toHaveLength(3);
  });

  it("parses map dates as IST instants and finished flags", () => {
    const parsed = grandFinalsMatch();
    expect(parsed.maps.get(1)).toMatchObject({ mapName: "Rondo", finished: true });
    expect(parsed.maps.get(3)).toMatchObject({ mapName: "Miramar", finished: false });
    // 2026-09-04 16:00 IST = 10:30 UTC
    expect(parsed.maps.get(1)?.scheduledAt).toBe("2026-09-04T10:30:00.000Z");
    expect(parseMapDate("not a date")).toBeNull();
  });

  it("handles MS cells, sat-out maps, starting points, and placement hints", () => {
    const parsed = grandFinalsMatch();
    const byName = new Map(parsed.teams.map((t) => [t.teamName, t]));
    expect(byName.get("nebula esports")?.startingPoints).toBe(28);
    expect(byName.get("nebula esports")?.results.get(1)).toEqual({ placement: 1, finishes: 20 });
    expect(byName.get("team soul")?.sourcePlacement).toBe(7);
    expect(byName.get("team soul")?.sourcePlacement).toBe(7);
  });

  it("parses sat-out maps as null across sections", () => {
    const section = extractSection(GF_EXCERPT, "Playoffs") ?? "";
    const bracket = findTemplates(section, "Bracket")[0];
    const match = findTemplates(bracket?.inner ?? "", "Match")[0];
    const parsed = parseMatchBlock(match?.inner ?? "");
    const genesis = parsed.teams.find((t) => t.teamName === "genesis esports (indian team)");
    expect(genesis?.results.get(1)).toBeNull();
    expect(genesis?.results.get(2)).toEqual({ placement: 3, finishes: 10 });
  });

  it("rejects matches with missing scoring or opponents", () => {
    expect(() => parseMatchBlock("|p1=10 |finished=true")).toThrow();
    expect(() => parseMatchBlock("|p_kill=1 |p1=10 |p2=6 |p3=5 |p4=4 |p5=3 |p6=2 |p7=1 |p8=1")).toThrow();
  });
});

describe("Liquipedia adapter — team identity", () => {
  it("normalizes keys and strips disambiguation for display", () => {
    expect(normalizeTeamKey("  Genesis Esports  (Indian Team) ")).toBe("genesis esports (indian team)");
    expect(displayTeamName("genesis esports (indian team)")).toBe("Genesis Esports");
    expect(displayTeamName("team soul")).toBe("Team Soul");
    expect(displayTeamName("8bit")).toBe("8bit");
  });
});

describe("Liquipedia adapter — stage dataset", () => {
  it("assembles a normalized Grand Finals dataset with point math", () => {
    const dataset = parseStageDataset(GF_EXCERPT, {
      tournamentSlug: "bmsd-2026",
      tournamentName: "BGMI Masters Series 2026",
      tournamentShortName: "BMSD 2026",
      seasonYear: 2026,
      organizer: "NODWIN Gaming",
      startsOn: "2026-08-10",
      endsOn: "2026-09-06",
      sourceUrl: "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5",
      sourcePage: "BGMI Masters Series/Season 5",
      sourceRevision: 720523,
      sourceLastUpdatedAt: "2026-10-03T16:50:39Z",
      stageKey: "grand-finals",
      nowIso: "2026-10-17",
    });
    expect(dataset.tournament.status).toBe("completed");
    expect(dataset.stage.slug).toBe("grand-finals");
    expect(dataset.stage.smashRule).toBe(true);
    expect(dataset.stage.matchPointThreshold).toBe(204);
    expect(dataset.teams).toHaveLength(3);
    const nebulaMatch1 = dataset.matches[0]?.results.find((r) => r.teamCanonical === "nebula esports");
    // 1st (10) + 20 finishes = 30
    expect(nebulaMatch1).toMatchObject({ placementPoints: 10, finishPoints: 20, totalPoints: 30 });
    // Unfinished map 3 carries no results for a finished-stage slice
    const map3 = dataset.matches.find((m) => m.matchNumber === 3);
    expect(map3?.status).toBe("scheduled");
    expect(dataset.stage.status).toBe("ongoing");
  });

  it("fails closed on unknown stage sections", () => {
    expect(() =>
      parseStageDataset(GF_EXCERPT, {
        tournamentSlug: "bmsd-2026",
        tournamentName: "x",
        tournamentShortName: "x",
        seasonYear: null,
        organizer: null,
        startsOn: null,
        endsOn: null,
        sourceUrl: "https://liquipedia.net/pubgmobile/X",
        sourcePage: "X",
        sourceRevision: null,
        sourceLastUpdatedAt: null,
        stageKey: "grand-finals",
        nowIso: "2026-10-17",
      })
    ).not.toThrow();
    expect(() =>
      parseStageDataset("no sections here", {
        tournamentSlug: "bmsd-2026",
        tournamentName: "x",
        tournamentShortName: "x",
        seasonYear: null,
        organizer: null,
        startsOn: null,
        endsOn: null,
        sourceUrl: "https://liquipedia.net/pubgmobile/X",
        sourcePage: "X",
        sourceRevision: null,
        sourceLastUpdatedAt: null,
        stageKey: "playoffs",
        nowIso: "2026-10-17",
      })
    ).toThrow();
  });
});
