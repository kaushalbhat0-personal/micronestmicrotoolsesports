// P6 roster & slot builder — pure deterministic domain module.
// No I/O, no dates, no randomness: every operation takes a RosterState and
// returns a new one (immutable updates) or throws RosterError. The UI renders
// derived views; it never recomputes rules.
//
// Load-bearing rules:
// - One player occupies at most one slot; assigning never kicks an occupant
//   (occupied target => SLOT_OCCUPIED, never a silent overwrite).
// - Duplicates are rejected at add/edit time using a documented normalization
//   (trim + collapse inner whitespace + lowercase); display values are
//   preserved verbatim for rendering and export.
// - Shrinking slot counts below current occupancy is rejected with the
//   occupant names — roster data is never silently discarded.
// - Empty, partial and complete rosters are explicit states, not edge cases.

import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_PLAYERS,
  MAX_PLAYER_ID_LENGTH,
  MAX_STARTER_SLOTS,
  MAX_SUBSTITUTE_SLOTS,
  MAX_TEAM_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
  MIN_PLAYER_ID_LENGTH,
  MIN_STARTER_SLOTS,
  MIN_SUBSTITUTE_SLOTS,
  ROSTER_BGMI_ROLES,
  isRosterBgmiRole,
  resolveRosterGameKey,
  type RosterBgmiRole,
  type RosterGameKey,
  type SlotKind,
} from "./schema";

export type { RosterBgmiRole, RosterGameKey, SlotKind };

export interface SlotRef {
  readonly kind: SlotKind;
  readonly index: number; // 0-based within its kind
}

export interface RosterPlayer {
  readonly id: string; // local handle (p1, p2, …) for operations only
  readonly displayName: string; // preserved exactly as entered
  readonly playerId: string | null; // optional in-game identifier
  readonly role: RosterBgmiRole | null; // null = Flexible
  readonly notes: string | null;
  readonly assignment: SlotRef | null; // null = unassigned (bench)
}

export interface RosterConfig {
  readonly teamName: string | null;
  readonly gameKey: RosterGameKey;
  readonly starterSlots: number;
  readonly substituteSlots: number;
}

export interface RosterState {
  readonly config: RosterConfig;
  readonly players: ReadonlyArray<RosterPlayer>;
  readonly nextSeq: number;
}

export type RosterStatus = "empty" | "partial" | "complete";

export type RosterIssueCode = "NO_PLAYERS" | "STARTER_SLOT_EMPTY" | "UNASSIGNED_PLAYER";

export interface RosterIssue {
  readonly code: RosterIssueCode;
  readonly message: string;
}

export interface RosterCompleteness {
  readonly status: RosterStatus;
  readonly startersFilled: number;
  readonly starterTotal: number;
  readonly substitutesFilled: number;
  readonly substituteTotal: number;
  readonly unassignedNames: ReadonlyArray<string>;
  readonly emptyStarterSlots: ReadonlyArray<number>; // 1-based for display
  readonly issues: ReadonlyArray<RosterIssue>;
}

export type RosterErrorCode =
  | "UNSUPPORTED_GAME"
  | "PLANNED_GAME"
  | "INVALID_INPUT"
  | "DUPLICATE_NAME"
  | "DUPLICATE_PLAYER_ID"
  | "ROSTER_FULL"
  | "UNKNOWN_PLAYER"
  | "SLOT_OUT_OF_RANGE"
  | "SLOT_OCCUPIED"
  | "NOT_ASSIGNED"
  | "CONFIG_SHRINK_BLOCKED";

export class RosterError extends Error {
  readonly code: RosterErrorCode;

  constructor(code: RosterErrorCode, message: string) {
    super(message);
    this.name = "RosterError";
    this.code = code;
  }
}

/**
 * Duplicate-detection normalization: trim, collapse inner whitespace runs to
 * a single space, lowercase. "  Nova  X " and "nova x" collide; "NovaX" and
 * "Nova X" do not (different token shapes — documented, not guessed).
 */
export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePlayerId(value: string): string {
  return value.trim().toLowerCase();
}

