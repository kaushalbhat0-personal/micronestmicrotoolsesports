import {
  type ParsedRow,
  type PlayerEntry,
  type RemovedTeam,
  type SlotAssignment,
  type WorkingModel,
  type WorkingTeam,
} from "../types";
import { displayName, normalizeIdentity } from "./normalize";

/**
 * Slot engine — team/player ordering with derived slot numbers.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Same input always produces the same output. Inputs are never mutated —
 * every operation returns new arrays.
 *
 * Model: initial team order is first-seen input order; player order inside
 * a team is first-seen line order. Slot number = position + 1. No gaps, no
 * custom slot numbers in V1. Removing a team never discards players
 * silently — the removed payload is returned for explicit UI placement.
 */

/** Group usable rows (team + player present) into first-seen team order. */
export function buildWorkingModel(rows: ReadonlyArray<ParsedRow>): WorkingModel {
  const order: string[] = [];
  const groups = new Map<string, { teamDisplay: string; players: PlayerEntry[] }>();
  for (const row of rows) {
    if (row.teamKey === "" || row.playerKey === "") continue;
    let group = groups.get(row.teamKey);
    if (!group) {
      group = { teamDisplay: row.teamDisplay, players: [] };
      groups.set(row.teamKey, group);
      order.push(row.teamKey);
    }
    group.players.push({
      rowId: row.id,
      lineNumber: row.lineNumber,
      playerDisplay: row.playerDisplay,
      playerKey: row.playerKey,
    });
  }
  return {
    teams: order.map((teamKey) => {
      const group = groups.get(teamKey) as { teamDisplay: string; players: PlayerEntry[] };
      return { teamKey, teamDisplay: group.teamDisplay, players: [...group.players] };
    }),
  };
}

/** Contiguous slot numbers derived from the current team order. */
export function assignSlots(teams: ReadonlyArray<WorkingTeam>): SlotAssignment[] {
  return teams.map((team, index) => ({
    slot: index + 1,
    teamKey: team.teamKey,
    teamDisplay: team.teamDisplay,
    playerCount: team.players.length,
  }));
}

function teamIndexOf(teams: ReadonlyArray<WorkingTeam>, teamKey: string): number {
  return teams.findIndex((team) => team.teamKey === teamKey);
}

function moveInList<T>(list: ReadonlyArray<T>, fromIndex: number, toIndex: number): T[] {
  const next = [...list];
  if (fromIndex < 0 || fromIndex >= next.length) return next;
  const clamped = Math.min(Math.max(toIndex, 0), next.length - 1);
  if (clamped === fromIndex) return next;
  const [item] = next.splice(fromIndex, 1) as T[];
  next.splice(clamped, 0, item as T);
  return next;
}

export function moveTeamUp(teams: ReadonlyArray<WorkingTeam>, teamKey: string): WorkingTeam[] {
  const index = teamIndexOf(teams, teamKey);
  if (index <= 0) return [...teams];
  return moveInList(teams, index, index - 1);
}

export function moveTeamDown(teams: ReadonlyArray<WorkingTeam>, teamKey: string): WorkingTeam[] {
  const index = teamIndexOf(teams, teamKey);
  if (index < 0 || index >= teams.length - 1) return [...teams];
  return moveInList(teams, index, index + 1);
}

/** Reorder by position. Out-of-range targets clamp to the nearest edge. */
export function reorderTeams(teams: ReadonlyArray<WorkingTeam>, fromIndex: number, toIndex: number): WorkingTeam[] {
  return moveInList(teams, fromIndex, toIndex);
}

export function movePlayerUp(teams: ReadonlyArray<WorkingTeam>, teamKey: string, rowId: string): WorkingTeam[] {
  return movePlayer(teams, teamKey, rowId, -1);
}

export function movePlayerDown(teams: ReadonlyArray<WorkingTeam>, teamKey: string, rowId: string): WorkingTeam[] {
  return movePlayer(teams, teamKey, rowId, 1);
}

function movePlayer(
  teams: ReadonlyArray<WorkingTeam>,
  teamKey: string,
  rowId: string,
  direction: -1 | 1,
): WorkingTeam[] {
  return teams.map((team) => {
    if (team.teamKey !== teamKey) return { ...team, players: [...team.players] };
    const index = team.players.findIndex((player) => player.rowId === rowId);
    if (index < 0) return { ...team, players: [...team.players] };
    return { ...team, players: moveInList(team.players, index, index + direction) };
  });
}

export interface AddTeamResult {
  readonly teams: WorkingTeam[];
  readonly added: boolean;
}

/** Add an empty team. Blank or duplicate names are rejected (`added: false`). */
export function addTeam(teams: ReadonlyArray<WorkingTeam>, teamDisplay: string): AddTeamResult {
  const display = displayName(teamDisplay);
  const key = normalizeIdentity(display);
  if (key === "" || teamIndexOf(teams, key) >= 0) return { teams: [...teams], added: false };
  return { teams: [...teams, { teamKey: key, teamDisplay: display, players: [] }], added: true };
}

export interface RemoveTeamResult {
  readonly teams: WorkingTeam[];
  /** Null when the team was absent. Players travel with the payload — never dropped. */
  readonly removed: RemovedTeam | null;
}

export function removeTeam(teams: ReadonlyArray<WorkingTeam>, teamKey: string): RemoveTeamResult {
  const target = teams.find((team) => team.teamKey === teamKey);
  if (!target) return { teams: [...teams], removed: null };
  return {
    teams: teams.filter((team) => team.teamKey !== teamKey).map((team) => ({ ...team, players: [...team.players] })),
    removed: { teamKey: target.teamKey, teamDisplay: target.teamDisplay, players: [...target.players] },
  };
}
