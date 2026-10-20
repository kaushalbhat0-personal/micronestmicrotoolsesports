import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishedStageDetail } from "@/features/bgmi-tournaments/repositories/reads";
import { buildMatchScenario } from "./tournament-scenarios";
import {
  ROTATION_REPLAY_SCENARIOS,
  ROTATION_REPLAY_TOTAL,
  getRotationReplayScenario,
} from "./rotation-replay-scenarios";

/**
 * Recorded production facts (BMSD 2026 Grand Finals, published rev 720523,
 * read read-only via the anon public reader). The bank must match these
 * exactly — any drift fails closed here instead of shipping wrong history.
 */
const RECORDED: Record<string, { map: string; winner: [string, number, number, number]; focus: [string, number, number, number] }> = {
  "rr-bmsd-m01-nebula-opener": {
    map: "Rondo",
    winner: ["Nebula Esports", 1, 20, 30],
    focus: ["Nebula Esports", 1, 20, 30],
  },
  "rr-bmsd-m07-tamilas-aggression": {
    map: "Rondo",
    winner: ["Gladiators Esports", 1, 17, 27],
    focus: ["Team Tamilas", 4, 14, 18],
  },
  "rr-bmsd-m11-soul-response": {
    map: "Miramar",
    winner: ["Team Soul", 1, 11, 21],
    focus: ["Team Soul", 1, 11, 21],
  },
  "rr-bmsd-m14-8bit-control": {
    map: "Erangel",
    winner: ["8bit", 1, 12, 22],
    focus: ["8bit", 1, 12, 22],
  },
  "rr-bmsd-m18-finale-routes": {
    map: "Erangel",
    winner: ["Gladiators Esports", 1, 7, 17],
    focus: ["Rapid Chaos Esports", 4, 13, 17],
  },
};

function adapterFixture(scenarioId: string): PublishedStageDetail {
  const scenario = getRotationReplayScenario(scenarioId)!;
  const recorded = RECORDED[scenarioId]!;
  const teams = [recorded.winner, recorded.focus].map(([displayName, placement, finishes, totalPoints]) => ({
    rank: placement,
    teamCanonical: displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    displayName,
    placement,
    finishes,
    totalPoints,
  }));
  return {
    tournament: {
      slug: "bmsd-2026",
      name: "BGMI Masters Series Season 5",
      shortName: "BMSD",
      seasonYear: 2026,
      organizer: "KRAFTON",
      startsOn: "2026-09-04",
      endsOn: "2026-09-06",
      rulebookUrl: null,
      sourceUrl: scenario.source.sourceUrl,
      sourcePage: "BGMI_Masters_Series/Season_5",
      sourceRevision: 720523,
      sourceLastUpdatedAt: "2026-10-17T13:05:00Z",
      status: "completed",
    },
    stage: {
      slug: "grand-finals",
      name: "Grand Finals",
      formatNote: null,
      status: "completed",
      smashRule: false,
      matchPointThreshold: null,
      sourceUrl: scenario.source.sourceUrl,
      sourceRevision: 720523,
      publishedAt: "2026-10-17T13:05:00Z",
    },
    standings: [],
    matches: [
      {
        matchNumber: scenario.source.matchNumber,
        mapName: scenario.source.mapName,
        scheduledAt: "2026-09-04T10:30:00Z",
        status: "completed",
        vodUrl: null,
        results: teams,
      },
    ],
  };
}

