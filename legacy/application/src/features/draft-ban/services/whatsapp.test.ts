import { describe, expect, it } from "vitest";
import { buildDraftWhatsAppMessage, type DraftWhatsAppAction } from "./whatsapp";

function actions(count: number): DraftWhatsAppAction[] {
  return Array.from({ length: count }, (_, i) => ({
    team: (i % 2 === 0 ? "A" : "B") as "A" | "B",
    type: i % 3 === 0 ? "ban" : "pick",
    item: `Map ${i + 1}`,
  }));
}

const BASE = {
  teamA: "Alpha",
  teamB: "Bravo",
  eventName: "City Cup",
  matchName: "Semifinal 1",
  formatLabel: "BO3",
  refCode: "DB-00042",
  organizationName: "Acme Org",
  completedAt: "12 Oct 2026, 15:00",
  remaining: ["Map 7"],
  publicUrl: "https://example.com/share/draft-ban/token-1",
};

describe("buildDraftWhatsAppMessage", () => {
  it("uses the completed public result with the share URL", () => {
    const msg = buildDraftWhatsAppMessage({ ...BASE, actions: actions(6) });
    expect(msg).toContain("MICRONEST — MATCH DRAFT RECORD");
    expect(msg).toContain("Alpha vs Bravo");
    expect(msg).toContain("Record no.: DB-00042");
    expect(msg).toContain("FINAL SELECTIONS");
    expect(msg).toContain("DECIDER: Map 7");
    expect(msg).toContain("View online: https://example.com/share/draft-ban/token-1");
  });

  it("excludes internal notes — no notes field exists on the input", () => {
    const msg = buildDraftWhatsAppMessage({ ...BASE, actions: actions(4) });
    expect(msg).not.toContain("Notes:");
    expect(JSON.stringify(Object.keys(BASE))).not.toContain("note");
  });

  it("summarizes long action histories with an explicit marker, keeping the URL", () => {
    const msg = buildDraftWhatsAppMessage({ ...BASE, actions: actions(50) });
    expect(msg).toMatch(/…and \d+ more actions \(full record at the link\)\./);
    expect(msg).toContain("FINAL SELECTIONS");
    expect(msg.endsWith("View online: https://example.com/share/draft-ban/token-1")).toBe(true);
  });
});
