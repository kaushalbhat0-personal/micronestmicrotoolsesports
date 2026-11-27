import { describe, expect, it } from "vitest";
import { distributePrizePool } from "@/features/tools/prize-pool/distribution";
import { prizePoolFormSchema, toParsedPrizePool } from "@/features/tools/prize-pool/schema";
import { addPlayer, assignPlayer, createRoster } from "@/features/tools/roster/roster";
import {
  addCriterion,
  addTeam,
  createScenario,
  setScenarioMeta,
  setTeamValue,
} from "@/features/tools/tiebreak/engine";
import { buildPrizeShareSpec } from "./prize-card";
import { buildRosterShareSpec, buildToolsRosterCsv } from "./roster-card";
import { buildTiebreakShareSpec } from "./tiebreak-card";

describe("buildPrizeShareSpec", () => {
  it("includes totals, positions, and planning disclaimer", () => {
    const parsed = prizePoolFormSchema.parse({
      total: "1000",
      currency: "INR",
      rows: [
        { position: "1", mode: "percent", amount: "", percent: "50" },
        { position: "2", mode: "percent", amount: "", percent: "30" },
        { position: "3", mode: "percent", amount: "", percent: "20" },
      ],
    });
    const model = toParsedPrizePool(parsed);
    expect(model).not.toBeNull();
    const distribution = distributePrizePool(model!);
    const spec = buildPrizeShareSpec(distribution, "example.test/tools/prize-pool-splitter");
    expect(spec.tone).toBe("tool");
    expect(spec.disclaimer.toLowerCase()).toContain("planning");
    expect(spec.rows.some((row) => row.label === "Total pool")).toBe(true);
    expect(spec.blocks?.length).toBeGreaterThan(0);
    expect(spec.filenameBase).toContain("prize-pool");
  });
});

describe("buildRosterShareSpec + CSV", () => {
  it("exports honest status and entered players only", () => {
    let state = createRoster({ gameKey: "bgmi", starterSlots: 2, substituteSlots: 0 });
    state = addPlayer(state, {
      displayName: "Alpha",
      playerId: null,
      role: "IGL",
      notes: null,
    });
    const playerId = state.players[0]!.id;
    state = assignPlayer(state, playerId, { kind: "starter", index: 0 });
    const spec = buildRosterShareSpec(state, "example.test/tools/roster-slot-builder");
    expect(spec.rows.find((r) => r.label === "Status")?.value).toBe("Partial");
    expect(spec.rows.find((r) => r.label === "Players")?.value).toMatch(/1 assigned/);
    expect(spec.blocks?.some((line) => line.includes("Alpha"))).toBe(true);
    expect(spec.disclaimer.toLowerCase()).toContain("not an official");

    state = addPlayer(state, {
      displayName: "BenchOnly",
      playerId: null,
      role: null,
      notes: null,
    });
    const withBench = buildRosterShareSpec(state, "example.test/tools/roster-slot-builder");
    expect(withBench.blocks?.some((line) => line.startsWith("Bench:") && line.includes("BenchOnly"))).toBe(
      true,
    );

    const csv = buildToolsRosterCsv(state);
    expect(csv.split("\n")[0]).toBe("Kind,Slot,DisplayName,PlayerId,Role,Notes");
    expect(csv).toContain("Alpha");
    expect(csv).not.toContain("email");
  });
});

describe("buildTiebreakShareSpec", () => {
  it("marks simulation disclaimer and respects ranking fields", () => {
    let scenario = createScenario();
    scenario = setScenarioMeta(scenario, { name: "Practice cup", cutoff: 1 });
    scenario = addCriterion(scenario, {
      name: "WWCD",
      weight: 1,
      direction: "high",
    });
    const criterionId = scenario.criteria[0]!.id;
    scenario = addTeam(scenario, "Team A");
    scenario = addTeam(scenario, "Team B");
    const teamA = scenario.teams[0]!.id;
    scenario = setTeamValue(scenario, teamA, criterionId, 10);

    const spec = buildTiebreakShareSpec(scenario, "example.test/tools/tiebreak-qualifier");
    expect(spec.disclaimer.toLowerCase()).toContain("not an official");
    expect(spec.disclaimer).not.toMatch(/official pmgc result/i);
    expect(spec.blocks?.some((line) => line.includes("Team A"))).toBe(true);
    expect(spec.rows.some((row) => row.label === "Cutoff")).toBe(true);
  });
});
