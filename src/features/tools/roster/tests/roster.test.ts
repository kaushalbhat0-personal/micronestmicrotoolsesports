// P6 roster domain tests (pure, no database).
// Covers the full contract: empty roster, add/remove, duplicate detection +
// normalization, starter/substitute assignment, unassignment, slot capacity,
// incomplete vs complete, invalid/oversized input, unsupported games, and
// deterministic summary generation.

import { describe, expect, it } from "vitest";
import {
  RosterError,
  addPlayer,
  assignPlayer,
  buildRosterSummary,
  configureSlots,
  createRoster,
  describeCompleteness,
  normalizeDisplayName,
  occupantAt,
  removePlayer,
  unassignPlayer,
  updatePlayer,
  type RosterState,
} from "@/features/tools/roster/roster";

function fresh(overrides: Partial<Parameters<typeof createRoster>[0]> = {}): RosterState {
  return createRoster({ gameKey: "bgmi", starterSlots: 2, substituteSlots: 1, ...overrides });
}

function filledTwoStarters(): RosterState {
  let state = fresh();
  state = addPlayer(state, { displayName: "Alpha" });
  state = addPlayer(state, { displayName: "Bravo" });
  state = assignPlayer(state, "p1", { kind: "starter", index: 0 });
  state = assignPlayer(state, "p2", { kind: "starter", index: 1 });
  return state;
}

function expectRosterError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(RosterError);
    expect((error as RosterError).code).toBe(code);
    return;
  }
  throw new Error(`Expected RosterError(${code}) but nothing threw`);
}

describe("createRoster", () => {
  it("starts empty with the requested slot plan", () => {
    const state = fresh({ teamName: "  My Team  ", starterSlots: 4, substituteSlots: 2 });
    expect(state.players).toHaveLength(0);
    expect(state.config.teamName).toBe("My Team");
    expect(state.config.starterSlots).toBe(4);
    expect(state.config.substituteSlots).toBe(2);
    expect(describeCompleteness(state).status).toBe("empty");
  });

  it("rejects planned and unsupported games distinctly", () => {
    expectRosterError(() => createRoster({ gameKey: "mlbb", starterSlots: 4, substituteSlots: 1 }), "PLANNED_GAME");
    expectRosterError(
      () => createRoster({ gameKey: "valorant", starterSlots: 4, substituteSlots: 1 }),
      "UNSUPPORTED_GAME",
    );
  });

  it("rejects invalid slot counts and oversized team names", () => {
    expectRosterError(() => createRoster({ gameKey: "bgmi", starterSlots: 0, substituteSlots: 1 }), "INVALID_INPUT");
    expectRosterError(() => createRoster({ gameKey: "bgmi", starterSlots: 7, substituteSlots: 1 }), "INVALID_INPUT");
    expectRosterError(
      () => createRoster({ gameKey: "bgmi", starterSlots: 4, substituteSlots: 1, teamName: "t".repeat(41) }),
      "INVALID_INPUT",
    );
  });
});

describe("addPlayer", () => {
  it("adds players unassigned with preserved display values", () => {
    let state = fresh();
    state = addPlayer(state, { displayName: "  NovaX  ", role: "IGL", playerId: "5123456789", notes: "Shot-caller" });
    expect(state.players).toHaveLength(1);
    expect(state.players[0]).toMatchObject({
      displayName: "NovaX",
      role: "IGL",
      playerId: "5123456789",
      notes: "Shot-caller",
      assignment: null,
    });
  });

  it("rejects duplicates via normalization, preserving the original", () => {
    let state = fresh();
    state = addPlayer(state, { displayName: "Nova X" });
    expectRosterError(() => addPlayer(state, { displayName: "  nova   x " }), "DUPLICATE_NAME");
    expectRosterError(() => addPlayer(state, { displayName: "NOVA X" }), "DUPLICATE_NAME");
    // "NovaX" vs "Nova X" are different token shapes and do NOT collide.
    state = addPlayer(state, { displayName: "NovaX" });
    expect(state.players).toHaveLength(2);
  });

  it("rejects duplicate player ids case-insensitively", () => {
    let state = fresh();
    state = addPlayer(state, { displayName: "Alpha", playerId: "ABCD1234" });
    expectRosterError(() => addPlayer(state, { displayName: "Beta", playerId: "abcd1234" }), "DUPLICATE_PLAYER_ID");
  });

  it("enforces the roster cap and field bounds", () => {
    let state = createRoster({ gameKey: "bgmi", starterSlots: 6, substituteSlots: 6 });
    for (let i = 0; i < 12; i += 1) {
      state = addPlayer(state, { displayName: `Player${i}` });
    }
    expectRosterError(() => addPlayer(state, { displayName: "Extra" }), "ROSTER_FULL");
    expectRosterError(() => addPlayer(fresh(), { displayName: "x" }), "INVALID_INPUT");
    expectRosterError(() => addPlayer(fresh(), { displayName: "y".repeat(25) }), "INVALID_INPUT");
    expectRosterError(() => addPlayer(fresh(), { displayName: "Valid", role: "Sniper" }), "INVALID_INPUT");
    expectRosterError(
      () => addPlayer(fresh(), { displayName: "Valid", notes: "n".repeat(141) }),
      "INVALID_INPUT",
    );
  });
});

