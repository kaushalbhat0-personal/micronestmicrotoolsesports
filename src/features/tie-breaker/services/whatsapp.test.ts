import { describe, expect, it } from "vitest";
import type { TieBreakerShareRecord } from "./share";
import { buildTieBreakerWhatsAppMessage } from "./whatsapp";

function record(explanations: number): TieBreakerShareRecord {
  return {
    record_number: "TB-2026-00001",
    competition_name: "Monsoon Cup",
    description: null,
    locked_at: "2026-10-01",
    rule_order: ["points"],
    scoring: { win: 3, draw: 1, loss: 0, draws_enabled: false, round_label: "games" },
    snapshot: {
      standings: [
        { teamId: "a", position: 1, points: 9, wins: 3, draws: 0, losses: 0, mapDiff: 4, roundDiff: 10, tied: false, tiedWith: [] },
        { teamId: "b", position: 2, points: 6, wins: 2, draws: 0, losses: 1, mapDiff: 1, roundDiff: 2, tied: false, tiedWith: [] },
      ],
      explanations: Array.from({ length: explanations }, (_, i) => ({
        scope: "separation" as const,
        teamIds: ["a", "b"],
        summary: `Reason ${i + 1}: Alpha placed above Bravo on points.`,
      })),
      teamNames: { a: "Alpha", b: "Bravo" },
    },
    organization_name: "Acme Org",
    organization_logo_url: null,
  };
}

const URL = "https://example.com/share/tie-breaker/token-123";

describe("buildTieBreakerWhatsAppMessage", () => {
  it("preserves the official result body verbatim with the token URL", () => {
    const msg = buildTieBreakerWhatsAppMessage(record(2), URL);
    expect(msg).toContain("MICRONEST — OFFICIAL RESULT");
    expect(msg).toContain("Monsoon Cup");
    expect(msg).toContain("Record no.: TB-2026-00001");
    expect(msg).toContain("1. Alpha — 9 pts, 3W");
    expect(msg).toContain("2. Bravo — 6 pts, 2W");
    expect(msg).toContain("Reason 1: Alpha placed above Bravo on points.");
    expect(msg).toContain(`View online: ${URL}`);
  });

  it("caps long explanations with an explicit marker, keeping standings and URL", () => {
    const msg = buildTieBreakerWhatsAppMessage(record(8), URL, { maxExplanations: 3 });
    expect(msg).toContain("1. Alpha — 9 pts, 3W");
    expect(msg).toContain("Reason 3: Alpha placed above Bravo on points.");
    expect(msg).not.toContain("Reason 4:");
    expect(msg).toMatch(/… \(5 more reasons — full record at the link\)\./);
    expect(msg).toContain(`View online: ${URL}`);
  });

  it("produces a message only from the locked record — no draft path exists", () => {
    // The composer accepts the locked-record projection (same shape the
    // official copy builder renders) and a public URL; there is no branch
    // that fabricates either.
    const msg = buildTieBreakerWhatsAppMessage(record(1), URL);
    expect(msg).toContain("This is a locked official result and cannot be changed.");
  });
});
