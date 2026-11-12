import { describe, expect, it } from "vitest";
import {
  MAX_INPUT_CHARS,
  MAX_LINES,
  MAX_PLAYERS,
  MAX_TEAMS,
} from "../types";
import { detectDelimiter, parseRosterText, splitLine } from "./parser";

function ok(text: string, delimiter?: "\t" | "," | ";" | "|") {
  const result = parseRosterText(text, delimiter === undefined ? undefined : { delimiter });
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  return result;
}

describe("splitLine", () => {
  it("splits tab and pipe naively (quotes stay literal)", () => {
    expect(splitLine('Alpha\t“Sniper” Rahul', "\t")).toEqual(["Alpha", "“Sniper” Rahul"]);
    expect(splitLine('a|b|c', "|")).toEqual(["a", "b", "c"]);
  });

  it("honors CSV quoting for comma and semicolon", () => {
    expect(splitLine('"Alpha, Esports",Rahul', ",")).toEqual(["Alpha, Esports", "Rahul"]);
    expect(splitLine('"A;B";C', ";")).toEqual(["A;B", "C"]);
    expect(splitLine('"Say ""hi""",Bob', ",")).toEqual(['Say "hi"', "Bob"]);
  });

  it("falls back to naive split on unbalanced quotes (tags survive)", () => {
    expect(splitLine('Alpha,"Rahul', ",")).toEqual(["Alpha", '"Rahul']);
  });
});

describe("detectDelimiter", () => {
  it("detects tab, comma, semicolon, pipe", () => {
    expect(detectDelimiter(["Alpha\tRahul", "Bravo\tKaran"])).toBe("\t");
    expect(detectDelimiter(["Alpha,Rahul", "Bravo,Karan"])).toBe(",");
    expect(detectDelimiter(["Alpha;Rahul", "Bravo;Karan"])).toBe(";");
    expect(detectDelimiter(["Alpha|Rahul", "Bravo|Karan"])).toBe("|");
  });

  it("defaults to tab for single-column input", () => {
    expect(detectDelimiter(["Alpha", "Bravo"])).toBe("\t");
  });

  it("scores headers with the data (shared field count)", () => {
    expect(detectDelimiter(["Team,Player", "Alpha,Rahul", "Bravo,Karan"])).toBe(",");
  });

  it("resolves ties in fixed candidate order (tab first)", () => {
    expect(detectDelimiter(["just words here"])).toBe("\t");
  });
});

describe("parseRosterText — formats", () => {
  it("parses tab-separated rows with stable ids and keys", () => {
    const result = ok("Alpha Esports\tRahul Patil\nBravo Gaming\tKaran Shah");
    expect(result.delimiter).toBe("\t");
    expect(result.delimiterDetected).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      id: "r1",
      lineNumber: 1,
      teamDisplay: "Alpha Esports",
      playerDisplay: "Rahul Patil",
      teamKey: "alpha esports",
      playerKey: "rahul patil",
      status: "valid",
    });
    expect(result.rows[1]?.id).toBe("r2");
    expect(result.stats).toMatchObject({ dataRows: 2, teams: 2, players: 2 });
  });

  it("parses comma, semicolon, and pipe rows", () => {
    expect(ok("Alpha,Rahul").rows[0]).toMatchObject({ teamDisplay: "Alpha", playerDisplay: "Rahul" });
    expect(ok("Alpha;Rahul").rows[0]).toMatchObject({ teamDisplay: "Alpha", playerDisplay: "Rahul" });
    expect(ok("Alpha|Rahul").rows[0]).toMatchObject({ teamDisplay: "Alpha", playerDisplay: "Rahul" });
  });

  it("handles spreadsheet paste (CRLF) and surrounding whitespace", () => {
    const result = ok("  Alpha Esports \t  Rahul Patil  \r\n\r\nBravo\tKaran  ");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ id: "r1", teamDisplay: "Alpha Esports", playerDisplay: "Rahul Patil" });
    expect(result.rows[1]).toMatchObject({ id: "r3", lineNumber: 3 });
  });

  it("preserves display case while normalizing keys", () => {
    const row = ok("ALPHA\tRAHUL").rows[0];
    expect(row).toMatchObject({ teamDisplay: "ALPHA", playerDisplay: "RAHUL", teamKey: "alpha", playerKey: "rahul" });
  });

  it("keeps the optional third column out of identity", () => {
    const result = ok("Alpha\tRahul\t98765\nAlpha\tRahul\t99999");
    expect(result.rows[0]?.contactDisplay).toBe("98765");
    expect(result.rows[0]?.teamKey).toBe("alpha");
    expect(result.rows).toHaveLength(2);
  });

  it("flags (never stores) a fourth column", () => {
    const row = ok("Alpha\tRahul\t98765\textra").rows[0];
    expect(row?.hasExtraColumns).toBe(true);
    expect(row?.contactDisplay).toBe("98765");
    expect(row?.teamKey).toBe("alpha");
  });

  it("accepts a manual delimiter override", () => {
    const result = ok("Alpha,Rahul", ",");
    expect(result.delimiter).toBe(",");
    expect(result.delimiterDetected).toBe(false);
  });

  it("manual override changes interpretation deterministically", () => {
    // Display collapses the literal tab to a space — the row stays intact
    // and resolvable instead of silently dropping content.
    const forced = ok("Alpha\tRahul", ",");
    expect(forced.rows[0]).toMatchObject({ teamDisplay: "Alpha Rahul", status: "missing-player" });
  });
});