function checkDisplayName(displayName: string): void {
  const trimmed = displayName.trim();
  if (trimmed.length < MIN_DISPLAY_NAME_LENGTH || trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new RosterError("INVALID_INPUT", "Display name must be 2–24 characters.");
  }
}

function checkPlayerId(playerId: string | null): void {
  if (playerId === null) {
    return;
  }
  const trimmed = playerId.trim();
  if (trimmed.length < MIN_PLAYER_ID_LENGTH || trimmed.length > MAX_PLAYER_ID_LENGTH) {
    throw new RosterError(
      "INVALID_INPUT",
      "Player ID must be 4–32 characters when provided.",
    );
  }
}

function checkNotes(notes: string | null): void {
  if (notes !== null && notes.trim().length > MAX_NOTES_LENGTH) {
    throw new RosterError("INVALID_INPUT", "Notes may be at most 140 characters.");
  }
}

function parseRole(role: string | null): RosterBgmiRole | null {
  if (role === null) {
    return null;
  }
  const trimmed = role.trim();
  if (trimmed === "" || trimmed === "Flexible") {
    return null;
  }
  if (!isRosterBgmiRole(trimmed)) {
    throw new RosterError(
      "INVALID_INPUT",
      "Role must be Flexible, IGL, Assaulter, Support or Scout.",
    );
  }
  return trimmed;
}

export interface CreateRosterInput {
  teamName?: string | undefined;
  gameKey: string;
  starterSlots: number;
  substituteSlots: number;
}

export function createRoster(input: CreateRosterInput): RosterState {
  const resolved = resolveRosterGameKey(input.gameKey);
  if (!resolved.ok) {
    if (resolved.reason === "planned") {
      throw new RosterError(
        "PLANNED_GAME",
        "This title is recognized but not enabled for Roster Builder yet.",
      );
    }
    throw new RosterError("UNSUPPORTED_GAME", "Roster Builder supports BGMI only.");
  }
  if (
    !Number.isInteger(input.starterSlots) ||
    input.starterSlots < MIN_STARTER_SLOTS ||
    input.starterSlots > MAX_STARTER_SLOTS
  ) {
    throw new RosterError("INVALID_INPUT", "Starter slots must be a whole number from 1 to 6.");
  }
  if (
    !Number.isInteger(input.substituteSlots) ||
    input.substituteSlots < MIN_SUBSTITUTE_SLOTS ||
    input.substituteSlots > MAX_SUBSTITUTE_SLOTS
  ) {
    throw new RosterError(
      "INVALID_INPUT",
      "Substitute slots must be a whole number from 0 to 6.",
    );
  }
  const teamName = input.teamName?.trim() ?? "";
  if (teamName.length > MAX_TEAM_NAME_LENGTH) {
    throw new RosterError("INVALID_INPUT", "Team name may be at most 40 characters.");
  }
  return {
    config: {
      teamName: teamName === "" ? null : teamName,
      gameKey: resolved.gameKey,
      starterSlots: input.starterSlots,
      substituteSlots: input.substituteSlots,
    },
    players: [],
    nextSeq: 1,
  };
}

export interface AddPlayerInput {
  displayName: string;
  playerId?: string | null | undefined;
  role?: string | null | undefined;
  notes?: string | null | undefined;
}

function toNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function addPlayer(state: RosterState, input: AddPlayerInput): RosterState {
  checkDisplayName(input.displayName);
  const playerId = toNullable(input.playerId);
  checkPlayerId(playerId);
  const notes = toNullable(input.notes);
  checkNotes(notes);
  const role = parseRole(input.role ?? null);

  if (state.players.length >= MAX_PLAYERS) {
    throw new RosterError(
      "ROSTER_FULL",
      `This roster holds at most ${MAX_PLAYERS} players. Remove someone first.`,
    );
  }
  const normalized = normalizeDisplayName(input.displayName);
  const clash = state.players.find((p) => normalizeDisplayName(p.displayName) === normalized);
  if (clash !== undefined) {
    throw new RosterError(
      "DUPLICATE_NAME",
      `"${clash.displayName}" is already on this roster (names match case-insensitively).`,
    );
  }
  if (playerId !== null) {
    const idClash = state.players.find(
      (p) => p.playerId !== null && normalizePlayerId(p.playerId) === normalizePlayerId(playerId),
    );
    if (idClash !== undefined) {
      throw new RosterError(
        "DUPLICATE_PLAYER_ID",
        `Player ID "${idClash.playerId}" is already used by "${idClash.displayName}".`,
      );
    }
  }
  const player: RosterPlayer = {
    id: `p${state.nextSeq}`,
    displayName: input.displayName.trim(),
    playerId,
    role,
    notes,
    assignment: null,
  };
  return { ...state, players: [...state.players, player], nextSeq: state.nextSeq + 1 };
}

