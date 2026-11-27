import {
  DELIMITERS,
  MAX_CONTACT_LENGTH,
  MAX_INPUT_CHARS,
  MAX_LINES,
  MAX_LINE_LENGTH,
  MAX_PLAYERS,
  MAX_PLAYER_NAME_LENGTH,
  MAX_TEAMS,
  MAX_TEAM_NAME_LENGTH,
  type Delimiter,
  type ParseColumnMap,
  type ParsedRow,
  type ParseResult,
} from "../types";
import { displayName, normalizeIdentity } from "./normalize";

/**
 * Parser — pasted registration text into structured rows.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Same input always produces the same output.
 *
 * Contract: `team` = column 0, `player` = column 1, optional
 * `contact/identifier` = column 2 — unless a recognized header row maps the
 * columns explicitly. A 4th+ column is ignored by design (flagged, never
 * part of identity). Single-column lines carry a team with a missing player.
 * Quoting (`"..."`) is honored for comma/semicolon (CSV convention) and
 * treated literally for tab/pipe; an unbalanced quote falls back to a
 * naive split so gamer tags containing `"` are never mangled.
 */

export interface ParseRequestOptions {
  /** Force a delimiter. When omitted, the delimiter is auto-detected. */
  readonly delimiter?: Delimiter | undefined;
}

const TEAM_TOKENS: ReadonlySet<string> = new Set([
  "team",
  "team name",
  "teamname",
  "squad",
  "squad name",
  "org",
  "organisation",
  "organization",
  "club",
]);

const PLAYER_TOKENS: ReadonlySet<string> = new Set([
  "player",
  "player name",
  "playername",
  "ign",
  "in-game name",
  "ingamename",
  "gamer",
  "gamertag",
  "game tag",
  "username",
  "user name",
  "name",
  "nickname",
  "nick",
]);

const CONTACT_TOKENS: ReadonlySet<string> = new Set([
  "contact",
  "phone",
  "mobile",
  "number",
  "email",
  "mail",
  "id",
  "identifier",
  "discord",
  "whatsapp",
]);

function headerTokenRole(cell: string): "team" | "player" | "contact" | null {
  const key = cell.trim().toLowerCase();
  if (TEAM_TOKENS.has(key)) return "team";
  if (PLAYER_TOKENS.has(key)) return "player";
  if (CONTACT_TOKENS.has(key)) return "contact";
  return null;
}

/**
 * A header row has 2+ cells, every non-empty cell is a known header token,
 * and at least one team/player token is present. Single-cell lines are
 * never headers (a team literally named "Squad" must survive).
 */
export function looksLikeHeader(cells: ReadonlyArray<string>): boolean {
  if (cells.length < 2) return false;
  let meaningful = false;
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (trimmed === "") continue;
    const role = headerTokenRole(trimmed);
    if (role === null) return false;
    if (role === "team" || role === "player") meaningful = true;
  }
  return meaningful;
}

function cellAt(cells: ReadonlyArray<string>, index: number): string {
  const cell = cells[index];
  return typeof cell === "string" ? cell : "";
}

/**
 * Split one line on a delimiter. Quote-aware for comma/semicolon only.
 * Falls back to a naive split when quotes are unbalanced.
 */
