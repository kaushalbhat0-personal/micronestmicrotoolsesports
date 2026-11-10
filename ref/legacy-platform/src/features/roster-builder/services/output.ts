import { type PrintModel, type WorkingTeam } from "../types";

/**
 * Output engine — deterministic copy text, CSV, and print model.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Same input always produces the same output. All values are treated as
 * untrusted pasted text: this layer returns plain strings/data only, never
 * HTML, never markup. The React layer renders values as text nodes.
 *
 * Contact/third-column values are never included in any output by default.
 * No internal ids, no metadata, no timestamps (timestamps would break
 * determinism and leak nothing useful).
 */

export interface CopyTextOptions {
  /**
   * When blocking work remains, the UI passes the count so the copied text
   * carries an explicit banner instead of looking silently clean.
   */
  readonly unresolvedCount?: number | undefined;
}

/**
 * Copy-ready plain text (WhatsApp/Discord-safe):
 *
 *   Team 1 — Alpha Esports
 *   1. Player One
 *   2. Player Two
 *
 *   Team 2 — Bravo Gaming
 *   1. Player Six
 */
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

/**
 * Spreadsheet formula-injection guard (conservative).
 *
 * A cell is neutralized with a leading apostrophe (the standard spreadsheet
 * text-marker, hidden by Excel/Sheets) when its first character is one of
 * `=`, `+`, `-`, `@`, `|`, a tab — or when it starts with a spreadsheet
 * command/DDE-style word (`cmd`, `dde`, `hyperlink`, …), case-insensitive.
 *
 * Ordinary values with these prefixes (`-Rogue`, `-5`, `+Player`,
 * `@Player`) are guarded too: spreadsheet safety takes priority over
 * preserving an unguarded leading character, and the marker stays hidden
 * in Excel/Sheets while remaining visible (and harmless) in plain-text
 * readers. Values are already trimmed upstream, so leading whitespace
 * cannot smuggle a trigger past this check.
 */
const DANGEROUS_COMMAND_RE = /^(cmd|dde|hyperlink|hlink|mscom|msprogid|powershell|shell|mhtml|mshtml|embed|oleobject|package|pbrush)\b/i;

export function needsCsvGuard(value: string): boolean {
  if (value.length === 0) return false;
  const first = value[0] as string;
  if (first === "=" || first === "+" || first === "-" || first === "@" || first === "|" || first === "\t") return true;
  return DANGEROUS_COMMAND_RE.test(value);
}

/** RFC-style quoting plus the formula guard above. */
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

/**
 * Deterministic print data. No browser print code here — the future print
 * UI consumes this model directly, guaranteeing print matches copy output.
 */
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
