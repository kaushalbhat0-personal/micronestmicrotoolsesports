import { describe, expect, it } from "vitest";
import { parseRosterText } from "./parser";
import { buildWorkingModel } from "./slots";
import {
  buildCopyText,
  buildCsv,
  buildPrintModel,
  escapeCsvCell,
  needsCsvGuard,
} from "./output";
import { type WorkingTeam } from "../types";

function teams(text: string) {
  const result = parseRosterText(text);
  if (!result.ok) throw new Error(`expected ok: ${result.error.message}`);
  return buildWorkingModel(result.rows).teams;
}

describe("buildCopyText", () => {
  it("matches the canonical copy fixture exactly", () => {
    const text = buildCopyText(
      teams("Alpha Esports\tPlayer One\nAlpha Esports\tPlayer Two\nBravo Gaming\tPlayer Six"),
    );
    expect(text).toBe(
      ["Team 1 — Alpha Esports", "1. Player One", "2. Player Two", "", "Team 2 — Bravo Gaming", "1. Player Six"].join(
        "\n",
      ),
    );
  });

  it("orders teams by slot and players by team order", () => {
    const text = buildCopyText(teams("Bravo\tZed\nAlpha\tRahul\nAlpha\tKaran"));
    expect(text.indexOf("Team 1 — Bravo")).toBeLessThan(text.indexOf("Team 2 — Alpha"));
    expect(text.indexOf("1. Rahul")).toBeLessThan(text.indexOf("2. Karan"));
  });

  it("prepends an unresolved banner instead of looking silently clean", () => {
    expect(buildCopyText(teams("Alpha\tRahul"), { unresolvedCount: 1 }).startsWith("⚠ 1 unresolved issue")).toBe(true);
    expect(buildCopyText(teams("Alpha\tRahul"), { unresolvedCount: 3 }).startsWith("⚠ 3 unresolved issues")).toBe(
      true,
    );
    expect(buildCopyText(teams("Alpha\tRahul"), { unresolvedCount: 0 })).not.toContain("⚠");
    expect(buildCopyText(teams("Alpha\tRahul"))).not.toContain("⚠");
  });

  it("renders an explicit empty state for no teams", () => {
    expect(buildCopyText([])).toBe("No teams to show.");
  });

  it("keeps malicious strings inert plain text", () => {
    const text = buildCopyText(teams("Alpha\t<script>alert(1)</script>\nBeta\t<img src=x onerror=alert(1)>"));
    expect(text).toContain("<script>alert(1)</script>");
    expect(text).toContain("<img src=x onerror=alert(1)>");
  });

  it("passes unicode, emoji, and long values through untouched", () => {
    const text = buildCopyText(teams("José FC\tRâhül 🎮\nJosé FC\tViper-OP"));
    expect(text).toContain("José FC");
    expect(text).toContain("Râhül 🎮");
  });

  it("is deterministic", () => {
    const first = buildCopyText(teams("B\t2\nA\t1"));
    expect(buildCopyText(teams("B\t2\nA\t1"))).toBe(first);
  });
});

describe("needsCsvGuard — formula-injection policy", () => {
  it("guards executable prefixes", () => {
    for (const value of ["=HYPERLINK(\"http://evil\",\"x\")", "=1+1", "+1+1", "@SUM(A1:A2)", "@mention", "|pipe", "\tcell"]) {
      expect(needsCsvGuard(value)).toBe(true);
    }
  });

  it("guards spreadsheet command/DDE words case-insensitively", () => {
    for (const value of ["cmd|' /c calc'!A1", "DDE Excel", "Hyperlink http://x", "powershell foo"]) {
      expect(needsCsvGuard(value)).toBe(true);
    }
  });

  it("guards every executable prefix from the safety policy", () => {
    // Regression battery: no pasted roster name may become executable
    // spreadsheet content when the CSV is opened.
    for (const value of [
      "=1+1",
      "+cmd|' /c calc'!A1",
      "-cmd|' /c calc'!A1",
      "@SUM(A1:A2)",
      "\t=1+1",
      "|cmd|' /c calc'!A1",
      "cmd|' /c calc'!A1",
      "dde|http://evil!A1",
      "hyperlink|http://evil!A1",
    ]) {
      expect(needsCsvGuard(value)).toBe(true);
    }
  });

  it("conservatively guards ordinary-looking values with trigger prefixes", () => {
    // Spreadsheet safety wins over preserving an unguarded leading
    // character; the apostrophe marker stays hidden in Excel/Sheets.
    for (const value of ["-Rogue", "-5", "+Player", "@Player", "@mention"]) {
      expect(needsCsvGuard(value)).toBe(true);
    }
    for (const value of ["Rahul", "2fast", "cmdr", "a@b", "Player-1"]) {
      expect(needsCsvGuard(value)).toBe(false);
    }
    expect(needsCsvGuard("")).toBe(false);
  });
});

