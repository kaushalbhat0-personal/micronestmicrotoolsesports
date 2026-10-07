import type {
  ApplyActionResult,
  DraftAction,
  DraftConfig,
  DraftEngineError,
  DraftState,
  DraftStep,
  DraftTeam,
  DraftView,
  PoolItemView,
  UndoResult,
} from "../types";

/**
 * Draft & Ban — Deterministic domain engine.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no auth.
 * Contract: currentState + action → new state OR deterministic error.
 * Server re-runs this engine on persisted state for every mutation.
 */

export function normalizeItemName(item: string): string {
  return item.trim().replace(/\s+/g, " ");
}

function itemKey(item: string): string {
  return normalizeItemName(item).toLowerCase();
}

export function validateConfig(config: DraftConfig): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const teamA = config.teamA?.trim() ?? "";
  const teamB = config.teamB?.trim() ?? "";
  if (!teamA) errors.push("Team A name is required");
  if (!teamB) errors.push("Team B name is required");
  if (teamA && teamB && teamA.toLowerCase() === teamB.toLowerCase()) errors.push("Team names must be different");
  if (!Array.isArray(config.pool) || config.pool.length < 2) errors.push("Pool must contain at least 2 items");
  if (Array.isArray(config.pool) && config.pool.length > 100) errors.push("Pool supports at most 100 items");
  const seen = new Map<string, number>();
  for (const raw of config.pool ?? []) {
    const key = itemKey(String(raw ?? ""));
    if (!key) errors.push("Pool items must not be empty");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  if ([...seen.values()].some((n) => n > 1)) errors.push("Pool items must be unique (case-insensitive)");
  if (!Array.isArray(config.sequence) || config.sequence.length < 1) errors.push("Sequence must contain at least one step");
  if (Array.isArray(config.sequence) && config.sequence.length > 100) errors.push("Sequence supports at most 100 steps");
  for (const step of config.sequence ?? []) {
    if (!step || (step.team !== "A" && step.team !== "B")) errors.push("Sequence contains an invalid team");
    if (!step || (step.type !== "ban" && step.type !== "pick")) errors.push("Sequence contains an invalid step type");
  }
  if (Array.isArray(config.pool) && Array.isArray(config.sequence) && config.pool.length < config.sequence.length) {
    errors.push(`Pool needs at least ${config.sequence.length} items for this sequence`);
  }
  return { valid: errors.length === 0, errors };
}

function invalidConfigError(errors: readonly string[]): DraftEngineError {
  return { code: "INVALID_CONFIG", message: errors[0] ?? "Invalid draft configuration" };
}

export function createState(config: DraftConfig): DraftState {
  const normalized: DraftConfig = {
    teamA: config.teamA.trim(),
    teamB: config.teamB.trim(),
    pool: config.pool.map((p) => normalizeItemName(String(p))),
    sequence: config.sequence.map((s) => ({ team: s.team, type: s.type })),
  };
  return { config: normalized, actions: [] };
}

export function currentStep(state: DraftState): DraftStep | null {
  const step = state.config.sequence[state.actions.length];
  return step ?? null;
}

function usedKeySet(state: DraftState): Set<string> {
  return new Set(state.actions.map((a) => itemKey(a.item)));
}

export function applyAction(state: DraftState, input: { team: DraftTeam; item: string }): ApplyActionResult {
  const configCheck = validateConfig(state.config);
  if (!configCheck.valid) return { ok: false, error: invalidConfigError(configCheck.errors) };

  const step = currentStep(state);
  if (!step) return { ok: false, error: { code: "DRAFT_COMPLETE", message: "Draft is complete. Finalize the record or start a new draft." } };

  const normalizedItem = normalizeItemName(input.item);
  if (!normalizedItem) return { ok: false, error: { code: "ITEM_UNKNOWN", message: "Choose an item from the available pool." } };

  if (input.team !== step.team) {
    const expected = step.team === "A" ? state.config.teamA : state.config.teamB;
    return { ok: false, error: { code: "WRONG_TURN", message: `It is ${expected}'s turn (${step.type}).` } };
  }

  const poolKeys = new Map(state.config.pool.map((p) => [itemKey(p), p] as const));
  const canonical = poolKeys.get(itemKey(normalizedItem));
  if (!canonical) return { ok: false, error: { code: "ITEM_UNKNOWN", message: `"${normalizedItem}" is not in the draft pool.` } };

  if (usedKeySet(state).has(itemKey(canonical))) {
    return { ok: false, error: { code: "ALREADY_USED", message: `"${canonical}" was already selected earlier in this draft.` } };
  }

  const action: DraftAction = {
    stepIndex: state.actions.length,
    team: step.team,
    type: step.type,
    item: canonical,
    at: new Date().toISOString(),
  };
  return { ok: true, state: { config: state.config, actions: [...state.actions, action] } };
}

export function undoLast(state: DraftState): UndoResult {
  if (state.actions.length === 0) return { ok: false, error: { code: "NOTHING_TO_UNDO", message: "Nothing to undo yet." } };
  return { ok: true, state: { config: state.config, actions: state.actions.slice(0, -1) } };
}

export function isComplete(state: DraftState): boolean {
  return state.actions.length >= state.config.sequence.length;
}

export function deriveView(state: DraftState): DraftView {
  const used = new Map<string, DraftAction>();
  for (const a of state.actions) used.set(itemKey(a.item), a);

  const available: PoolItemView[] = state.config.pool.map((name) => {
    const hit = used.get(itemKey(name));
    if (!hit) return { name, status: "available" as const, byTeam: null };
    return { name, status: hit.type === "ban" ? ("banned" as const) : ("picked" as const), byTeam: hit.team };
  });

  const teamAItems = state.actions.filter((a) => a.team === "A").map((a) => ({ name: a.item, status: a.type === "ban" ? ("banned" as const) : ("picked" as const), byTeam: a.team as DraftTeam }));
  const teamBItems = state.actions.filter((a) => a.team === "B").map((a) => ({ name: a.item, status: a.type === "ban" ? ("banned" as const) : ("picked" as const), byTeam: a.team as DraftTeam }));

  const step = currentStep(state);
  const complete = isComplete(state);
  return {
    stepIndex: state.actions.length,
    totalSteps: state.config.sequence.length,
    whoseTurn: complete || !step ? null : step.team,
    currentStep: complete ? null : step,
    available,
    teamAItems,
    teamBItems,
    isComplete: complete,
    canUndo: state.actions.length > 0,
  };
}
