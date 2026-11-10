import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS,
  TOURNAMENT_SCENARIO_GENERATOR_TOTAL,
  getTournamentScenarioGeneratorScenario,
} from "./tournament-scenario-generator-scenarios";

/**
 * Recorded production facts (BMSD 2026 Grand Finals, published rev 720523,
 * cross-checked against the Zone Pattern Explorer pinned dataset). The bank
 * must match these exactly — any drift fails closed here instead of
 * shipping wrong history.
 */
const RECORDED: Record<string, { map: string; day: string; winner: [string, number, number, number]; spotlight: [string, number, number, number] }> = {
  "tsg-bmsd-m02-rntx-response": {
    map: "Erangel",
    day: "Day 1",
    winner: ["Rntx", 1, 10, 20],
    spotlight: ["Nebula Esports", 2, 6, 12],
  },
  "tsg-bmsd-m04-reckoning-volatility": {
    map: "Rondo",
    day: "Day 1",
    winner: ["Reckoning Esports", 1, 9, 19],
    spotlight: ["Nebula Esports", 16, 4, 4],
  },
  "tsg-bmsd-m06-tamilas-efficiency": {
    map: "Erangel",
    day: "Day 1",
    winner: ["Team Tamilas", 1, 6, 16],
    spotlight: ["Team Tamilas", 1, 6, 16],
  },
  "tsg-bmsd-m10-apex-breakthrough": {
    map: "Rondo",
    day: "Day 2",
    winner: ["Team Apex Gaming", 1, 13, 23],
    spotlight: ["Orangutan", 3, 14, 19],
  },
  "tsg-bmsd-m15-ceiling-floor": {
    map: "Miramar",
    day: "Day 3",
    winner: ["Orangutan", 1, 14, 24],
    spotlight: ["Gladiators Esports", 16, 0, 0],
  },
  "tsg-bmsd-m17-momentum-answer": {
    map: "Miramar",
    day: "Day 3",
    winner: ["Orangutan", 1, 14, 24],
    spotlight: ["Nebula Esports", 3, 5, 10],
  },
};

