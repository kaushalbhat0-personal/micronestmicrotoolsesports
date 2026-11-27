import { describe, expect, it } from "vitest";
import { type ParsedRow, type RosterIssue } from "../types";
import { parseRosterText } from "./parser";
import { detectConflicts, parseErrorToIssue, summarizeIssues } from "./conflicts";

function rows(text: string): ParsedRow[] {
  const result = parseRosterText(text);
  if (!result.ok) throw new Error(`expected ok: ${result.error.message}`);
  return [...result.rows];
}

function codes(issues: ReadonlyArray<RosterIssue>): string[] {
  return issues.map((issue) => issue.code);
}

describe("detectConflicts — clean input", () => {
  it("reports nothing for a clean roster", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\nBravo\tKaran"), { teamCapacity: 5 });
    expect(issues).toEqual([]);
    expect(summarizeIssues(issues)).toEqual({ blocking: 0, review: 0, info: 0, total: 0 });
  });

  it("never mutates the input rows", () => {
    const input = rows("Alpha\tRahul\nAlpha\tRahul");
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    detectConflicts(input, { teamCapacity: 5 });
    expect(input).toEqual(snapshot);
  });
});

describe("detectConflicts — blocking", () => {
  it("flags missing teams with source lines", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\n\tKaran"), { teamCapacity: 5 });
    expect(codes(issues)).toEqual(["missing-team"]);
    expect(issues[0]).toMatchObject({ severity: "blocking", lineNumbers: [2], playerDisplay: "Karan" });
  });

  it("flags missing players with the owning team", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\nBravo\t"), { teamCapacity: 5 });
    expect(codes(issues)).toEqual(["missing-player"]);
    expect(issues[0]).toMatchObject({ severity: "blocking", teamDisplay: "Bravo" });
  });

  it("flags cross-team players as blocking with every team listed", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\nBravo\tRahul\nAlpha\tKaran"), { teamCapacity: 5 });
    const cross = issues.filter((i) => i.code === "player-multiple-teams");
    expect(cross).toHaveLength(1);
    expect(cross[0]).toMatchObject({ severity: "blocking", playerDisplay: "Rahul", count: 2 });
    expect(cross[0]?.teams).toEqual(["Alpha", "Bravo"]);
    expect(cross[0]?.rowIds).toHaveLength(2);
  });

  it("matches cross-team players across spelling variants", () => {
    const issues = detectConflicts(rows("Alpha\tRahul Patil\nBravo\t rahul  patil "), { teamCapacity: 5 });
    expect(codes(issues)).toContain("player-multiple-teams");
  });

  it("flags teams over capacity with count and maximum", () => {
    const issues = detectConflicts(rows("Alpha\tA\nAlpha\tB\nAlpha\tC"), { teamCapacity: 2 });
    const over = issues.filter((i) => i.code === "team-over-capacity");
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ severity: "blocking", teamDisplay: "Alpha", count: 3, limit: 2 });
  });

  it("stays silent exactly at capacity, across capacity values", () => {
    expect(codes(detectConflicts(rows("Alpha\tA\nAlpha\tB"), { teamCapacity: 2 }))).not.toContain("team-over-capacity");
    expect(codes(detectConflicts(rows("Alpha\tA\nAlpha\tB"), { teamCapacity: 1 }))).toContain("team-over-capacity");
    expect(codes(detectConflicts(rows("Alpha\tA"), { teamCapacity: 1 }))).not.toContain("team-over-capacity");
  });

  it("maps oversized parse errors to blocking issues", () => {
    const failure = parseRosterText("x".repeat(50_001));
    if (failure.ok) throw new Error("expected failure");
    const issue = parseErrorToIssue(failure.error);
    expect(issue).toMatchObject({ code: "oversized-input", severity: "blocking" });
  });

  it("maps empty input to no issue (the UI shows its empty state)", () => {
    expect(parseErrorToIssue({ code: "empty-input", message: "empty" })).toBeNull();
  });
});

