import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishedStageDetail } from "@/features/bgmi-tournaments/repositories/reads";
import { buildMatchScenario, listScenarioMatchNumbers } from "./tournament-scenarios";

function fixture(): PublishedStageDetail {
  return {
    tournament: {
      slug: "bmsd-2026",
      name: "BGMI Showdown 2026",
      shortName: "BMSD",
      seasonYear: 2026,
      organizer: "KRAFTON",
      startsOn: "2026-01-01",
      endsOn: "2026-01-05",
      rulebookUrl: null,
      sourceUrl: "https://liquipedia.net/example",
      sourcePage: "Example",
      sourceRevision: 12345,
      sourceLastUpdatedAt: "2026-01-06T00:00:00Z",
      status: "completed",
    },
    stage: {
      slug: "grand-finals",
      name: "Grand Finals",
      formatNote: null,
      status: "completed",
      smashRule: false,
      matchPointThreshold: null,
      sourceUrl: null,
      sourceRevision: 12344,
      publishedAt: "2026-01-06T00:00:00Z",
    },
    standings: [],
    matches: [
      {
        matchNumber: 1,
        mapName: "Erangel",
        scheduledAt: "2026-01-05T10:00:00Z",
        status: "completed",
        vodUrl: null,
        results: [
          { rank: 1, teamCanonical: "team-a", displayName: "Team A", placement: 1, finishes: 12, totalPoints: 27 },
          { rank: 2, teamCanonical: "team-b", displayName: "Team B", placement: 2, finishes: 8, totalPoints: 18 },
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
      {
        matchNumber: 3,
        mapName: null,
        scheduledAt: null,
        status: "completed",
        vodUrl: null,
        results: [
          { rank: 1, teamCanonical: "team-c", displayName: "Team C", placement: 1, finishes: 5, totalPoints: 20 },
        ],
      },
      {
        matchNumber: 4,
        mapName: "Sanhok",
        scheduledAt: null,
        status: "completed",
        vodUrl: null,
        results: [],
      },
    ],
  };
}

describe("tournament-scenarios adapter — transformation", () => {
  it("turns a completed published match into an identity-preserving scenario", () => {
    const scenario = buildMatchScenario(fixture(), 1);
    expect(scenario).not.toBeNull();
    expect(scenario!.kind).toBe("tournament-derived");
    expect(scenario!.tournament).toEqual({ slug: "bmsd-2026", name: "BGMI Showdown 2026" });
    expect(scenario!.stage).toEqual({ slug: "grand-finals", name: "Grand Finals" });
    expect(scenario!.match).toMatchObject({ number: 1, mapName: "Erangel" });
    expect(scenario!.results.map((r) => r.teamCanonical)).toEqual(["team-a", "team-b"]);
    expect(scenario!.results[0]).toMatchObject({ placement: 1, finishes: 12, totalPoints: 27 });
    expect(scenario!.source).toMatchObject({ tournamentRevision: 12345, stageRevision: 12344 });
    expect(scenario!.links).toEqual({
      tournamentHref: "/bgmi-tournaments/bmsd-2026",
      stageHref: "/bgmi-tournaments/bmsd-2026/grand-finals",
    });
    expect(scenario!.ref).toEqual({ tournamentSlug: "bmsd-2026", stageSlug: "grand-finals", matchId: "match-1" });
  });

  it("rejects incomplete or unpublished data instead of inventing facts", () => {
    const detail = fixture();
    expect(buildMatchScenario(detail, 2)).toBeNull(); // scheduled
    expect(buildMatchScenario(detail, 3)).toBeNull(); // completed but no map
    expect(buildMatchScenario(detail, 4)).toBeNull(); // completed but no results
    expect(buildMatchScenario(detail, 99)).toBeNull(); // unknown match
  });

  it("lists only scenario-eligible match numbers", () => {
    expect(listScenarioMatchNumbers(fixture())).toEqual([1]);
  });

  it("keeps tournament-derived scenarios distinct from synthetic ones", () => {
    const scenario = buildMatchScenario(fixture(), 1)!;
    expect(scenario.kind).toBe("tournament-derived");
    expect(scenario.kind).not.toBe("synthetic");
    expect(scenario.ref.tournamentSlug.length).toBeGreaterThan(0);
    expect(scenario.ref.stageSlug.length).toBeGreaterThan(0);
    expect(scenario.ref.matchId.length).toBeGreaterThan(0);
  });

  it("exposes result facts only — no intentions, causality, or decisions", () => {
    const scenario = buildMatchScenario(fixture(), 1)!;
    const keys = JSON.stringify(scenario);
    for (const banned of ["intention", "reasoning", "should", "igl", "decision", "cause", "motive"]) {
      expect(keys.toLowerCase()).not.toContain(banned);
    }
    expect(Object.keys(scenario).sort()).toEqual(
      ["kind", "links", "match", "ref", "results", "source", "stage", "tournament"].sort()
    );
  });

  it("imports only read-safe Hub types — no data access, no mutation surface", () => {
    const raw = readFileSync(join(process.cwd(), "src/features/bgmi-lab/data/tournament-scenarios.ts"), "utf8");
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    expect(source).toContain("import type");
    for (const banned of [
      "supabase",
      "createClient",
      "service_role",
      "admin",
      "ingest",
      "INSERT",
      "UPDATE",
      "DELETE",
      ".insert(",
      ".update(",
      ".delete(",
      ".upsert(",
      "billing",
      "entitlement",
    ]) {
      expect(source).not.toContain(banned);
    }
  });
});
