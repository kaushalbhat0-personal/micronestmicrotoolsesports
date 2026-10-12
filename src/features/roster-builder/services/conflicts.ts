import {
  type IssueSeverity,
  type ParsedRow,
  type ParseError,
  type RosterIssue,
} from "../types";

/**
 * Conflict engine — classify pasted rows into actionable issues.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Same input always produces the same output.
 *
 * Identity-safety guarantee: NOTHING here merges, drops, renames, or
 * reassigns. Every duplicate is reported with its source lines for an
 * explicit human decision in the UI layer. Similar-but-distinct names
 * (e.g. "Rahul Patil" vs "Rahul Patill") never match: only exact trimmed
 * equality and full normalized-key equality group rows. There is no fuzzy
 * similarity in this step by design.
 *
 * Ordering: blocking first, then review, then info. Within a severity,
 * issues sort by earliest source line (stable, deterministic).
 */

export interface ConflictOptions {
  /** Configurable maximum players per team. Never hardcoded per tournament. */
  readonly teamCapacity: number;
}

export interface IssueSummary {
  readonly blocking: number;
  readonly review: number;
  readonly info: number;
  readonly total: number;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { blocking: 0, review: 1, info: 2 };

function lineList(lines: ReadonlyArray<number>): string {
  return lines.map((n) => `line ${n}`).join(", ");
}

function earliestLine(issue: RosterIssue): number {
  const first = issue.lineNumbers[0];
  return typeof first === "number" ? first : -1;
}

function bySeverityThenLine(a: RosterIssue, b: RosterIssue): number {
  const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (rank !== 0) return rank;
  return earliestLine(a) - earliestLine(b);
}

/**
 * Map a parse-level failure to a renderable issue. Oversized input is
 * blocking; empty input is not an issue (the UI shows its empty state).
 */
export function parseErrorToIssue(error: ParseError): RosterIssue | null {
  if (error.code !== "oversized-input") return null;
  const actual = error.actual ?? 0;
  const limit = error.limit ?? 0;
  return {
    code: "oversized-input",
    severity: "blocking",
    message: error.message,
    rowIds: [],
    lineNumbers: [],
    count: actual,
    limit,
  };
}

export function summarizeIssues(issues: ReadonlyArray<RosterIssue>): IssueSummary {
  let blocking = 0;
  let review = 0;
  let info = 0;
  for (const issue of issues) {
    if (issue.severity === "blocking") blocking++;
    else if (issue.severity === "review") review++;
    else info++;
  }
  return { blocking, review, info, total: issues.length };
}

export function detectConflicts(rows: ReadonlyArray<ParsedRow>, options: ConflictOptions): RosterIssue[] {
  const issues: RosterIssue[] = [];
  const capacity = options.teamCapacity;

  // ── Per-row issues (source order) ──────────────────────────────
  for (const row of rows) {
    if (row.status === "missing-team") {
      issues.push({
        code: "missing-team",
        severity: "blocking",
        message: `Line ${row.lineNumber}: team is missing for player "${row.playerDisplay}". Assign a team or drop the row.`,
        rowIds: [row.id],
        lineNumbers: [row.lineNumber],
        playerKey: row.playerKey,
        playerDisplay: row.playerDisplay,
      });
    } else if (row.status === "missing-player") {
      issues.push({
        code: "missing-player",
        severity: "blocking",
        message: `Line ${row.lineNumber}: player is missing for team "${row.teamDisplay}". Add the player or drop the row.`,
        rowIds: [row.id],
        lineNumbers: [row.lineNumber],
        teamKey: row.teamKey,
        teamDisplay: row.teamDisplay,
      });
    } else if (row.status === "malformed") {
      issues.push({
        code: "malformed-row",
        severity: "review",
        message: `Line ${row.lineNumber} couldn't be read as a registration. Drop it or fix the line and paste again.`,
        rowIds: [row.id],
        lineNumbers: [row.lineNumber],
      });
    }
  }

  // Usable rows: both identities present.
  const usable = rows.filter((row) => row.teamKey !== "" && row.playerKey !== "");

  // ── Exact duplicate rows (identical trimmed team + player + contact) ──
  const exactGroups = new Map<string, ParsedRow[]>();
  for (const row of usable) {
    const key = `${row.teamDisplay.trim()}\0${row.playerDisplay.trim()}\0${row.contactDisplay ?? ""}`;
    const group = exactGroups.get(key);
    if (group) group.push(row);
    else exactGroups.set(key, [row]);
  }
  for (const group of exactGroups.values()) {
    if (group.length < 2) continue;
    const first = group[0] as ParsedRow;
    const lines = group.map((row) => row.lineNumber);
    issues.push({
      code: "duplicate-row-exact",
      severity: "review",
      message: `"${first.playerDisplay}" on "${first.teamDisplay}" was pasted ${group.length} times (${lineList(lines)}). Keep one entry.`,
      rowIds: group.map((row) => row.id),
      lineNumbers: lines,
      teamKey: first.teamKey,
      teamDisplay: first.teamDisplay,
      playerKey: first.playerKey,
      playerDisplay: first.playerDisplay,
      count: group.length,
    });
  }

  // ── Normalized duplicates within the same team (same keys, varied spelling) ──
  const normalizedGroups = new Map<string, ParsedRow[]>();
  for (const row of usable) {
    const key = `${row.teamKey}\0${row.playerKey}`;
    const group = normalizedGroups.get(key);
    if (group) group.push(row);
    else normalizedGroups.set(key, [row]);
  }
  for (const group of normalizedGroups.values()) {
    const raws = new Map<string, ParsedRow[]>();
    for (const row of group) {
      const raw = `${row.teamDisplay.trim()}\0${row.playerDisplay.trim()}`;
      const list = raws.get(raw);
      if (list) list.push(row);
      else raws.set(raw, [row]);
    }
    if (raws.size < 2) continue;
    const first = group[0] as ParsedRow;
    const variants: string[] = [];
    for (const variantRows of raws.values()) {
      const sample = variantRows[0] as ParsedRow;
      variants.push(`"${sample.playerDisplay}" (${lineList(variantRows.map((row) => row.lineNumber))})`);
    }
    const lines = group.map((row) => row.lineNumber);
    issues.push({
      code: "duplicate-player-same-team",
      severity: "review",
      message: `"${first.playerDisplay}" appears ${group.length} times on "${first.teamDisplay}" with different spelling: ${variants.join("; ")}. Confirm they are the same person before merging.`,
      rowIds: group.map((row) => row.id),
      lineNumbers: lines,
      teamKey: first.teamKey,
      teamDisplay: first.teamDisplay,
      playerKey: first.playerKey,
      playerDisplay: first.playerDisplay,
      variants,
      count: group.length,
    });
  }

  // ── Cross-team conflicts (same normalized player, 2+ normalized teams) ──
  const playerTeams = new Map<string, { display: string; rows: ParsedRow[]; teams: Map<string, string> }>();
  for (const row of usable) {
    let entry = playerTeams.get(row.playerKey);
    if (!entry) {
      entry = { display: row.playerDisplay, rows: [], teams: new Map() };
      playerTeams.set(row.playerKey, entry);
    }
    entry.rows.push(row);
    if (!entry.teams.has(row.teamKey)) entry.teams.set(row.teamKey, row.teamDisplay);
  }
  for (const entry of playerTeams.values()) {
    if (entry.teams.size < 2) continue;
    const teams = [...entry.teams.values()];
    const lines = entry.rows.map((row) => row.lineNumber);
    issues.push({
      code: "player-multiple-teams",
      severity: "blocking",
      message: `"${entry.display}" appears on ${entry.teams.size} teams (${teams.map((t) => `"${t}"`).join(", ")}). A player can't play for multiple teams — keep one.`,
      rowIds: entry.rows.map((row) => row.id),
      lineNumbers: lines,
      playerKey: (entry.rows[0] as ParsedRow).playerKey,
      playerDisplay: entry.display,
      teams,
      count: entry.teams.size,
    });
  }

  // ── Duplicate normalized team names (same key, varied display) ──
  const teamDisplays = new Map<string, { display: string; rows: ParsedRow[]; variants: Map<string, number> }>();
  for (const row of rows) {
    if (row.teamKey === "") continue;
    let entry = teamDisplays.get(row.teamKey);
    if (!entry) {
      entry = { display: row.teamDisplay, rows: [], variants: new Map() };
      teamDisplays.set(row.teamKey, entry);
    }
    entry.rows.push(row);
    entry.variants.set(row.teamDisplay, (entry.variants.get(row.teamDisplay) ?? 0) + 1);
  }
  for (const entry of teamDisplays.values()) {
    if (entry.variants.size < 2) continue;
    const variants = [...entry.variants.keys()];
    const lines = entry.rows.map((row) => row.lineNumber);
    issues.push({
      code: "duplicate-team-name",
      severity: "review",
      message: `${variants.map((v) => `"${v}"`).join(" and ")} look like the same team — grouped as "${entry.display}". Split them if they are different teams.`,
      rowIds: entry.rows.map((row) => row.id),
      lineNumbers: lines,
      teamKey: (entry.rows[0] as ParsedRow).teamKey,
      teamDisplay: entry.display,
      variants,
      count: entry.variants.size,
    });
  }

  // ── Team over capacity ──
  const teamCounts = new Map<string, { display: string; count: number; firstLine: number }>();
  for (const row of usable) {
    const entry = teamCounts.get(row.teamKey);
    if (entry) entry.count++;
    else teamCounts.set(row.teamKey, { display: row.teamDisplay, count: 1, firstLine: row.lineNumber });
  }
  for (const [teamKey, entry] of teamCounts) {
    if (entry.count <= capacity) continue;
    issues.push({
      code: "team-over-capacity",
      severity: "blocking",
      message: `"${entry.display}" has ${entry.count} players but the roster allows ${capacity} per team. Move or drop ${entry.count - capacity} player(s).`,
      rowIds: usable.filter((row) => row.teamKey === teamKey).map((row) => row.id),
      lineNumbers: usable.filter((row) => row.teamKey === teamKey).map((row) => row.lineNumber),
      teamKey,
      teamDisplay: entry.display,
      count: entry.count,
      limit: capacity,
    });
  }

  // ── Empty teams (rows exist, but no playable entries and no missing-player
  // rows already covering the gap) ──
  for (const [teamKey, entry] of teamDisplays) {
    const teamRows = entry.rows;
    const hasPlayable = teamRows.some((row) => row.playerKey !== "");
    if (hasPlayable) continue;
    const hasMissingPlayer = teamRows.some((row) => row.status === "missing-player");
    if (hasMissingPlayer) continue;
    issues.push({
      code: "empty-team",
      severity: "info",
      message: `"${entry.display}" has no players — it won't appear in the slot list.`,
      rowIds: teamRows.map((row) => row.id),
      lineNumbers: teamRows.map((row) => row.lineNumber),
      teamKey,
      teamDisplay: entry.display,
    });
  }

  // ── Extra columns ignored (single aggregated notice) ──
  const extraRows = rows.filter((row) => row.hasExtraColumns);
  if (extraRows.length > 0) {
    issues.push({
      code: "extra-columns-ignored",
      severity: "info",
      message:
        extraRows.length === 1
          ? `Line ${extraRows[0]?.lineNumber} had extra columns beyond team/player/contact — ignored.`
          : `${extraRows.length} rows had extra columns beyond team/player/contact — ignored (${lineList(extraRows.map((row) => row.lineNumber))}).`,
      rowIds: extraRows.map((row) => row.id),
      lineNumbers: extraRows.map((row) => row.lineNumber),
      count: extraRows.length,
    });
  }

  // ── Over-cap values (single aggregated notice, presentation hint) ──
  // Names are preserved in full — nothing was shortened. The UI should
  // wrap/scroll these instead of displaying a silently altered identity.
  const longRows = rows.filter((row) => row.exceedsDisplayCap);
  if (longRows.length > 0) {
    issues.push({
      code: "value-too-long",
      severity: "info",
      message:
        longRows.length === 1
          ? `Line ${longRows[0]?.lineNumber} has a name longer than the display cap (team ≤ 60, player ≤ 40 characters) — shown in full.`
          : `${longRows.length} names are longer than the display cap (team ≤ 60, player ≤ 40 characters) — shown in full (${lineList(longRows.map((row) => row.lineNumber))}).`,
      rowIds: longRows.map((row) => row.id),
      lineNumbers: longRows.map((row) => row.lineNumber),
      count: longRows.length,
    });
  }

  return issues.sort(bySeverityThenLine);
}