describe("rotation-replay bank — shape and honesty", () => {
  it("ships 4–6 high-quality scenarios with unique ids", () => {
    expect(ROTATION_REPLAY_TOTAL).toBeGreaterThanOrEqual(4);
    expect(ROTATION_REPLAY_TOTAL).toBeLessThanOrEqual(6);
    expect(ROTATION_REPLAY_SCENARIOS.length).toBe(ROTATION_REPLAY_TOTAL);
    const ids = ROTATION_REPLAY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers genuinely different decision patterns", () => {
    const patterns = ROTATION_REPLAY_SCENARIOS.map((s) => s.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it("carries complete, consistent source references", () => {
    for (const s of ROTATION_REPLAY_SCENARIOS) {
      expect(s.source.tournamentSlug).toBe("bmsd-2026");
      expect(s.source.stageSlug).toBe("grand-finals");
      expect(s.source.matchId).toBe(`match-${s.source.matchNumber}`);
      expect(s.source.mapName.length).toBeGreaterThan(0);
      expect(s.source.dayLabel).toMatch(/^Day [123]$/);
      expect(s.source.sourceRevision).toBe("720523");
      expect(s.source.sourceUrl).toMatch(/^https:\/\//);
      expect(s.reveal.recordedOutcome).toContain(`Match ${s.source.matchNumber}`);
      expect(s.reveal.recordedOutcome).toContain(s.source.mapName);
    }
  });

  it("gives every scenario 2–3 choices with exactly one outcome-aligned option", () => {
    for (const s of ROTATION_REPLAY_SCENARIOS) {
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      expect(s.options.length).toBeLessThanOrEqual(3);
      const ids = s.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s.options.filter((o) => o.alignsWithOutcome)).toHaveLength(1);
      for (const o of s.options) {
        expect(o.label.length).toBeGreaterThan(0);
        expect(o.priority.length).toBeGreaterThan(0);
      }
    }
  });

  it("matches the recorded production facts exactly", () => {
    for (const s of ROTATION_REPLAY_SCENARIOS) {
      const recorded = RECORDED[s.id];
      expect(recorded, `unknown scenario ${s.id}`).toBeDefined();
      if (!recorded) throw new Error(`unknown scenario ${s.id}`);
      expect(s.source.mapName).toBe(recorded.map);
      const [wName, wP, wF, wPts] = recorded.winner;
      expect(s.winner).toEqual({ displayName: wName, placement: wP, finishes: wF, totalPoints: wPts });
      const [fName, fP, fF, fPts] = recorded.focus;
      expect(s.focusTeam).toEqual({ displayName: fName, placement: fP, finishes: fF, totalPoints: fPts });
      expect(s.reveal.recordedOutcome).toContain(fName);
      expect(s.reveal.recordedOutcome).toContain(wName);
    }
  });

  it("never claims historical certainty, intent, or predictive power", () => {
    const copy = ROTATION_REPLAY_SCENARIOS.map((s) =>
      [s.pattern, s.situation, s.question, s.reveal.recordedOutcome, s.reveal.comparison, s.reveal.labTakeaway,
        ...s.options.map((o) => `${o.label} ${o.priority}`)].join("\n")
    ).join("\n");
    for (const banned of [
      /was the correct/i,
      /correct decision/i,
      /you were right/i,
      /you were wrong/i,
      /should have/i,
      /optimal/i,
      /prediction/i,
      /predicts/i,
      /IGL rating/i,
      /skill rating/i,
      /prediction accuracy/i,
      /intended to/i,
      /thought process/i,
      /because they/i,
    ]) {
      expect(copy).not.toMatch(banned);
    }
    // Takeaways stay labelled as analysis, never as history.
    for (const s of ROTATION_REPLAY_SCENARIOS) {
      expect(s.reveal.labTakeaway.length).toBeGreaterThan(20);
    }
  });
});

describe("rotation-replay bank — adapter resolution", () => {
  it("resolves every scenario through the read-only adapter", () => {
    for (const s of ROTATION_REPLAY_SCENARIOS) {
      const resolved = buildMatchScenario(adapterFixture(s.id), s.source.matchNumber);
      expect(resolved).not.toBeNull();
      expect(resolved!.kind).toBe("tournament-derived");
      expect(resolved!.tournament.slug).toBe("bmsd-2026");
      expect(resolved!.stage.slug).toBe("grand-finals");
      expect(resolved!.match.number).toBe(s.source.matchNumber);
      expect(resolved!.match.mapName).toBe(s.source.mapName);
      expect(resolved!.ref).toEqual({
        tournamentSlug: "bmsd-2026",
        stageSlug: "grand-finals",
        matchId: `match-${s.source.matchNumber}`,
      });
      const focus = resolved!.results.find((r) => r.displayName === s.focusTeam.displayName);
      expect(focus).toMatchObject({
        placement: s.focusTeam.placement,
        finishes: s.focusTeam.finishes,
        totalPoints: s.focusTeam.totalPoints,
      });
    }
  });

  it("refuses to produce a playable scenario from incomplete source data", () => {
    const base = adapterFixture("rr-bmsd-m01-nebula-opener");
    const scheduled = { ...base, matches: [{ ...base.matches[0]!, status: "scheduled" as const }] };
    expect(buildMatchScenario(scheduled, 1)).toBeNull();
    const mapless = { ...base, matches: [{ ...base.matches[0]!, mapName: null }] };
    expect(buildMatchScenario(mapless, 1)).toBeNull();
    const resultless = { ...base, matches: [{ ...base.matches[0]!, results: [] }] };
    expect(buildMatchScenario(resultless, 1)).toBeNull();
    expect(buildMatchScenario(base, 99)).toBeNull();
  });
});

describe("rotation-replay bank — read-safe module", () => {
  it("imports no data access, network, or persistence surface", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const bank = strip(readFileSync(join(process.cwd(), "src/features/bgmi-lab/data/rotation-replay-scenarios.ts"), "utf8"));
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
