/**
 * Draft & Ban — Domain types.
 *
 * Pure types only. No React, no Supabase, no browser APIs.
 * Persistence shapes (rows) live in repositories/services; these are the
 * in-memory engine + template contract types.
 */

export type DraftTeam = "A" | "B";
export type DraftActionType = "ban" | "pick";
export type DraftStatus = "in_progress" | "completed" | "abandoned";

export interface DraftStep {
  readonly team: DraftTeam;
  readonly type: DraftActionType;
}

export interface DraftAction {
  readonly stepIndex: number;
  readonly team: DraftTeam;
  readonly type: DraftActionType;
  readonly item: string;
  readonly at: string;
}

export interface DraftConfig {
  readonly teamA: string;
  readonly teamB: string;
  readonly pool: readonly string[];
  readonly sequence: readonly DraftStep[];
}

export interface DraftState {
  readonly config: DraftConfig;
  readonly actions: readonly DraftAction[];
}

export type DraftEngineErrorCode =
  | "INVALID_CONFIG"
  | "WRONG_TEAM"
  | "WRONG_TURN"
  | "ITEM_UNKNOWN"
  | "ALREADY_USED"
  | "DRAFT_COMPLETE"
  | "NOTHING_TO_UNDO";

export interface DraftEngineError {
  readonly code: DraftEngineErrorCode;
  readonly message: string;
}

export type ApplyActionResult = { readonly ok: true; readonly state: DraftState } | { readonly ok: false; readonly error: DraftEngineError };

export type UndoResult = { readonly ok: true; readonly state: DraftState } | { readonly ok: false; readonly error: DraftEngineError };

export interface PoolItemView {
  readonly name: string;
  readonly status: "available" | "banned" | "picked";
  readonly byTeam: DraftTeam | null;
}

export interface DraftView {
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly whoseTurn: DraftTeam | null;
  readonly currentStep: DraftStep | null;
  readonly available: readonly PoolItemView[];
  readonly teamAItems: readonly PoolItemView[];
  readonly teamBItems: readonly PoolItemView[];
  readonly isComplete: boolean;
  readonly canUndo: boolean;
}

export interface DraftTemplateConfig {
  readonly sequence: readonly DraftStep[];
  readonly pool: readonly string[];
  readonly teamA: string | null;
  readonly teamB: string | null;
}

export interface MatchMetadata {
  readonly matchName: string | null;
  readonly eventName: string | null;
  readonly formatLabel: string | null;
  readonly notes: string | null;
}