describe("escapeCsvCell / buildCsv", () => {
  it("quotes commas, quotes, and newlines RFC-style", () => {
    expect(escapeCsvCell("Alpha, Esports")).toBe('"Alpha, Esports"');
    expect(escapeCsvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
    expect(escapeCsvCell("plain")).toBe("plain");
  });

  it("neutralizes formulas with the hidden text-marker", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });

  it("guards leading-dash and trigger-prefix names with the text-marker", () => {
    expect(escapeCsvCell("-Rogue")).toBe("'-Rogue");
    expect(escapeCsvCell("-5")).toBe("'-5");
    expect(escapeCsvCell("+Player")).toBe("'+Player");
    expect(escapeCsvCell("@Player")).toBe("'@Player");
  });

  it("builds Slot,Team,Player rows with no contacts", () => {
    const csv = buildCsv(teams("Alpha\tRahul\t98765\nBravo\tKaran"));
    expect(csv).toBe(["Slot,Team,Player", "1,Alpha,Rahul", "2,Bravo,Karan"].join("\n"));
    expect(csv).not.toContain("98765");
  });

  it("keeps hostile cells inert in CSV form", () => {
    const csv = buildCsv(teams("Alpha\t=HYPERLINK(\"http://e\",\"x\")\nBravo\t-cmd|' /c calc'!A1"));
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'-cmd|");
    expect(csv).not.toContain("\n=HYPERLINK");
    expect(csv).not.toContain("\n-cmd|");
  });

  it("emits full over-cap names in copy text and CSV (no hidden truncation)", () => {
    const team = "T".repeat(61);
    const player = "P".repeat(41);
    const list = teams(`${team}\t${player}`);
    const text = buildCopyText(list);
    expect(text).toContain(team);
    expect(text).toContain(player);
    expect(text).toContain(`Team 1 — ${team}`);
    expect(text).toContain(`1. ${player}`);
    const csv = buildCsv(list);
    expect(csv).toContain(`1,${team},${player}`);
  });
});

describe("buildPrintModel", () => {
  it("mirrors copy output structure with totals", () => {
    const model = buildPrintModel(teams("Bravo\tZed\nAlpha\tRahul\nAlpha\tKaran"));
    expect(model).toEqual({
      teams: [
        { slot: 1, team: "Bravo", players: ["Zed"] },
        { slot: 2, team: "Alpha", players: ["Rahul", "Karan"] },
      ],
      totalTeams: 2,
      totalPlayers: 3,
    });
  });

  it("agrees with copy-text ordering", () => {
    const list = teams("B\t2\nA\t1");
    const model = buildPrintModel(list);
    const text = buildCopyText(list);
    model.teams.forEach((team) => {
      expect(text).toContain(`Team ${team.slot} — ${team.team}`);
    });
  });

  it("contains no ids, contacts, or timestamps", () => {
    const model = buildPrintModel(teams("Alpha\tRahul\t98765"));
    expect(JSON.stringify(model)).not.toContain("98765");
    expect(JSON.stringify(model)).not.toContain("r1");
  });
});

describe("output purity", () => {
  it("never emits HTML or markup wrappers", () => {
    const listed: WorkingTeam[] = [];
    expect(buildCopyText(listed)).not.toMatch(/<[^>]+>/);
    expect(buildCsv(listed)).toBe("Slot,Team,Player");
  });
});