describe("parseRosterText — headers", () => {
  it("skips a leading header row without mapping changes", () => {
    const result = ok("Team,Player\nAlpha,Rahul");
    expect(result.rows).toHaveLength(1);
    expect(result.columnMap).toMatchObject({ teamIndex: 0, playerIndex: 1, fromHeader: true });
  });

  it("skips repeated headers mid-paste", () => {
    const result = ok("Team\tPlayer\nAlpha\tRahul\nTeam\tPlayer\nBravo\tKaran");
    expect(result.rows.map((r) => r.id)).toEqual(["r2", "r4"]);
  });

  it("detects header tokens case-insensitively", () => {
    const result = ok("TEAM NAME,PLAYER NAME\nAlpha,Rahul");
    expect(result.rows).toHaveLength(1);
  });

  it("remaps swapped Player,Team columns from the header", () => {
    const result = ok("Player,Team\nRahul,Alpha");
    expect(result.rows[0]).toMatchObject({ teamDisplay: "Alpha", playerDisplay: "Rahul" });
  });

  it("supports squad/ign vocabulary", () => {
    const result = ok("Squad,IGN\nAlpha,Rahul");
    expect(result.rows[0]).toMatchObject({ teamDisplay: "Alpha", playerDisplay: "Rahul" });
  });

  it("never treats a single-cell line as a header", () => {
    const result = ok("Squad\nAlpha,Rahul");
    expect(result.rows[0]).toMatchObject({ teamDisplay: "Squad", status: "missing-player" });
  });

  it("headers-only input is an empty error, not rows", () => {
    const result = parseRosterText("Team,Player\nTeam,Player");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("empty-input");
  });
});

describe("parseRosterText — missing and malformed", () => {
  it("marks empty team as missing-team", () => {
    expect(ok(",Rahul").rows[0]).toMatchObject({ status: "missing-team", teamKey: "", playerKey: "rahul" });
  });

  it("marks empty player as missing-player", () => {
    expect(ok("Alpha,").rows[0]).toMatchObject({ status: "missing-player", teamKey: "alpha", playerKey: "" });
  });

  it("marks single-column lines as team with missing player", () => {
    expect(ok("Alpha").rows[0]).toMatchObject({ teamDisplay: "Alpha", status: "missing-player" });
  });

  it("marks team-less and player-less lines malformed (one issue, not two)", () => {
    expect(ok(",").rows[0]).toMatchObject({ status: "malformed", teamKey: "", playerKey: "" });
  });

  it("marks overlong lines malformed without rejecting the paste", () => {
    const long = "A".repeat(301);
    const result = ok(`Alpha\tRahul\n${long}\nBravo\tKaran`);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[1]).toMatchObject({ id: "r2", status: "malformed" });
    expect(result.rows[2]).toMatchObject({ status: "valid" });
  });

  it("preserves over-cap names exactly and flags them as a hint", () => {
    const team = "T".repeat(61);
    const player = "P".repeat(41);
    const row = ok(`${team}\t${player}`).rows[0];
    expect(row?.teamDisplay).toBe(team);
    expect(row?.teamDisplay).toHaveLength(61);
    expect(row?.playerDisplay).toBe(player);
    expect(row?.playerDisplay).toHaveLength(41);
    expect(row?.exceedsDisplayCap).toBe(true);
    expect(row?.status).toBe("valid");
  });

  it("normalizes the full value — names differing past the cap stay distinct", () => {
    const a = `Team${"X".repeat(60)}A`;
    const b = `Team${"X".repeat(60)}B`;
    const result = ok(`${a}\tRahul\n${b}\tKaran`);
    expect(result.rows[0]?.teamKey).not.toBe(result.rows[1]?.teamKey);
    expect(result.stats.teams).toBe(2);
  });

  it("does not flag in-cap names", () => {
    const row = ok(`${"T".repeat(60)}\t${"P".repeat(40)}`).rows[0];
    expect(row?.exceedsDisplayCap).toBe(false);
  });
});

describe("parseRosterText — limits (never silently truncate)", () => {
  it("rejects input over the character cap", () => {
    const result = parseRosterText("x".repeat(MAX_INPUT_CHARS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("oversized-input");
      expect(result.error.scope).toBe("characters");
    }
  });

  it("rejects input over the line cap", () => {
    const result = parseRosterText(Array.from({ length: MAX_LINES + 1 }, () => "A\tB").join("\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.scope).toBe("lines");
  });

  it("rejects input over the team cap", () => {
    const lines = Array.from({ length: MAX_TEAMS + 1 }, (_, i) => `Team${i}\tPlayer${i}`);
    const result = parseRosterText(lines.join("\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("oversized-input");
      expect(result.error.scope).toBe("teams");
    }
  });

  it("applies structural caps before semantic caps (lines win over players)", () => {
    // One player per line means 2001 players always exceed the 2000-line cap
    // first. The players cap remains as defense-in-depth if line shapes or
    // limits ever change.
    const lines = Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `Alpha\tPlayer${i}`);
    expect(lines.length).toBeGreaterThan(MAX_LINES);
    const result = parseRosterText(lines.join("\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.scope).toBe("lines");
  });

  it("rejects empty and whitespace-only input", () => {
    for (const text of ["", "   ", "\n\n  \n"]) {
      const result = parseRosterText(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("empty-input");
    }
  });

  it("rejects non-string input without throwing", () => {
    const result = parseRosterText(undefined);
    expect(result.ok).toBe(false);
  });
});

describe("parseRosterText — determinism", () => {
  it("produces identical output on repeated parses", () => {
    const text = "Team,Player\nAlpha,Rahul\nBravo,Karan\nAlpha,Rahul";
    expect(parseRosterText(text)).toEqual(parseRosterText(text));
  });

  it("derives stable row ids from source line numbers", () => {
    const a = ok("Alpha\tRahul\nBravo\tKaran");
    const b = ok("Alpha\tRahul\nBravo\tKaran");
    expect(a.rows.map((r) => r.id)).toEqual(b.rows.map((r) => r.id));
  });
});
