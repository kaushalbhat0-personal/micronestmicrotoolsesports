import { describe, expect, it } from "vitest";
import {
  ZONE_PATTERN_DATASETS,
  datasetId,
  dayPatterns,
  finishesSummary,
  formatAverage,
  getDataset,
  mapPatterns,
  placementDistribution,
  pointsSummary,
  rate,
  selectMatches,
  teamPatterns,
} from "./zone-patterns";

const GF = getDataset("bmsd-2026/grand-finals")!;

describe("zone-patterns — dataset integrity", () => {
  it("pins three completed stages with per-stage revisions", () => {
    expect(ZONE_PATTERN_DATASETS.map(datasetId).sort()).toEqual(
      ["bgmi-showdown-2026/grand-finals", "bmsd-2026/grand-finals", "bmsd-2026/playoffs"].sort()
    );
    for (const d of ZONE_PATTERN_DATASETS) {
      expect(d.sourceRevision).toMatch(/^\d+$/);
      expect(d.matches.length).toBe(18);
      expect(d.matches.every((m) => m.rows.length === 16)).toBe(true);
      expect(d.tournamentSourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("resolves datasets by id and rejects unknowns", () => {
    expect(getDataset("bmsd-2026/grand-finals")?.stageName).toBe("Grand Finals");
    expect(getDataset("nope/nope")).toBeNull();
  });

  it("matches recorded production facts exactly", () => {
    const m1 = GF.matches.find((m) => m.number === 1)!;
    expect(m1.map).toBe("Rondo");
    expect(m1.day).toBe("Day 1");
    const nebula = m1.rows.find((r) => GF.teams[r.team]?.displayName === "Nebula Esports");
    expect(nebula).toMatchObject({ placement: 1, finishes: 20, totalPoints: 30 });
    const m18 = GF.matches.find((m) => m.number === 18)!;
    const rapid = m18.rows.find((r) => GF.teams[r.team]?.displayName === "Rapid Chaos Esports");
    expect(rapid).toMatchObject({ placement: 4, finishes: 13, totalPoints: 17 });
    const glad = m18.rows.find((r) => GF.teams[r.team]?.displayName === "Gladiators Esports");
    expect(glad).toMatchObject({ placement: 1, finishes: 7, totalPoints: 17 });
  });
});

describe("zone-patterns — match selection", () => {
  it("scopes by map and day deterministically", () => {
    expect(selectMatches(GF, "all", "all")).toHaveLength(18);
    const erangel = selectMatches(GF, "Erangel", "all");
    expect(erangel).toHaveLength(6);
    expect(erangel.every((m) => m.map === "Erangel")).toBe(true);
    const day1 = selectMatches(GF, "all", "Day 1");
    expect(day1).toHaveLength(6);
    expect(selectMatches(GF, "Erangel", "Day 1")).toHaveLength(2);
  });

  it("names the recorded winner with output", () => {
    const m1 = selectMatches(GF, "all", "all").find((m) => m.number === 1)!;
    expect(m1.winnerName).toBe("Nebula Esports");
    expect(m1.winnerFinishes).toBe(20);
    expect(m1.winnerPoints).toBe(30);
  });
});

describe("zone-patterns — placement distribution", () => {
  it("counts wins, top-4, top-8 over every appearance", () => {
    const dist = placementDistribution(selectMatches(GF, "all", "all"));
    expect(dist.total).toBe(18 * 16);
    expect(dist.wins).toBe(18);
    expect(dist.top4).toBe(18 * 4);
    expect(dist.top8).toBe(18 * 8);
    expect(dist.bottom8).toBe(18 * 8);
  });
});

describe("zone-patterns — finishes and points", () => {
  it("summarizes finishes with the recorded best game", () => {
    const s = finishesSummary(selectMatches(GF, "all", "all"));
    expect(s.best).toMatchObject({ teamName: "Nebula Esports", finishes: 20, matchNumber: 1 });
    expect(s.averagePerAppearance).toBeGreaterThan(0);
    expect(s.total).toBeGreaterThan(0);
  });

  it("summarizes points with winning averages and the recorded best", () => {
    const s = pointsSummary(selectMatches(GF, "all", "all"));
    expect(s.best).toMatchObject({ teamName: "Nebula Esports", totalPoints: 30, matchNumber: 1 });
    expect(s.averageWinningTotal).toBeGreaterThan(s.averagePerAppearance);
  });

  it("returns zeros — never NaN — on an empty sample", () => {
    expect(finishesSummary([])).toEqual({ total: 0, averagePerAppearance: 0, best: null });
    expect(pointsSummary([])).toEqual({ averagePerAppearance: 0, averageWinningTotal: 0, best: null });
    expect(placementDistribution([])).toEqual({ wins: 0, top4: 0, top8: 0, bottom8: 0, total: 0 });
  });
});

describe("zone-patterns — team consistency", () => {
  it("aggregates every team and orders by average placement", () => {
    const rows = teamPatterns(selectMatches(GF, "all", "all"));
    expect(rows).toHaveLength(16);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.averagePlacement).toBeGreaterThanOrEqual(rows[i - 1]!.averagePlacement - 1e-9);
    }
    const nebula = rows.find((r) => r.teamName === "Nebula Esports")!;
    expect(nebula.played).toBe(18);
    expect(nebula.wins).toBeGreaterThanOrEqual(1);
  });

  it("restricts aggregates to the scoped filter", () => {
    const rows = teamPatterns(selectMatches(GF, "Erangel", "all"));
    expect(rows.every((r) => r.played === 6)).toBe(true);
  });
});

describe("zone-patterns — day and map views", () => {
  it("progresses days in order with winners listed", () => {
    const days = dayPatterns(selectMatches(GF, "all", "all"));
    expect(days.map((d) => d.day)).toEqual(["Day 1", "Day 2", "Day 3"]);
    expect(days.every((d) => d.matches === 6)).toBe(true);
    expect(days[0]!.winners).toHaveLength(6);
  });

  it("compares maps with per-map averages", () => {
    const maps = mapPatterns(selectMatches(GF, "all", "all"));
    expect(maps.map((m) => m.map).sort()).toEqual(["Erangel", "Miramar", "Rondo"]);
    expect(maps.every((m) => m.matches === 6)).toBe(true);
    for (const m of maps) {
      expect(m.averageFinishesPerAppearance).toBeGreaterThan(0);
      expect(m.winners.length).toBeGreaterThan(0);
    }
  });
});

describe("zone-patterns — formatting helpers", () => {
  it("rates safely with zero denominators", () => {
    expect(rate(3, 12)).toBeCloseTo(25);
    expect(rate(0, 0)).toBe(0);
    expect(formatAverage(4.256)).toBe("4.3");
  });
});