export function splitLine(line: string, delimiter: Delimiter): string[] {
  if (delimiter !== "," && delimiter !== ";") return line.split(delimiter);
  let quoteCount = 0;
  for (const ch of line) if (ch === '"') quoteCount++;
  if (quoteCount % 2 === 1) return line.split(delimiter);
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '"') {
      const next: string | undefined = line[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Deterministic delimiter detection over at most the first 20 non-empty
 * lines (headers included — they share the data's field count, and
 * excluding them per-candidate mis-detects headers-only pastes).
 * Scores = (lines with 2+ fields) then consistency (largest same-field-count
 * group). Ties resolve in fixed candidate order: tab, comma, semicolon,
 * pipe — spreadsheet paste wins by default.
 */
export function detectDelimiter(lines: ReadonlyArray<string>): Delimiter {
  const sample: string[] = [];
  for (const line of lines) {
    if (line.trim() !== "") sample.push(line);
    if (sample.length >= 20) break;
  }
  let best: Delimiter = "\t";
  let bestScore = -1;
  for (const candidate of DELIMITERS) {
    const groups = new Map<number, number>();
    let multi = 0;
    for (const line of sample) {
      const count = splitLine(line, candidate).length;
      groups.set(count, (groups.get(count) ?? 0) + 1);
      if (count >= 2) multi++;
    }
    let consistency = 0;
    for (const size of groups.values()) if (size > consistency) consistency = size;
    const score = multi * 1000 + consistency;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

export function parseRosterText(text: unknown, options?: ParseRequestOptions): ParseResult {
  if (typeof text !== "string") {
    return { ok: false, error: { code: "empty-input", message: "Paste registrations as text to clean a roster." } };
  }
  if (text.length > MAX_INPUT_CHARS) {
    return {
      ok: false,
      error: {
        code: "oversized-input",
        scope: "characters",
        actual: text.length,
        limit: MAX_INPUT_CHARS,
        message: `Pasted input is too large (${text.length.toLocaleString("en-IN")} characters, maximum ${MAX_INPUT_CHARS.toLocaleString("en-IN")}). Split it into smaller batches.`,
      },
    };
  }
  const rawLines = text.split("\n");
  if (rawLines.length > MAX_LINES) {
    return {
      ok: false,
      error: {
        code: "oversized-input",
        scope: "lines",
        actual: rawLines.length,
        limit: MAX_LINES,
        message: `Too many lines (${rawLines.length.toLocaleString("en-IN")}, maximum ${MAX_LINES.toLocaleString("en-IN")}). Split it into smaller batches.`,
      },
    };
  }
  if (text.trim() === "") {
    return { ok: false, error: { code: "empty-input", message: "Paste at least one registration line to clean a roster." } };
  }

  const forced = options?.delimiter;
  const probeDelimiter: Delimiter = forced !== undefined && (DELIMITERS as ReadonlyArray<string>).includes(forced) ? forced : detectDelimiter(rawLines);
  const delimiterDetected = forced === undefined || !(DELIMITERS as ReadonlyArray<string>).includes(forced as string);

  let columnMap: ParseColumnMap = { teamIndex: 0, playerIndex: 1, contactIndex: 2, fromHeader: false };
  const rows: ParsedRow[] = [];

  for (let index = 0; index < rawLines.length; index++) {
    const lineNumber = index + 1;
    const shown = (rawLines[index] as string).replace(/\r$/, "");
    if (shown.trim() === "") continue;
    const id = `r${lineNumber}`;
    const raw = shown.length > MAX_LINE_LENGTH + 50 ? `${shown.slice(0, MAX_LINE_LENGTH + 50)}…` : shown;

    if (shown.length > MAX_LINE_LENGTH) {
      rows.push({
        id,
        lineNumber,
        teamDisplay: "",
        playerDisplay: "",
        teamKey: "",
        playerKey: "",
        status: "malformed",
        hasExtraColumns: false,
        exceedsDisplayCap: false,
        raw,
      });
      continue;
    }

    const cells = splitLine(shown, probeDelimiter);
    if (looksLikeHeader(cells)) {
      if (!columnMap.fromHeader) {
        let teamIndex = 0;
        let playerIndex = 1;
        let contactIndex = 2;
        let teamFound = false;
        let playerFound = false;
        let contactFound = false;
        for (let i = 0; i < cells.length; i++) {
          const role = headerTokenRole((cells[i] as string).trim());
          if (role === "team" && !teamFound) {
            teamIndex = i;
            teamFound = true;
          } else if (role === "player" && !playerFound) {
            playerIndex = i;
            playerFound = true;
          } else if (role === "contact" && !contactFound) {
            contactIndex = i;
            contactFound = true;
          }
        }
        columnMap = { teamIndex, playerIndex, contactIndex, fromHeader: true };
      }
      continue;
    }

    // Full values are preserved end to end — never truncated. Over-cap
    // names keep their complete display text and comparison keys; the
    // `exceedsDisplayCap` hint lets the UI wrap them instead.
    const teamDisplay = displayName(cellAt(cells, columnMap.teamIndex));
    const playerDisplay = displayName(cellAt(cells, columnMap.playerIndex));
    const contactFull = displayName(cellAt(cells, columnMap.contactIndex));
    const hasExtraColumns = cells.length > 3;
    const exceedsDisplayCap =
      teamDisplay.length > MAX_TEAM_NAME_LENGTH ||
      playerDisplay.length > MAX_PLAYER_NAME_LENGTH ||
      contactFull.length > MAX_CONTACT_LENGTH;

    const contactDisplay = contactFull === "" ? undefined : contactFull;
    const teamKey = teamDisplay === "" ? "" : normalizeIdentity(teamDisplay);
    const playerKey = playerDisplay === "" ? "" : normalizeIdentity(playerDisplay);

    // A line with neither team nor player carries no registration — one
    // malformed issue instead of two blocking ones.
    const status = teamDisplay === "" && playerDisplay === "" ? "malformed" : teamDisplay === "" ? "missing-team" : playerDisplay === "" ? "missing-player" : "valid";

    rows.push({
      id,
      lineNumber,
      teamDisplay,
      playerDisplay,
      ...(contactDisplay === undefined ? {} : { contactDisplay }),
      teamKey,
      playerKey,
      status,
      hasExtraColumns,
      exceedsDisplayCap,
      raw,
    });
  }

  if (rows.length === 0) {
    return { ok: false, error: { code: "empty-input", message: "No registration rows found — paste at least one team and player." } };
  }

  const teamKeys = new Set<string>();
  let playerCount = 0;
  for (const row of rows) {
    if (row.teamKey !== "") teamKeys.add(row.teamKey);
    if (row.playerKey !== "") playerCount++;
  }
  if (teamKeys.size > MAX_TEAMS) {
    return {
      ok: false,
      error: {
        code: "oversized-input",
        scope: "teams",
        actual: teamKeys.size,
        limit: MAX_TEAMS,
        message: `Too many teams (${teamKeys.size}, maximum ${MAX_TEAMS}). Split it into smaller batches.`,
      },
    };
  }
  if (playerCount > MAX_PLAYERS) {
    return {
      ok: false,
      error: {
        code: "oversized-input",
        scope: "players",
        actual: playerCount,
        limit: MAX_PLAYERS,
        message: `Too many players (${playerCount.toLocaleString("en-IN")}, maximum ${MAX_PLAYERS.toLocaleString("en-IN")}). Split it into smaller batches.`,
      },
    };
  }

  return {
    ok: true,
    rows,
    delimiter: probeDelimiter,
    delimiterDetected,
    columnMap,
    stats: { dataRows: rows.length, teams: teamKeys.size, players: playerCount },
  };
}
