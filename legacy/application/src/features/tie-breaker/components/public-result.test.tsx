import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PublicResult, toPublicSnapshot } from "./public-result";
import type { TieBreakerShareRecord } from "../services/share";

const LONG_NAME = "Team With An Extremely Long Name That Must Still Wrap Readably On Small Screens United";

function record(overrides: Partial<TieBreakerShareRecord> = {}): TieBreakerShareRecord {
  return {
    record_number: "TB-2026-00007",
    competition_name: "Monsoon Cup — Group A",
    description: "Round-robin, top 2 qualify",
    locked_at: "2026-10-17T13:12:00.000Z",
    rule_order: ["points", "h2h", "map_diff"],
    scoring: { win: 3, draw: 1, loss: 0, draws_enabled: false, round_label: "rounds" },
    snapshot: {
      standings: [
        { teamId: "a", position: 1, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 3, roundDiff: 0, decisiveRule: "points", tied: false, tiedWith: [] },
        { teamId: "b", position: 2, points: 0, wins: 0, draws: 0, losses: 2, mapDiff: -3, roundDiff: 0, tied: false, tiedWith: [] },
      ],
      explanations: [
        { scope: "separation", teamIds: ["a", "b"], decisiveRule: "points", summary: "Falcons finished above Sentinels on points (6 vs 0)." },
      ],
      teamNames: { a: "Falcons", b: "Sentinels" },
    },
    organization_name: "Acme Esports",
    organization_logo_url: null,
    ...overrides,
  };
}

describe("PublicResult", () => {
  it("renders a valid locked result with status, record, timestamp, and standings", () => {
    const html = renderToString(<PublicResult record={record()} publicUrl="https://example.com/share/tie-breaker/t" />);
    expect(html).toContain("Published official result");
    expect(html).toContain("Official result");
    expect(html).toContain("Monsoon Cup — Group A");
    expect(html).toContain("TB-2026-00007");
    expect(html).toContain("Acme Esports");
    expect(html).toContain("Falcons");
    expect(html).toContain("Sentinels");
    expect(html).toContain("6 vs 0");
    expect(html).toContain("Locked");
    expect(html).toContain("Copy result");
    expect(html).toContain("Print / Save PDF");
  });

  it("represents unresolved ties explicitly without inventing an order", () => {
    const html = renderToString(
      <PublicResult
        record={{
          ...record(),
          snapshot: {
            standings: [
              { teamId: "a", position: 1, points: 3, wins: 1, draws: 0, losses: 1, mapDiff: 0, roundDiff: 0, tied: true, tiedWith: ["b"] },
              { teamId: "b", position: 2, points: 3, wins: 1, draws: 0, losses: 1, mapDiff: 0, roundDiff: 0, tied: true, tiedWith: ["a"] },
            ],
            explanations: [
              { scope: "unresolved", teamIds: ["a", "b"], summary: "Falcons and Sentinels could not be separated by the selected ranking rules." },
            ],
            teamNames: { a: "Falcons", b: "Sentinels" },
          },
        }}
        publicUrl=""
      />,
    );
    expect(html).toContain("Tie remains unresolved");
    expect(html).toContain("could not be separated");
    expect(html).toContain("(tied)");
  });

  it("renders long team names safely", () => {
    const html = renderToString(
      <PublicResult
        record={{
          ...record(),
          snapshot: {
            standings: [
              { teamId: "a", position: 1, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 0, roundDiff: 0, tied: false, tiedWith: [] },
            ],
            explanations: [],
            teamNames: { a: LONG_NAME },
          },
        }}
        publicUrl=""
      />,
    );
    expect(html).toContain(LONG_NAME);
  });

  it("never renders private notes or internal identifiers", () => {
    const html = renderToString(<PublicResult record={record()} publicUrl="" />);
    const lower = html.toLowerCase();
    for (const banned of ["organization_id", "user_id", "competition_id", "share_token", "private_notes", "created_by", "notes"]) {
      expect(lower).not.toContain(banned);
    }
    expect(html).not.toContain("Immutable");
    expect(html).not.toContain("snapshot");
    expect(html).not.toContain("UUID");
  });

  it("maps the share projection to the snapshot view without recalculation", () => {
    const snapshot = toPublicSnapshot(record());
    expect(snapshot.competitionName).toBe("Monsoon Cup — Group A");
    expect(snapshot.recordNumber).toBe("TB-2026-00007");
    expect(snapshot.scoring).toEqual({ win: 3, draw: 1, loss: 0, drawsEnabled: false, roundLabel: "rounds" });
    expect(snapshot.standings).toHaveLength(2);
    expect(snapshot.explanations[0]?.summary).toContain("6 vs 0");
    expect(JSON.stringify(snapshot)).not.toContain("draws_enabled");
  });

  it("exposes the official record block with platform-timezone timestamp", () => {
    const html = renderToString(<PublicResult record={record()} publicUrl="" />);
    expect(html).toContain("Official record");
    expect(html).toMatch(/IST|GMT\+5:30/i);
  });
});