describe("detectConflicts — review (never auto-merge)", () => {
  it("flags exact duplicate rows without removing them", () => {
    const input = rows("Alpha\tRahul\nAlpha\tRahul");
    const issues = detectConflicts(input, { teamCapacity: 5 });
    expect(codes(issues)).toEqual(["duplicate-row-exact"]);
    expect(issues[0]).toMatchObject({ severity: "review", count: 2, lineNumbers: [1, 2] });
    expect(input).toHaveLength(2);
  });

  it("flags normalized duplicates with variants, keeping every row", () => {
    const dupes = detectConflicts(rows("Alpha\tRahul Patil\nAlpha\t rahul  patil "), { teamCapacity: 5 });
    expect(codes(dupes)).toEqual(["duplicate-player-same-team"]);
    expect(dupes[0]).toMatchObject({ severity: "review", count: 2 });
    expect(dupes[0]?.variants).toHaveLength(2);
  });

  it("emits both exact and normalized issues for mixed repeat groups", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\nAlpha\tRahul\nAlpha\tRAHUL"), { teamCapacity: 5 });
    expect(codes(issues)).toContain("duplicate-row-exact");
    expect(codes(issues)).toContain("duplicate-player-same-team");
  });

  it("never flags similar-but-distinct names", () => {
    const issues = detectConflicts(rows("Alpha\tRahul Patil\nAlpha\tRahul Patill\nBravo\tRahul Pati"), {
      teamCapacity: 5,
    });
    expect(codes(issues)).not.toContain("duplicate-row-exact");
    expect(codes(issues)).not.toContain("duplicate-player-same-team");
    expect(codes(issues)).not.toContain("player-multiple-teams");
  });

  it("never flags distinct punctuation or number variants", () => {
    const issues = detectConflicts(rows("Alpha\tViper-OP\nAlpha\tViper OP\nAlpha\tRogue2\nBravo\tRogue"), {
      teamCapacity: 5,
    });
    expect(issues).toEqual([]);
  });

  it("flags duplicate normalized team names with variants", () => {
    // Displays are whitespace-collapsed, so variants surface the remaining
    // visible difference (here: case). Pure spacing variants render
    // identically and need no variant list.
    const issues = detectConflicts(rows("Alpha Esports\tRahul\nALPHA ESPORTS\tKaran"), { teamCapacity: 5 });
    const dupes = issues.filter((i) => i.code === "duplicate-team-name");
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ severity: "review" });
    expect(dupes[0]?.variants).toEqual(["Alpha Esports", "ALPHA ESPORTS"]);
  });

  it("flags malformed rows for human review", () => {
    // A line with neither team nor player (here: empty comma cells) yields
    // one malformed issue instead of two blocking ones. A whitespace-only
    // line would simply be skipped as blank.
    const issues = detectConflicts(rows("Alpha,Rahul\n,,\nBravo,Karan"), { teamCapacity: 5 });
    expect(codes(issues)).toEqual(["malformed-row"]);
    expect(issues[0]).toMatchObject({ severity: "review", lineNumbers: [2] });
  });
});

describe("detectConflicts — info", () => {
  it("aggregates extra columns into one notice", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\tx\textra\nBravo\tKaran\ty\textra2"), { teamCapacity: 5 });
    const extra = issues.filter((i) => i.code === "extra-columns-ignored");
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({ severity: "info", count: 2, lineNumbers: [1, 2] });
  });

  it("aggregates over-cap names into one notice without altering them", () => {
    const input = rows(`${"T".repeat(61)}\tRahul`);
    const issues = detectConflicts(input, { teamCapacity: 5 });
    expect(codes(issues)).toContain("value-too-long");
    expect(issues.find((i) => i.code === "value-too-long")).toMatchObject({ severity: "info", count: 1 });
    expect(input[0]?.teamDisplay).toHaveLength(61);
  });

  it("detects duplicates on full over-cap values", () => {
    const team = "T".repeat(61);
    const issues = detectConflicts(rows(`${team}\tRahul\n${team}\tRahul`), { teamCapacity: 5 });
    expect(codes(issues)).toContain("duplicate-row-exact");
  });

  it("keeps over-cap cross-team players blocking with full names", () => {
    const player = "P".repeat(41);
    const issues = detectConflicts(rows(`Alpha\t${player}\nBravo\t${player}`), { teamCapacity: 5 });
    const cross = issues.filter((i) => i.code === "player-multiple-teams");
    expect(cross).toHaveLength(1);
    expect(cross[0]?.playerDisplay).toBe(player);
  });
});

describe("detectConflicts — deterministic ordering", () => {
  it("orders blocking before review before info, then by line", () => {
    const text = [
      "Alpha\tRahul", // review exact (lines 1-2)
      "Alpha\tRahul", // review exact (lines 1-2)
      ",Karan", // blocking (line 3)
      "Bravo\t", // blocking (line 4)
      "Charlie\tZed\textra", // info (line 5)
    ].join("\n");
    const issues = detectConflicts(rows(text), { teamCapacity: 5 });
    const severities = issues.map((i) => i.severity);
    const ranked = severities.map((s) => ({ blocking: 0, review: 1, info: 2 })[s]);
    expect([...ranked].sort((a, b) => a - b)).toEqual(ranked);
    expect(issues[0]?.severity).toBe("blocking");
    expect(issues[0]?.lineNumbers).toEqual([3]);
  });

  it("produces identical output on repeated runs", () => {
    const input = rows("Alpha\tRahul\nAlpha\tRahul\nBravo\tRahul\n\tKaran");
    expect(detectConflicts(input, { teamCapacity: 1 })).toEqual(detectConflicts(input, { teamCapacity: 1 }));
  });

  it("summarizes counts for the UI", () => {
    const issues = detectConflicts(rows("Alpha\tRahul\nAlpha\tRahul\n\tKaran\nBravo\tx\textra\textra2"), {
      teamCapacity: 5,
    });
    expect(summarizeIssues(issues)).toMatchObject({ blocking: 1, review: 1, info: 1, total: 3 });
  });
});
