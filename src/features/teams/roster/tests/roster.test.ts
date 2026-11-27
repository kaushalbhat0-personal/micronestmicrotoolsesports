// D1 roster — conflict/output/slot/schema tests (independent coverage).
import { describe, expect, it } from "vitest";
import { parseRosterText } from "../parser";
import { detectConflicts, summarizeIssues } from "../conflicts";
import { assignSlots, buildWorkingModel } from "../slots";
import { buildCopyText, buildCsv, escapeCsvCell, needsCsvGuard } from "../output";
import { parseOptionsSchema, pastedInputSchema, teamCapacitySchema } from "../schemas";

function rows(text: string) {
  const r = parseRosterText(text);
  if (!r.ok) throw new Error("parse failed in test");
  return r.rows;
}

describe("detectConflicts", () => {
  it("reports cross-team conflicts as blocking", () => {
    const found = detectConflicts(rows("Alpha\tRogue\nBravo\tRogue"), { teamCapacity: 5 });
    expect(found.some((i) => i.code === "player-multiple-teams" && i.severity === "blocking")).toBe(true);
  });
  it("reports over-capacity as blocking", () => {
    const found = detectConflicts(rows("Alpha\tA\nAlpha\tB\nAlpha\tC"), { teamCapacity: 2 });
    expect(found.some((i) => i.code === "team-over-capacity")).toBe(true);
  });
  it("never merges duplicates — review only", () => {
    const found = detectConflicts(rows("Alpha\tRogue\nAlpha\tRogue"), { teamCapacity: 5 });
    expect(found.some((i) => i.code === "duplicate-row-exact" && i.severity === "review")).toBe(true);
  });
  it("summarizes deterministically", () => {
    const a = summarizeIssues(detectConflicts(rows("Alpha\tRogue\nBravo\tRogue"), { teamCapacity: 5 }));
    const b = summarizeIssues(detectConflicts(rows("Alpha\tRogue\nBravo\tRogue"), { teamCapacity: 5 }));
    expect(a).toEqual(b);
    expect(a.blocking).toBeGreaterThan(0);
  });
});

describe("slots", () => {
  it("groups first-seen and assigns contiguous slots", () => {
    const model = buildWorkingModel(rows("Bravo\tV\nAlpha\tR\nAlpha\tQ"));
    expect(model.teams.map((t) => t.teamDisplay)).toEqual(["Bravo", "Alpha"]);
    expect(assignSlots(model.teams).map((s) => s.slot)).toEqual([1, 2]);
  });
});

describe("output", () => {
  it("builds copy text and CSV without contacts", () => {
    const model = buildWorkingModel(rows("Alpha\tRogue\t9999\nAlpha\tViper"));
    const copy = buildCopyText(model.teams);
    expect(copy).toContain("Team 1 — Alpha");
    expect(copy).not.toContain("9999");
    const csv = buildCsv(model.teams);
    expect(csv.split("\n")[0]).toBe("Slot,Team,Player");
    expect(csv).not.toContain("9999");
  });
  it("guards spreadsheet formulas", () => {
    expect(needsCsvGuard("=cmd")).toBe(true);
    expect(needsCsvGuard("@Player")).toBe(true);
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });
});

describe("schemas", () => {
  it("validates input and capacity", () => {
    expect(pastedInputSchema.safeParse("Alpha\tRogue").success).toBe(true);
    expect(pastedInputSchema.safeParse("").success).toBe(false);
    expect(teamCapacitySchema.safeParse(5).success).toBe(true);
    expect(teamCapacitySchema.safeParse(99).success).toBe(false);
    expect(parseOptionsSchema.safeParse({ delimiter: "\t" }).success).toBe(true);
    expect(parseOptionsSchema.safeParse({ delimiter: "x" }).success).toBe(false);
  });
});