export interface UpdatePlayerInput {
  displayName?: string | undefined;
  playerId?: string | null | undefined;
  role?: string | null | undefined;
  notes?: string | null | undefined;
  clearPlayerId?: boolean | undefined;
  clearNotes?: boolean | undefined;
}

export function updatePlayer(
  state: RosterState,
  playerId: string,
  patch: UpdatePlayerInput,
): RosterState {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new RosterError("UNKNOWN_PLAYER", "That player is not on this roster.");
  }
  const current = state.players[index]!;
  const displayName = patch.displayName === undefined ? current.displayName : patch.displayName.trim();
  checkDisplayName(displayName);
  const nextPlayerId =
    patch.clearPlayerId === true
      ? null
      : patch.playerId === undefined
        ? current.playerId
        : toNullable(patch.playerId);
  checkPlayerId(nextPlayerId);
  const nextNotes =
    patch.clearNotes === true
      ? null
      : patch.notes === undefined
        ? current.notes
        : toNullable(patch.notes);
  checkNotes(nextNotes);
  const role = patch.role === undefined ? current.role : parseRole(patch.role);

  const normalized = normalizeDisplayName(displayName);
  const clash = state.players.find(
    (p) => p.id !== playerId && normalizeDisplayName(p.displayName) === normalized,
  );
  if (clash !== undefined) {
    throw new RosterError(
      "DUPLICATE_NAME",
      `"${clash.displayName}" is already on this roster (names match case-insensitively).`,
    );
  }
  if (nextPlayerId !== null) {
    const idClash = state.players.find(
      (p) =>
        p.id !== playerId &&
        p.playerId !== null &&
        normalizePlayerId(p.playerId) === normalizePlayerId(nextPlayerId),
    );
    if (idClash !== undefined) {
      throw new RosterError(
        "DUPLICATE_PLAYER_ID",
        `Player ID "${idClash.playerId}" is already used by "${idClash.displayName}".`,
      );
    }
  }
  const updated: RosterPlayer = {
    ...current,
    displayName,
    playerId: nextPlayerId,
    role,
    notes: nextNotes,
  };
  const players = [...state.players];
  players[index] = updated;
  return { ...state, players };
}

export function removePlayer(state: RosterState, playerId: string): RosterState {
  const found = state.players.some((p) => p.id === playerId);
  if (!found) {
    throw new RosterError("UNKNOWN_PLAYER", "That player is not on this roster.");
  }
  return { ...state, players: state.players.filter((p) => p.id !== playerId) };
}

function slotCapacity(config: RosterConfig, kind: SlotKind): number {
  return kind === "starter" ? config.starterSlots : config.substituteSlots;
}

function checkSlotTarget(config: RosterConfig, target: SlotRef): void {
  const capacity = slotCapacity(config, target.kind);
  if (!Number.isInteger(target.index) || target.index < 0 || target.index >= capacity) {
    const total = capacity;
    throw new RosterError(
      "SLOT_OUT_OF_RANGE",
      total === 0
        ? `There are no ${target.kind} slots in this roster plan.`
        : `${target.kind === "starter" ? "Starter" : "Substitute"} slot must be 1–${total}.`,
    );
  }
}

export function occupantAt(state: RosterState, target: SlotRef): RosterPlayer | undefined {
  return state.players.find(
    (p) =>
      p.assignment !== null &&
      p.assignment.kind === target.kind &&
      p.assignment.index === target.index,
  );
}

/**
 * Assign a player to a slot. The target must be empty (occupied => error, the
 * occupant keeps the slot). A player already holding another slot is *moved*:
 * the old slot is freed as part of the same operation, so a player never
 * occupies two slots at once.
 */
