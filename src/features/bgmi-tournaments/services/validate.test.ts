import { describe, expect, it } from "vitest";
import type { BgmiStageDataset } from "../types";
import { validateStageDataset } from "./validate";

function baseDataset(): BgmiStageDataset {
  return {
    tournament: {
      slug: "bmsd-2026",
      name: "BGMI Masters Series 2026",
      shortName: "BMSD 2026",
      seasonYear: 2026,
      organizer: "NODWIN Gaming",
      startsOn: "2026-08-10",
      endsOn: "2026-09-06",
      rulebookUrl: null,
      sourceUrl: "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5",
      sourcePage: "BGMI Masters Series/Season 5",
      sourceRevision: 720523,
      sourceLastUpdatedAt: "2026-10-03T16:50:39Z",
      status: "completed",
    },
    stage: {
      slug: "grand-finals",
      name: "Grand Finals",
      formatNote: "3 teams · 2 matches",
      status: "completed",
      smashRule: false,
      matchPointThreshold: null,
      sourceUrl: "https://liquipedia.net/pubgmobile/BGMI_Masters_Series/Season_5",
      sourceRevision: 720523,
    },
    teams: [
      { canonicalName: "team a", displayName: "Team A", shortName: "Team A", logoUrl: null },
      { canonicalName: "team b", displayName: "Team B", shortName: "Team B", logoUrl: null },
      { canonicalName: "team c", displayName: "Team C", shortName: "Team C", logoUrl: null },
    ],
    entries: [
      { teamCanonical: "team a", startingPoints: 10, sourcePlacement: null },
      { teamCanonical: "team b", startingPoints: 0, sourcePlacement: null },
      { teamCanonical: "team c", startingPoints: 5, sourcePlacement: null },
    ],
    matches: [
      {
        matchNumber: 1,
        mapName: "Erangel",
        scheduledAt: null,
        status: "completed",
        vodUrl: null,
        results: [
          { teamCanonical: "team a", placement: 1, finishes: 8, placementPoints: 10, finishPoints: 8, totalPoints: 18 },
          { teamCanonical: "team b", placement: 2, finishes: 4, placementPoints: 6, finishPoints: 4, totalPoints: 10 },
          { teamCanonical: "team c", placement: 3, finishes: 2, placementPoints: 5, finishPoints: 2, totalPoints: 7 },
        ],
      },
      {
        matchNumber: 2,
        mapName: "Miramar",
        scheduledAt: null,
        status: "scheduled",
        vodUrl: null,
        results: [],
      },
    ],
    scoring: { placementPoints: [10, 6, 5, 4, 3, 2, 1, 1], finishPointValue: 1 },
  };
}

describe("validateStageDataset", () => {
  it("accepts a well-formed dataset with scheduled matches pending", () => {
    expect(validateStageDataset(baseDataset()).warnings).toEqual([]);
  });

  it("rejects a changed source scoring table instead of rescoring", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      scoring: { placementPoints: [12, 9, 8, 6, 5, 4, 2, 2], finishPointValue: 1 },
    };
    expect(() => validateStageDataset(mutated)).toThrow(/scoring table changed/);
  });

  it("rejects duplicate placements in a completed match", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== 1
          ? m
          : {
              ...m,
              // Team C claims 2nd (6 pts) + 2 finishes = 8: arithmetic is
              // consistent, but 2nd is taken twice → permutation failure.
              results: m.results.map((r) =>
                r.teamCanonical === "team c"
                  ? { ...r, placement: 2, placementPoints: 6, totalPoints: 8 }
                  : r
              ),
            }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/1\.\.N permutation/);
  });

  it("rejects arithmetic mismatches instead of overwriting", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== 1
          ? m
          : {
              ...m,
              results: m.results.map((r) => (r.teamCanonical === "team a" ? { ...r, totalPoints: 999 } : r)),
            }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/arithmetic mismatch/);
  });

  it("rejects incomplete completed matches", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      matches: dataset.matches.map((m) =>
        m.matchNumber !== 1 ? m : { ...m, results: m.results.slice(0, 2) }
      ),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/has 2 results for 3 teams/);
  });

  it("treats partial source placements as advisory warnings", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      entries: dataset.entries.map((e) =>
        e.teamCanonical === "team a" ? { ...e, sourcePlacement: 3 } : e
      ),
    };
    const { warnings } = validateStageDataset(mutated);
    expect(warnings.some((w) => w.code === "partial-source-placement")).toBe(true);
  });

  it("fails when complete source placements disagree with derived ranks", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      entries: dataset.entries.map((e) => ({
        ...e,
        // Derived totals: a=28, c=12, b=10 → ranks a=1, c=2, b=3. Claim otherwise.
        sourcePlacement: e.teamCanonical === "team a" ? 3 : e.teamCanonical === "team b" ? 1 : 2,
      })),
    };
    expect(() => validateStageDataset(mutated)).toThrow(/disagree with complete source placements/);
  });

  it("accepts complete source placements that agree with derived ranks", () => {
    const dataset = baseDataset();
    const mutated: BgmiStageDataset = {
      ...dataset,
      entries: dataset.entries.map((e) => ({
        ...e,
        sourcePlacement: e.teamCanonical === "team a" ? 1 : e.teamCanonical === "team c" ? 2 : 3,
      })),
    };
    expect(() => validateStageDataset(mutated)).not.toThrow();
  });

  it("rejects entries and teams that do not line up", () => {
    const dataset = baseDataset();
    expect(() =>
      validateStageDataset({ ...dataset, entries: dataset.entries.slice(0, 2) })
    ).toThrow(/no stage entry/);
  });
});
