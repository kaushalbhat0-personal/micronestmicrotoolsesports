import { describe, expect, it } from "vitest";
import { competitionSchema, resultSchema, ruleOrderSchema, scoringSchema, teamSchema } from "./index";

const scoring = { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" as const };

describe("tie-breaker schemas", () => {
  it("accepts a valid competition", () => {
    const parsed = competitionSchema.safeParse({
      name: "Monsoon Cup — Group A",
      description: null,
      scoring,
      ruleOrder: ["points", "h2h", "map_diff"],
      presetRef: "round_robin",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects scoring outside 0–10 and decimals", () => {
    expect(scoringSchema.safeParse({ ...scoring, win: 11 }).success).toBe(false);
    expect(scoringSchema.safeParse({ ...scoring, loss: -1 }).success).toBe(false);
    expect(scoringSchema.safeParse({ ...scoring, draw: 1.5 }).success).toBe(false);
  });

  it("rejects duplicate rules, too few rules, missing points, and unknown rules", () => {
    expect(ruleOrderSchema.safeParse(["points", "points"]).success).toBe(false);
    expect(ruleOrderSchema.safeParse(["points"]).success).toBe(false);
    expect(ruleOrderSchema.safeParse(["h2h", "wins"]).success).toBe(false);
    expect(ruleOrderSchema.safeParse(["points", "nope"]).success).toBe(false);
    expect(ruleOrderSchema.safeParse(["points", "h2h", "map_diff", "round_diff", "wins", "points"]).success).toBe(false);
  });

  it("enforces team name constraints and HTTPS logos", () => {
    expect(teamSchema.safeParse({ name: "", shortName: null, logoUrl: null }).success).toBe(false);
    expect(teamSchema.safeParse({ name: "x".repeat(61), shortName: null, logoUrl: null }).success).toBe(false);
    expect(
      teamSchema.safeParse({ name: "Falcons", shortName: null, logoUrl: "http://example.com/l.png" }).success,
    ).toBe(false);
    expect(
      teamSchema.safeParse({ name: "Falcons", shortName: null, logoUrl: "https://example.com/l.png" }).success,
    ).toBe(true);
  });

  it("rejects self-pairing, draws when disabled, and inconsistent winners", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: a, winnerTeamId: a, isDraw: false, drawsEnabled: false }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: null, isDraw: true, drawsEnabled: false }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: a, isDraw: false, mapsA: 0, mapsB: 2, drawsEnabled: false }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: a, isDraw: false, drawsEnabled: false }).success,
    ).toBe(true);
  });

  it("allows winnerless results as incomplete (excluded from standings until completed)", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    const parsed = resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: null, isDraw: false, drawsEnabled: false });
    expect(parsed.success).toBe(true);
  });

  it("rejects negative scores and over-long notes", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: a, isDraw: false, mapsA: -1, drawsEnabled: false }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ teamAId: a, teamBId: b, winnerTeamId: a, isDraw: false, notes: "x".repeat(501), drawsEnabled: false }).success,
    ).toBe(false);
  });
});
