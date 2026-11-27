import { describe, expect, it } from "vitest";
import { deriveStandings } from "./standings";
import type { BgmiMatch, BgmiStageEntry, BgmiTeam } from "../types";

const TEAMS: BgmiTeam[] = [
  { canonicalName: "alpha", displayName: "Alpha", shortName: "Alpha", logoUrl: null },
  { canonicalName: "bravo", displayName: "Bravo", shortName: "Bravo", logoUrl: null },
  { canonicalName: "charlie", displayName: "Charlie", shortName: "Charlie", logoUrl: null },
];

function entry(teamCanonical: string, startingPoints: number): BgmiStageEntry {
  return { teamCanonical, startingPoints, sourcePlacement: null };
}

describe("deriveStandings", () => {
  it("adds starting points to match totals and ranks by total", () => {
    const matches: BgmiMatch[] = [
      {
        matchNumber: 1,
        mapName: "Erangel",
        scheduledAt: null,
        status: "completed",
        vodUrl: null,
        results: [
          { teamCanonical: "alpha", placement: 1, finishes: 8, placementPoints: 10, finishPoints: 8, totalPoints: 18 },
          { teamCanonical: "bravo", placement: 2, finishes: 4, placementPoints: 6, finishPoints: 4, totalPoints: 10 },
          { teamCanonical: "charlie", placement: 3, finishes: 2, placementPoints: 5, finishPoints: 2, totalPoints: 7 },
        ],
      },
    ];
    const rows = deriveStandings(TEAMS, [entry("alpha", 10), entry("bravo", 30), entry("charlie", 0)], matches);
    // bravo 40, alpha 28, charlie 7
    expect(rows.map((r) => r.teamCanonical)).toEqual(["bravo", "alpha", "charlie"]);
    expect(rows[0]).toMatchObject({ totalPoints: 40, startingPoints: 30, matchPoints: 10, rank: 1 });
    expect(rows[1]).toMatchObject({ totalPoints: 28, wins: 1, matchesPlayed: 1 });
  });

  it("breaks ties by wins, then placement points, then finishes, then last match", () => {
    const matches: BgmiMatch[] = [
      {
        matchNumber: 1,
        mapName: "Erangel",
        scheduledAt: null,
        status: "completed",
        vodUrl: null,
        results: [
          { teamCanonical: "alpha", placement: 1, finishes: 0, placementPoints: 10, finishPoints: 0, totalPoints: 10 },
          { teamCanonical: "bravo", placement: 4, finishes: 6, placementPoints: 4, finishPoints: 6, totalPoints: 10 },
          { teamCanonical: "charlie", placement: 5, finishes: 0, placementPoints: 3, finishPoints: 0, totalPoints: 3 },
        ],
      },
    ];
    const rows = deriveStandings(TEAMS, [entry("alpha", 0), entry("bravo", 0), entry("charlie", 0)], matches);
    // Both on 10: alpha has the WWCD, ranks first.
    expect(rows.map((r) => r.teamCanonical)).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("ignores scheduled matches", () => {
    const matches: BgmiMatch[] = [
      {
        matchNumber: 1,
        mapName: "Erangel",
        scheduledAt: null,
        status: "scheduled",
        vodUrl: null,
        results: [],
      },
    ];
    const rows = deriveStandings(TEAMS, [entry("alpha", 5), entry("bravo", 0), entry("charlie", 0)], matches);
    expect(rows[0]).toMatchObject({ teamCanonical: "alpha", totalPoints: 5, matchesPlayed: 0 });
  });
});
