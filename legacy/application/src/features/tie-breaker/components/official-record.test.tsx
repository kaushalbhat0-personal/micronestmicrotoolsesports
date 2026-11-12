import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { OfficialRecord } from "./official-record";
import type { LockSnapshot } from "../types";

const snapshot: LockSnapshot = {
  competitionName: "Monsoon Cup — Group A",
  description: "Round-robin, top 2 qualify",
  recordNumber: "TB-2026-00001",
  lockedAt: "2026-10-07T10:00:00.000Z",
  ruleOrder: ["points", "h2h", "map_diff"],
  scoring: { win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" },
  standings: [
    { teamId: "a", position: 1, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 3, roundDiff: 0, decisiveRule: "points", tied: false, tiedWith: [] },
    { teamId: "b", position: 2, points: 3, wins: 1, draws: 0, losses: 1, mapDiff: 0, roundDiff: 0, tied: false, tiedWith: [] },
  ],
  explanations: [
    { scope: "separation", teamIds: ["a", "b"], checkedRules: [], decisiveRule: "points", summary: "Falcons finished above Sentinels on points (6 vs 3)." },
  ],
  teamNames: { a: "Falcons", b: "Sentinels" },
  organizationName: "Acme Esports",
};

describe("OfficialRecord", () => {
  it("shows the official result with record number and standings", () => {
    const html = renderToString(
      <OfficialRecord
        recordNumber="TB-2026-00001"
        lockedAt="2026-10-07T10:00:00.000Z"
        snapshot={snapshot}
        teamNames={{ a: "Falcons", b: "Sentinels" }}
      />,
    );
    expect(html).toContain("Official result");
    expect(html).toContain("TB-2026-00001");
    expect(html).toContain("Falcons");
    expect(html).toContain("Acme Esports");
    expect(html).toContain("locked and cannot be changed");
    expect(html).toContain("6 vs 3");
  });

  it("marks tied teams explicitly", () => {
    const tied: LockSnapshot = {
      ...snapshot,
      standings: snapshot.standings.map((e) => ({ ...e, tied: true, tiedWith: ["other"] })),
    };
    const html = renderToString(
      <OfficialRecord recordNumber="TB-2026-00001" lockedAt={null} snapshot={tied} teamNames={{ a: "Falcons", b: "Sentinels" }} />,
    );
    expect(html).toContain("(tied)");
  });
});
