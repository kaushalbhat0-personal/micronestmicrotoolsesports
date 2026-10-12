/**
 * Tournament Roster & Slot Builder — domain types.
 *
 * Pure data contracts only. No React, no Supabase, no browser APIs.
 * Every value crossing these types is untrusted pasted text until validated.
 */

/** Hard input limits — integrity guards, not usage metering. Tighten freely. */
export const MAX_INPUT_CHARS = 50_000;
export const MAX_LINES = 2_000;
export const MAX_TEAMS = 200;
export const MAX_PLAYERS = 2_000;
export const MAX_LINE_LENGTH = 300;

/**
 * Display-cap thresholds — presentation hints only. Values are NEVER
 * truncated: over-cap names keep their full display text, full comparison
 * key, and full output, and are surfaced via a `value-too-long` notice so
 * the UI can wrap/scroll them instead of showing a silently altered name.
 */
export const MAX_TEAM_NAME_LENGTH = 60;
export const MAX_PLAYER_NAME_LENGTH = 40;
export const MAX_CONTACT_LENGTH = 100;

/** Team capacity bounds for the configurable players-per-team setting. */
export const MIN_TEAM_CAPACITY = 1;
export const MAX_TEAM_CAPACITY = 30;
export const DEFAULT_TEAM_CAPACITY = 5;

export type Delimiter = "\t" | "," | ";" | "|";

export const DELIMITERS: ReadonlyArray<Delimiter> = ["\t", ",", ";", "|"];

export type DelimiterName = "tab" | "comma" | "semicolon" | "pipe";

export const DELIMITER_LABELS: Record<Delimiter, DelimiterName> = {
  "\t": "tab",
  ",": "comma",
  ";": "semicolon",
  "|": "pipe",
};

export type ParsedRowStatus = "valid" | "missing-team" | "missing-player" | "malformed";

export interface ParsedRow {
  /** Stable deterministic identity derived from the 1-based source line number. */
  readonly id: string;
  /** 1-based line number in the original pasted input. */
  readonly lineNumber: number;
  /** Original team text: whitespace-collapsed, case/punctuation preserved. */
  readonly teamDisplay: string;
  /** Original player text: whitespace-collapsed, case/punctuation preserved. */
  readonly playerDisplay: string;
  /** Optional third column (contact/identifier). Never part of identity. */
  readonly contactDisplay?: string | undefined;
  /** Normalized comparison key for the team (see normalize.ts). Empty when team missing. */
  readonly teamKey: string;
  /** Normalized comparison key for the player. Empty when player missing. */
  readonly playerKey: string;
  readonly status: ParsedRowStatus;
  /** True when the source line carried a 4th+ column (ignored by design). */
  readonly hasExtraColumns: boolean;
  /**
   * True when a display value exceeds its display cap. Presentation hint
   * only — the display text, comparison keys, and outputs all carry the
   * complete untruncated value.
   */
  readonly exceedsDisplayCap: boolean;
  /** Source line as pasted (carriage return stripped, capped for safety). */
  readonly raw: string;
}

export type IssueSeverity = "blocking" | "review" | "info";

export type IssueCode =
  | "oversized-input"
  | "missing-team"
  | "missing-player"
  | "player-multiple-teams"
  | "team-over-capacity"
  | "duplicate-row-exact"
  | "duplicate-player-same-team"
  | "duplicate-team-name"
  | "malformed-row"
  | "empty-team"
  | "extra-columns-ignored"
  | "value-too-long";

export interface RosterIssue {
  readonly code: IssueCode;
  readonly severity: IssueSeverity;
  /** Human-readable, no internal IDs. Line numbers included where actionable. */
  readonly message: string;
  /** Deterministic row references for the future UI (stable `r<line>` ids). */
  readonly rowIds: ReadonlyArray<string>;
  /** 1-based source line numbers, ascending. */
  readonly lineNumbers: ReadonlyArray<number>;
  readonly teamKey?: string | undefined;
  readonly teamDisplay?: string | undefined;
  readonly playerKey?: string | undefined;
  readonly playerDisplay?: string | undefined;
  /** Teams involved (first-seen display order) — for cross-team conflicts. */
  readonly teams?: ReadonlyArray<string> | undefined;
  /** Variant spellings seen (first-seen display order) — for duplicate groups. */
  readonly variants?: ReadonlyArray<string> | undefined;
  readonly count?: number | undefined;
  readonly limit?: number | undefined;
}

export type ParseErrorCode = "empty-input" | "oversized-input";

export type OversizedScope = "characters" | "lines" | "teams" | "players";

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  readonly scope?: OversizedScope | undefined;
  readonly actual?: number | undefined;
  readonly limit?: number | undefined;
}

export interface ParseColumnMap {
  readonly teamIndex: number;
  readonly playerIndex: number;
  readonly contactIndex: number;
  /** True when the mapping came from a recognized header row. */
  readonly fromHeader: boolean;
}

export interface ParseStats {
  readonly dataRows: number;
  readonly teams: number;
  readonly players: number;
}

export interface ParseSuccess {
  readonly ok: true;
  readonly rows: ReadonlyArray<ParsedRow>;
  readonly delimiter: Delimiter;
  /** False when the caller forced the delimiter via override. */
  readonly delimiterDetected: boolean;
  readonly columnMap: ParseColumnMap;
  readonly stats: ParseStats;
}

export interface ParseFailure {
  readonly ok: false;
  readonly error: ParseError;
}

export type ParseResult = ParseSuccess | ParseFailure;

export interface PlayerEntry {
  readonly rowId: string;
  readonly lineNumber: number;
  readonly playerDisplay: string;
  readonly playerKey: string;
}

export interface WorkingTeam {
  readonly teamKey: string;
  readonly teamDisplay: string;
  /** First-seen input order unless explicitly reordered via the slot service. */
  readonly players: ReadonlyArray<PlayerEntry>;
}

export interface WorkingModel {
  readonly teams: ReadonlyArray<WorkingTeam>;
}

export interface SlotAssignment {
  /** Contiguous 1-based slot derived from team order (`index + 1`). No gaps. */
  readonly slot: number;
  readonly teamKey: string;
  readonly teamDisplay: string;
  readonly playerCount: number;
}

export interface RemovedTeam {
  readonly teamKey: string;
  readonly teamDisplay: string;
  /** Players are never discarded silently — the UI must place these explicitly. */
  readonly players: ReadonlyArray<PlayerEntry>;
}

export interface PrintTeam {
  readonly slot: number;
  readonly team: string;
  readonly players: ReadonlyArray<string>;
}

export interface PrintModel {
  readonly teams: ReadonlyArray<PrintTeam>;
  readonly totalTeams: number;
  readonly totalPlayers: number;
}