export function assignPlayer(state: RosterState, playerId: string, target: SlotRef): RosterState {
  checkSlotTarget(state.config, target);
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new RosterError("UNKNOWN_PLAYER", "That player is not on this roster.");
  }
  const occupant = occupantAt(state, target);
  if (occupant !== undefined && occupant.id !== playerId) {
    throw new RosterError(
      "SLOT_OCCUPIED",
      `That slot is held by "${occupant.displayName}". Unassign them first.`,
    );
  }
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, assignment: { ...target } } : p,
  );
  return { ...state, players };
}

export function unassignPlayer(state: RosterState, playerId: string): RosterState {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new RosterError("UNKNOWN_PLAYER", "That player is not on this roster.");
  }
  if (state.players[index]!.assignment === null) {
    throw new RosterError("NOT_ASSIGNED", "That player holds no slot.");
  }
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, assignment: null } : p,
  );
  return { ...state, players };
}

export interface ConfigureSlotsInput {
  starterSlots?: number | undefined;
  substituteSlots?: number | undefined;
  teamName?: string | undefined;
}

/**
 * Resize slot counts or rename the team. Shrinking below current occupancy is
 * refused with the blocking names — occupants are never dropped silently.
 */
export function configureSlots(state: RosterState, input: ConfigureSlotsInput): RosterState {
  const starterSlots = input.starterSlots ?? state.config.starterSlots;
  const substituteSlots = input.substituteSlots ?? state.config.substituteSlots;
  if (
    !Number.isInteger(starterSlots) ||
    starterSlots < MIN_STARTER_SLOTS ||
    starterSlots > MAX_STARTER_SLOTS
  ) {
    throw new RosterError("INVALID_INPUT", "Starter slots must be a whole number from 1 to 6.");
  }
  if (
    !Number.isInteger(substituteSlots) ||
    substituteSlots < MIN_SUBSTITUTE_SLOTS ||
    substituteSlots > MAX_SUBSTITUTE_SLOTS
  ) {
    throw new RosterError(
      "INVALID_INPUT",
      "Substitute slots must be a whole number from 0 to 6.",
    );
  }
  const blockedStarters = state.players.filter(
    (p) => p.assignment?.kind === "starter" && p.assignment.index >= starterSlots,
  );
  const blockedSubs = state.players.filter(
    (p) => p.assignment?.kind === "substitute" && p.assignment.index >= substituteSlots,
  );
  const blocked = [...blockedStarters, ...blockedSubs];
  if (blocked.length > 0) {
    const names = blocked.map((p) => `"${p.displayName}"`).join(", ");
    throw new RosterError(
      "CONFIG_SHRINK_BLOCKED",
      `Unassign ${names} first — shrinking would drop them from their slots.`,
    );
  }
  const teamName = input.teamName === undefined ? state.config.teamName : input.teamName.trim();
  if (teamName !== null && teamName.length > MAX_TEAM_NAME_LENGTH) {
    throw new RosterError("INVALID_INPUT", "Team name may be at most 40 characters.");
  }
  return {
    ...state,
    config: {
      ...state.config,
      starterSlots,
      substituteSlots,
      teamName: teamName === null || teamName === "" ? null : teamName,
    },
  };
}

