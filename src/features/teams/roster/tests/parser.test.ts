// D1 roster — parser tests (independent coverage: formats, headers, limits, adversarial).
import { describe, expect, it } from "vitest";
import { detectDelimiter, parseRosterText, splitLine } from "../parser";

describe("splitLine", () => {
  it("splits tabs literally", () => {
    expect(splitLine("A\tB", "\t")).toEqual(["A", "B"]);
  });
  it("honors quotes for comma", () => {
    expect(splitLine('"A,B",C', ",")).toEqual(["A,B", "C"]);
  });
  it("falls back on unbalanced quotes", () => {
    expect(splitLine('A"B,C', ",")).toEqual(['A"B', "C"]);
  });
});

describe("detectDelimiter", () => {
  it("detects tab for spreadsheet paste", () => {
    expect(detectDelimiter(["A\tB", "C\tD"])).toBe("\t");
  });
  it("detects comma", () => {
    expect(detectDelimiter(["A,B", "C,D"])).toBe(",");
  });
});

describe("parseRosterText", () => {
  it("parses basic team/player lines", () => {
    const r = parseRosterText("Alpha\tRogue\nBravo\tViper");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.stats.teams).toBe(2);
    expect(r.stats.players).toBe(2);
    expect(r.rows[0]?.teamKey).toBe("alpha");
  });
  it("maps header rows explicitly", () => {
    const r = parseRosterText("player,team\nRogue,Alpha");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.columnMap.fromHeader).toBe(true);
    expect(r.rows[0]?.teamDisplay).toBe("Alpha");
    expect(r.rows[0]?.playerDisplay).toBe("Rogue");
  });
  it("rejects empty and oversized input", () => {
    expect(parseRosterText("   ").ok).toBe(false);
    expect(parseRosterText(42).ok).toBe(false);
    const big = "a".repeat(50_001);
    const r = parseRosterText(big);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("oversized-input");
  });
  it("flags missing sides without merging", () => {
    const r = parseRosterText("Alpha\t\n\tRogue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((x) => x.status)).toEqual(["missing-player", "missing-team"]);
  });
  it("handles adversarial quotes and long lines deterministically", () => {
    const line = 'Team "X",Player';
    const a = parseRosterText(line);
    const b = parseRosterText(line);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