describe("normalizeDisplayName", () => {
  it("trims, collapses whitespace, and lowercases", () => {
    expect(normalizeDisplayName("  Nova   X ")).toBe("nova x");
    expect(normalizeDisplayName("ALPHA")).toBe("alpha");
  });
});

describe("updatePlayer + removePlayer", () => {
  it("edits fields and re-checks duplicates", () => {
    let state = filledTwoStarters();
    state = updatePlayer(state, "p1", { role: "Support", notes: "Anchor" });
    expect(state.players[0]).toMatchObject({ role: "Support", notes: "Anchor" });
    expectRosterError(() => updatePlayer(state, "p1", { displayName: "bravo" }), "DUPLICATE_NAME");
    expectRosterError(() => updatePlayer(state, "p9", { role: "IGL" }), "UNKNOWN_PLAYER");
  });

  it("removes players and frees their slots", () => {
    let state = filledTwoStarters();
    state = removePlayer(state, "p1");
    expect(state.players).toHaveLength(1);
    expect(occupantAt(state, { kind: "starter", index: 0 })).toBeUndefined();
    expectRosterError(() => removePlayer(state, "p1"), "UNKNOWN_PLAYER");
  });
});

describe("assignment", () => {
  it("assigns starters and substitutes, then unassigns", () => {
    let state = fresh();
    state = addPlayer(state, { displayName: "Alpha" });
    state = addPlayer(state, { displayName: "Beta" });
    state = assignPlayer(state, "p1", { kind: "starter", index: 0 });
    state = assignPlayer(state, "p2", { kind: "substitute", index: 0 });
    expect(occupantAt(state, { kind: "starter", index: 0 })?.displayName).toBe("Alpha");
    expect(occupantAt(state, { kind: "substitute", index: 0 })?.displayName).toBe("Beta");
    state = unassignPlayer(state, "p1");
    expect(occupantAt(state, { kind: "starter", index: 0 })).toBeUndefined();
    expectRosterError(() => unassignPlayer(state, "p1"), "NOT_ASSIGNED");
  });

  it("moves a player between slots so nobody holds two", () => {
    let state = filledTwoStarters();
    state = assignPlayer(state, "p1", { kind: "substitute", index: 0 });
    expect(occupantAt(state, { kind: "starter", index: 0 })).toBeUndefined();
    expect(occupantAt(state, { kind: "substitute", index: 0 })?.id).toBe("p1");
  });

  it("never overwrites an occupied slot", () => {
    const state = filledTwoStarters();
    expectRosterError(() => assignPlayer(state, "p2", { kind: "starter", index: 0 }), "SLOT_OCCUPIED");
    // Occupant keeps the slot after the failed attempt.
    expect(occupantAt(state, { kind: "starter", index: 0 })?.id).toBe("p1");
  });

  it("rejects out-of-range slots and unknown players", () => {
    const state = filledTwoStarters();
    expectRosterError(() => assignPlayer(state, "p1", { kind: "starter", index: 2 }), "SLOT_OUT_OF_RANGE");
    expectRosterError(() => assignPlayer(state, "p1", { kind: "substitute", index: 1 }), "SLOT_OUT_OF_RANGE");
    expectRosterError(() => assignPlayer(state, "p9", { kind: "starter", index: 0 }), "UNKNOWN_PLAYER");
  });

  it("refuses slot plans with zero substitute capacity honestly", () => {
    let state = createRoster({ gameKey: "bgmi", starterSlots: 1, substituteSlots: 0 });
    state = addPlayer(state, { displayName: "Solo" });
    expectRosterError(() => assignPlayer(state, "p1", { kind: "substitute", index: 0 }), "SLOT_OUT_OF_RANGE");
  });
});

