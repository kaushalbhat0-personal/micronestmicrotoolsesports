import { describe, expect, it } from "vitest";
import type { WorkingTeam } from "../types";
import { buildRosterWhatsAppMessage } from "./whatsapp";

function team(index: number, players: number, contact?: string): WorkingTeam {
  return {
    teamKey: `team-${index}`,
    teamDisplay: `Team ${index} Esports`,
    players: Array.from({ length: players }, (_, i) => ({
      rowId: `r-${index}-${i}`,
      lineNumber: i + 1,
      playerDisplay: `Player ${index}-${i}`,
      playerKey: `player-${index}-${i}`,
      ...(contact ? { contactDisplay: contact } : {}),
    })),
  };
}

describe("buildRosterWhatsAppMessage", () => {
  it("generates text from the actual roster with no URL", () => {
    const msg = buildRosterWhatsAppMessage([team(1, 2), team(2, 2)]);
    expect(msg).toContain("Team 1 — Team 1 Esports");
    expect(msg).toContain("1. Player 1-0");
    expect(msg).toContain("Team 2 — Team 2 Esports");
    expect(msg).not.toMatch(/https?:\/\//);
    expect(msg).not.toContain("View online");
  });

  it("never includes contacts", () => {
    const msg = buildRosterWhatsAppMessage([team(1, 2, "+91-98765-43210")]);
    expect(msg).not.toContain("+91-98765-43210");
    expect(msg).not.toContain("98765");
  });

  it("preserves the unresolved warning", () => {
    const msg = buildRosterWhatsAppMessage([team(1, 1)], { unresolvedCount: 2 });
    expect(msg).toContain("2 unresolved issues — review before sharing.");
  });

  it("bounds long rosters with an explicit shortening notice", () => {
    const teams = Array.from({ length: 30 }, (_, i) => team(i + 1, 5));
    const msg = buildRosterWhatsAppMessage(teams, { maxChars: 400 });
    expect(msg.length).toBeLessThanOrEqual(400);
    expect(msg).toContain("… (more teams — full list in CSV/print).");
    expect(msg).not.toMatch(/https?:\/\//);
  });

  it("supports caller-supplied header lines", () => {
    const msg = buildRosterWhatsAppMessage([team(1, 1)], { headerLines: ["City Cup", "12 Oct 2026"] });
    expect(msg.startsWith("City Cup\n12 Oct 2026\n\nTeam 1 — Team 1 Esports")).toBe(true);
  });
});
