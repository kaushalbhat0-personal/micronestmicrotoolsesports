import { describe, expect, it } from "vitest";
import { buildTieBreakerCopyText } from "./share-text";
import type { TieBreakerShareRecord } from "./share";

const record: TieBreakerShareRecord = {
  record_number: "TB-2026-00007",
  competition_name: "Monsoon Cup — Group A",
  description: null,
  locked_at: "2026-10-07T10:00:00.000Z",
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
};

describe("buildTieBreakerCopyText", () => {
  it("builds a shareable official summary", () => {
    const text = buildTieBreakerCopyText(record, "https://example.com/share/tie-breaker/token");
    expect(text).toContain("MICRONEST — OFFICIAL RESULT");
    expect(text).toContain("Monsoon Cup — Group A");
    expect(text).toContain("TB-2026-00007");
    expect(text).toContain("1. Falcons — 6 pts, 2W");
    expect(text).toContain("2. Sentinels — 0 pts, 0W");
    expect(text).toContain("Falcons finished above Sentinels on points (6 vs 0).");
    expect(text).toContain("locked official result");
    expect(text).toContain("https://example.com/share/tie-breaker/token");
  });

  it("marks tied positions and never leaks internals", () => {
    const tied: TieBreakerShareRecord = {
      ...record,
      snapshot: {
        ...record.snapshot,
        standings: record.snapshot.standings.map((e) => ({ ...e, tied: true, tiedWith: ["x"] })),
      },
    };
    const text = buildTieBreakerCopyText(tied, "");
    expect(text).toContain("(tied)");
    for (const banned of ["organization_id", "user_id", "competition_id", "team_id", "share_token", "private_notes", "uuid", "snapshot", "entitlement"]) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });
});