describe("configureSlots", () => {
  it("grows capacity and renames freely", () => {
    let state = filledTwoStarters();
    state = configureSlots(state, { starterSlots: 4, teamName: "New Name" });
    expect(state.config.starterSlots).toBe(4);
    expect(state.config.teamName).toBe("New Name");
  });

  it("blocks shrinking below occupancy, naming the blockers", () => {
    const state = filledTwoStarters();
    try {
      configureSlots(state, { starterSlots: 1 });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RosterError);
      expect((error as RosterError).code).toBe("CONFIG_SHRINK_BLOCKED");
      expect((error as RosterError).message).toContain("Bravo");
    }
    // State untouched: both starters still assigned.
    expect(occupantAt(state, { kind: "starter", index: 1 })?.id).toBe("p2");
  });
});

describe("completeness", () => {
  it("reports empty, partial, and complete explicitly", () => {
    expect(describeCompleteness(fresh()).status).toBe("empty");

    let partial = fresh();
    partial = addPlayer(partial, { displayName: "Alpha" });
    partial = assignPlayer(partial, "p1", { kind: "starter", index: 0 });
    const partialView = describeCompleteness(partial);
    expect(partialView.status).toBe("partial");
    expect(partialView.startersFilled).toBe(1);
    expect(partialView.emptyStarterSlots).toEqual([2]);
    expect(partialView.issues.some((i) => i.code === "STARTER_SLOT_EMPTY")).toBe(true);

    let unassigned = fresh();
    unassigned = addPlayer(unassigned, { displayName: "Alpha" });
    unassigned = addPlayer(unassigned, { displayName: "Beta" });
    unassigned = assignPlayer(unassigned, "p1", { kind: "starter", index: 0 });
    unassigned = assignPlayer(unassigned, "p2", { kind: "starter", index: 1 });
    unassigned = addPlayer(unassigned, { displayName: "Gamma" });
    const unassignedView = describeCompleteness(unassigned);
    expect(unassignedView.status).toBe("partial");
    expect(unassignedView.issues.some((i) => i.code === "UNASSIGNED_PLAYER")).toBe(true);

    const complete = describeCompleteness(filledTwoStarters());
    expect(complete.status).toBe("complete");
    expect(complete.issues).toHaveLength(0);
  });

  it("treats empty substitute slots as fine (subs are optional)", () => {
    const view = describeCompleteness(filledTwoStarters());
    expect(view.substitutesFilled).toBe(0);
    expect(view.status).toBe("complete");
  });
});

describe("buildRosterSummary", () => {
  it("renders a deterministic, identifier-free plan", () => {
    const first = buildRosterSummary(filledTwoStarters());
    const second = buildRosterSummary(filledTwoStarters());
    expect(first).toBe(second);
    expect(first).toContain("Roster Slot Builder — roster plan");
    expect(first).toContain("Game: BGMI");
    expect(first).toContain("Slot 1: Alpha");
    expect(first).toContain("Slot 2: Bravo");
    expect(first).toContain("Complete");
    expect(first).toContain("not an official team entry");
    expect(first).toContain("does not imply organizer approval");
    expect(first).not.toContain("p1");
    expect(first).not.toContain("is approved");
    expect(first).not.toContain("is verified");
  });

  it("marks empty slots and names partial state honestly", () => {
    let state = fresh({ teamName: "Testers" });
    state = addPlayer(state, { displayName: "Alpha" });
    const summary = buildRosterSummary(state);
    expect(summary).toContain("Team: Testers");
    expect(summary).toContain("<empty>");
    expect(summary).toContain("Partial");
  });
});
