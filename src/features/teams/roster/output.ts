// D1 roster intake — output engine (PORT from legacy roster-builder output).
// Legacy: legacy/application/src/features/roster-builder/services/output.ts
// Contact/third-column values are never included in any output by design.
import type { PrintModel, WorkingTeam } from "./types";

export interface CopyTextOptions {
  readonly unresolvedCount?: number | undefined;
}

export function buildCopyText(teams: ReadonlyArray<WorkingTeam>, options?: CopyTextOptions): string {
  const lines: string[] = [];
  const unresolved = options?.unresolvedCount ?? 0;
  if (unresolved > 0) {
    lines.push(
      unresolved === 1
        ? "⚠ 1 unresolved issue — review before sharing."
        : `⚠ ${unresolved} unresolved issues — review before sharing.`,
    );
    lines.push("");
  }
  if (teams.length === 0) {
    lines.push("No teams to show.");
    return lines.join("\n");
  }
  teams.forEach((team, index) => {
    if (index > 0) lines.push("");
    lines.push(`Team ${index + 1} — ${team.teamDisplay}`);
    team.players.forEach((player, playerIndex) => {
      lines.push(`${playerIndex + 1}. ${player.playerDisplay}`);
    });
  });
  return lines.join("\n");
}

const DANGEROUS_COMMAND_RE = /^(cmd|dde|hyperlink|hlink|mscom|msprogid|powershell|shell|mhtml|mshtml|embed|oleobject|package|pbrush)\b/i;

export function needsCsvGuard(value: string): boolean {
  if (value.length === 0) return false;
  const first = value[0] as string;
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "|" || first === "\t") return true;
  return DANGEROUS_COMMAND_RE.test(value);
}

export function escapeCsvCell(value: string): string {
  const guarded = needsCsvGuard(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

/** `Slot,Team,Player` — clean data only, no flags, no contacts. */
export function buildCsv(teams: ReadonlyArray<WorkingTeam>): string {
  const lines: string[] = ["Slot,Team,Player"];
  teams.forEach((team, index) => {
    const slot = String(index + 1);
    team.players.forEach((player) => {
      lines.push(`${slot},${escapeCsvCell(team.teamDisplay)},${escapeCsvCell(player.playerDisplay)}`);
    });
  });
  return lines.join("\n");
}

export function buildPrintModel(teams: ReadonlyArray<WorkingTeam>): PrintModel {
  let totalPlayers = 0;
  const printable = teams.map((team, index) => {
    totalPlayers += team.players.length;
    return {
      slot: index + 1,
      team: team.teamDisplay,
      players: team.players.map((player) => player.playerDisplay),
    };
  });
  return { teams: printable, totalTeams: teams.length, totalPlayers };
}