export function describeCompleteness(state: RosterState): RosterCompleteness {
  const issues: RosterIssue[] = [];
  const emptyStarterSlots: number[] = [];
  for (let index = 0; index < state.config.starterSlots; index += 1) {
    if (occupantAt(state, { kind: "starter", index }) === undefined) {
      emptyStarterSlots.push(index + 1);
    }
  }
  const unassignedNames = state.players
    .filter((p) => p.assignment === null)
    .map((p) => p.displayName);
  let startersFilled = 0;
  for (let index = 0; index < state.config.starterSlots; index += 1) {
    if (occupantAt(state, { kind: "starter", index }) !== undefined) {
      startersFilled += 1;
    }
  }
  let substitutesFilled = 0;
  for (let index = 0; index < state.config.substituteSlots; index += 1) {
    if (occupantAt(state, { kind: "substitute", index }) !== undefined) {
      substitutesFilled += 1;
    }
  }

  if (state.players.length === 0) {
    issues.push({ code: "NO_PLAYERS", message: "No players added yet." });
  }
  for (const slot of emptyStarterSlots) {
    issues.push({ code: "STARTER_SLOT_EMPTY", message: `Starter slot ${slot} is empty.` });
  }
  if (unassignedNames.length > 0) {
    const noun = unassignedNames.length === 1 ? "player is" : "players are";
    issues.push({
      code: "UNASSIGNED_PLAYER",
      message: `${unassignedNames.length} ${noun} not assigned to a slot: ${unassignedNames.map((n) => `"${n}"`).join(", ")}.`,
    });
  }

  const status: RosterStatus =
    state.players.length === 0
      ? "empty"
      : issues.length === 0
        ? "complete"
        : "partial";
  return {
    status,
    startersFilled,
    starterTotal: state.config.starterSlots,
    substitutesFilled,
    substituteTotal: state.config.substituteSlots,
    unassignedNames,
    emptyStarterSlots,
    issues,
  };
}

export function slotLabel(kind: SlotKind, index: number): string {
  return `${kind === "starter" ? "Starter" : "Substitute"} ${index + 1}`;
}

function playerLine(player: RosterPlayer): string {
  const role = player.role ?? "Flexible";
  const idPart = player.playerId !== null ? ` [${player.playerId}]` : "";
  const notesPart = player.notes !== null ? ` — ${player.notes}` : "";
  return `${player.displayName}${idPart} (${role})${notesPart}`;
}

/**
 * Deterministic plain-text export. Slots render in index order; unassigned
 * players sort by normalized name (id breaks ties). No internal ids, no
 * metadata, no approval language — labelled throughout as a user-made plan.
 */
export function buildRosterSummary(state: RosterState): string {
  const completeness = describeCompleteness(state);
  const lines: string[] = [
    "Roster Slot Builder — roster plan (user-created, not an official entry)",
    `Team: ${state.config.teamName ?? "Unnamed team"}`,
    "Game: BGMI (Battlegrounds Mobile India)",
    `Slots: ${state.config.starterSlots} ${state.config.starterSlots === 1 ? "starter" : "starters"} + ${state.config.substituteSlots} ${state.config.substituteSlots === 1 ? "substitute" : "substitutes"}`,
    "",
    "Starters:",
  ];
  for (let index = 0; index < state.config.starterSlots; index += 1) {
    const occupant = occupantAt(state, { kind: "starter", index });
    lines.push(`  Slot ${index + 1}: ${occupant ? playerLine(occupant) : "<empty>"}`);
  }
  lines.push("Substitutes:");
  if (state.config.substituteSlots === 0) {
    lines.push("  (no substitute slots configured)");
  } else {
    for (let index = 0; index < state.config.substituteSlots; index += 1) {
      const occupant = occupantAt(state, { kind: "substitute", index });
      lines.push(`  Slot ${index + 1}: ${occupant ? playerLine(occupant) : "<empty>"}`);
    }
  }
  const unassigned = [...state.players]
    .filter((p) => p.assignment === null)
    .sort(
      (a, b) =>
        normalizeDisplayName(a.displayName).localeCompare(normalizeDisplayName(b.displayName)) ||
        a.id.localeCompare(b.id),
    );
  lines.push("Unassigned:");
  if (unassigned.length === 0) {
    lines.push("  (none)");
  } else {
    for (const player of unassigned) {
      lines.push(`  - ${playerLine(player)}`);
    }
  }
  lines.push("");
  const statusLine =
    completeness.status === "complete"
      ? "Status: Complete — every starter slot is filled and every player is assigned."
      : completeness.status === "empty"
        ? "Status: Empty — no players added yet."
        : `Status: Partial — ${completeness.issues.map((i) => i.message).join(" ")}`;
  lines.push(statusLine);
  lines.push(
    "This is a user-created roster plan. It is not an official team entry and does not imply organizer approval or player verification.",
  );
  return lines.join("\n");
}

/** Test/demo helper: the documented BGMI role list for select controls. */
export function rosterRoleOptions(): ReadonlyArray<string> {
  return ["Flexible", ...ROSTER_BGMI_ROLES];
}
