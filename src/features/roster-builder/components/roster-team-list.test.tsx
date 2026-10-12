import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { RosterTeamList } from "./roster-team-list";
import { parseRosterText } from "../services/parser";
import { buildWorkingModel } from "../services/slots";

function modelProps(text: string) {
  const parsed = parseRosterText(text);
  if (!parsed.ok) throw new Error("fixture must parse");
  return buildWorkingModel(parsed.rows).teams;
}

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

function render(text: string) {
  return rendered(
    <RosterTeamList
      teams={modelProps(text)}
      removed={[]}
      capacity={5}
      onMoveTeamUp={() => undefined}
      onMoveTeamDown={() => undefined}
      onMovePlayerUp={() => undefined}
      onMovePlayerDown={() => undefined}
      onAddTeam={() => true}
      onRemoveTeam={() => undefined}
      onRestoreTeam={() => undefined}
    />,
  );
}

describe("RosterTeamList", () => {
  it("renders slot numbers, names, counts, and labelled move controls", () => {
    const html = render("Bravo\tKaran\nAlpha\tRahul\nAlpha\tZed");
    expect(html).toContain("Bravo");
    expect(html).toContain("1/5");
    expect(html).toContain("2/5");
    expect(html).toContain('aria-label="Move Bravo up"');
    expect(html).toContain('aria-label="Move Rahul down"');
    expect(html).toContain("Add a team");
    expect(html).toContain("Remove");
  });

  it("flags over-capacity teams with text, not color alone", () => {
    const html = rendered(      <RosterTeamList
        teams={modelProps("Alpha\tA\nAlpha\tB\nAlpha\tC")}
        removed={[]}
        capacity={2}
        onMoveTeamUp={() => undefined}
        onMoveTeamDown={() => undefined}
        onMovePlayerUp={() => undefined}
        onMovePlayerDown={() => undefined}
        onAddTeam={() => true}
        onRemoveTeam={() => undefined}
        onRestoreTeam={() => undefined}
      />,
    );
    expect(html).toContain("Over capacity");
    expect(html).toContain("3/2");
  });

  it("renders removed teams with their players and a restore path", () => {
    const parsed = parseRosterText("Alpha\tRahul\nBravo\tKaran");
    if (!parsed.ok) throw new Error("fixture must parse");
    const model = buildWorkingModel(parsed.rows);
    const html = rendered(      <RosterTeamList
        teams={model.teams.filter((t) => t.teamKey === "bravo")}
        removed={[{ teamKey: "alpha", teamDisplay: "Alpha", players: model.teams[0]?.players ?? [] }]}
        capacity={5}
        onMoveTeamUp={() => undefined}
        onMoveTeamDown={() => undefined}
        onMovePlayerUp={() => undefined}
        onMovePlayerDown={() => undefined}
        onAddTeam={() => true}
        onRemoveTeam={() => undefined}
        onRestoreTeam={() => undefined}
      />,
    );
    expect(html).toContain("Removed teams");
    expect(html).toContain("Restore");
    expect(html).toContain('aria-label="Restore Alpha"');
  });

  it("keeps long names intact and wrappable (no truncation)", () => {
    const long = `Team ${"X".repeat(80)}`;
    const html = render(`${long}\tRahul`);
    expect(html).toContain(long);
    expect(html).toContain("break-words");
    expect(html).not.toContain("truncate");
  });

  it("wires add-team errors without server calls", () => {
    const onAddTeam = vi.fn(() => false);
    const html = rendered(      <RosterTeamList
        teams={modelProps("Alpha\tRahul")}
        removed={[]}
        capacity={5}
        onMoveTeamUp={() => undefined}
        onMoveTeamDown={() => undefined}
        onMovePlayerUp={() => undefined}
        onMovePlayerDown={() => undefined}
        onAddTeam={onAddTeam}
        onRemoveTeam={() => undefined}
        onRestoreTeam={() => undefined}
      />,
    );
    expect(html).toContain('id="roster-new-team"');
    expect(onAddTeam).not.toHaveBeenCalled();
  });
});