describe("scenario-generator bank — shape and honesty", () => {
  it("ships 5–8 scenarios with unique ids and unique match references", () => {
    expect(TOURNAMENT_SCENARIO_GENERATOR_TOTAL).toBeGreaterThanOrEqual(5);
    expect(TOURNAMENT_SCENARIO_GENERATOR_TOTAL).toBeLessThanOrEqual(8);
    expect(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length).toBe(TOURNAMENT_SCENARIO_GENERATOR_TOTAL);
    const ids = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const matches = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) => s.source.matchNumber);
    expect(new Set(matches).size).toBe(matches.length);
  });

  it("covers genuinely different tactical themes", () => {
    const themes = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) => s.theme);
    expect(new Set(themes).size).toBe(themes.length);
  });

  it("carries complete, consistent source references", () => {
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      expect(s.source.tournamentSlug).toBe("bmsd-2026");
      expect(s.source.stageSlug).toBe("grand-finals");
      expect(s.source.matchId).toBe(`match-${s.source.matchNumber}`);
      expect(s.source.mapName.length).toBeGreaterThan(0);
      expect(s.source.dayLabel).toMatch(/^Day [123]$/);
      expect(s.source.sourceRevision).toBe("720523");
      expect(s.source.sourceUrl).toMatch(/^https:\/\//);
      expect(getTournamentScenarioGeneratorScenario(s.id)).toBe(s);
    }
    expect(getTournamentScenarioGeneratorScenario("nope")).toBeNull();
  });

  it("varies maps and days across the bank", () => {
    const maps = new Set(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) => s.source.mapName));
    const days = new Set(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) => s.source.dayLabel));
    expect(maps.size).toBeGreaterThanOrEqual(2);
    expect(days.size).toBeGreaterThanOrEqual(2);
  });

  it("gives every scenario three choices with exactly one outcome-aligned option", () => {
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      expect(s.options).toHaveLength(3);
      const ids = s.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s.options.filter((o) => o.alignsWithOutcome)).toHaveLength(1);
      const aligned = s.options.find((o) => o.alignsWithOutcome)!;
      expect(aligned.tone).toBe("stronger");
      for (const o of s.options) {
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.priority.length).toBeGreaterThan(0);
        expect(o.rationale.length).toBeGreaterThan(20);
        expect(["stronger", "higher-risk", "conservative"]).toContain(o.tone);
      }
      // The two non-aligned tones differ — each scenario teaches a real trade-off.
      const tones = s.options.filter((o) => !o.alignsWithOutcome).map((o) => o.tone);
      expect(new Set(tones).size).toBe(2);
    }
  });

  it("completes every reveal: recorded outcome, comparison, takeaway", () => {
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      expect(s.reveal.recordedOutcome).toContain(`Match ${s.source.matchNumber}`);
      expect(s.reveal.recordedOutcome).toContain(s.source.mapName);
      expect(s.reveal.comparison.length).toBeGreaterThan(20);
      expect(s.reveal.labTakeaway.length).toBeGreaterThan(20);
      expect(s.situation.length).toBeGreaterThan(20);
      expect(s.question.length).toBeGreaterThan(0);
      expect(s.question).toMatch(/\?/);
    }
  });

  it("matches the recorded production facts exactly", () => {
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      const recorded = RECORDED[s.id];
      expect(recorded, `unknown scenario ${s.id}`).toBeDefined();
      if (!recorded) throw new Error(`unknown scenario ${s.id}`);
      expect(s.source.mapName).toBe(recorded.map);
      expect(s.source.dayLabel).toBe(recorded.day);
      const [wName, wP, wF, wPts] = recorded.winner;
      expect(s.winner).toEqual({ displayName: wName, placement: wP, finishes: wF, totalPoints: wPts });
      const [fName, fP, fF, fPts] = recorded.spotlight;
      expect(s.spotlight).toEqual({ displayName: fName, placement: fP, finishes: fF, totalPoints: fPts });
      expect(s.reveal.recordedOutcome).toContain(fName);
      expect(s.reveal.recordedOutcome).toContain(wName);
    }
  });

  it("invents no telemetry, intent, or hidden-decision fields", () => {
    const keys = JSON.stringify(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS).toLowerCase();
    for (const banned of [
      "coordinate",
      "telemetry",
      "rotation path",
      "loot",
      "kill location",
      "igl intent",
      "comms",
      "circle geometry",
      "zone coordinate",
      "movement path",
    ]) {
      expect(keys).not.toContain(banned);
    }
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      expect(Object.keys(s).sort()).toEqual(
        ["id", "options", "question", "reveal", "situation", "source", "spotlight", "theme", "winner"].sort()
      );
    }
  });

  it("never claims prediction, correctness, or skill rating", () => {
    const copy = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s) =>
      [s.theme, s.situation, s.question, s.reveal.recordedOutcome, s.reveal.comparison, s.reveal.labTakeaway,
        ...s.options.map((o) => `${o.label} ${o.priority} ${o.rationale}`)].join("\n")
    ).join("\n");
    for (const banned of [
      /predict the next circle/i,
      /predict the winner/i,
      /guarantee/i,
      /accurate prediction/i,
      /accuracy %/i,
      /correct IGL/i,
      /best player/i,
      /skill rating/i,
      /professional-level/i,
      /this is what the team intended/i,
      /this is what the player should have done/i,
      /was the correct/i,
      /correct decision/i,
      /you were right/i,
      /you were wrong/i,
      /you played like a pro/i,
      /should have/i,
      /optimal/i,
      /prediction/i,
      /predicts/i,
      /IGL rating/i,
      /rates your skill/i,
      /accuracy/i,
      /percentile/i,
      /leaderboard/i,
      /intended to/i,
      /thought process/i,
      /because they/i,
    ]) {
      expect(copy).not.toMatch(banned);
    }
  });
});

describe("scenario-generator bank — read-safe module", () => {
  it("imports no data access, network, or persistence surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const bank = strip(readFileSync(join(process.cwd(), "src/features/bgmi-lab/data/tournament-scenario-generator-scenarios.ts"), "utf8"));
    for (const banned of [
      "supabase",
      "createClient",
      "service_role",
      "fetch(",
      "localStorage",
      "billing",
      "entitlement",
      ".insert(",
      ".update(",
      ".upsert(",
      "ingest",
    ]) {
      expect(bank).not.toContain(banned);
    }
  });
});
