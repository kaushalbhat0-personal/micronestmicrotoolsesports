import { describe, it, expect } from "vitest";
import type { DraftConfig } from "../types";
import { applyAction, createState, deriveView, isComplete, undoLast, validateConfig } from "./draft-engine";

const baseConfig: DraftConfig = {
  teamA: "TAG",
  teamB: "Rivals",
  pool: ["Map A", "Map B", "Map C", "Map D", "Map E", "Map F", "Map G"],
  sequence: [
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
    { team: "A", type: "pick" },
    { team: "B", type: "pick" },
  ],
};

function runFull(config: DraftConfig = baseConfig) {
  let s = createState(config);
  const order: Array<{ team: "A" | "B"; item: string }> = [
    { team: "A", item: "Map A" },
    { team: "B", item: "Map B" },
    { team: "A", item: "Map C" },
    { team: "B", item: "Map D" },
    { team: "A", item: "Map E" },
    { team: "B", item: "Map F" },
  ];
  for (const a of order) {
    const r = applyAction(s, a);
    if (!r.ok) throw new Error(`setup failed: ${r.error.code} ${r.error.message}`);
    s = r.state;
  }
  return s;
}

describe("draft-engine validateConfig", () => {
  it("accepts a valid config", () => {
    expect(validateConfig(baseConfig).valid).toBe(true);
  });
  it("rejects empty team names", () => {
    expect(validateConfig({ ...baseConfig, teamA: "  " }).valid).toBe(false);
  });
  it("rejects duplicate team names case-insensitively", () => {
    const r = validateConfig({ ...baseConfig, teamB: " tag " });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/different/i);
  });
  it("rejects duplicate pool items case-insensitively", () => {
    const r = validateConfig({ ...baseConfig, pool: ["Map A", "map a", "Map C", "Map D", "Map E", "Map F", "Map G"] });
    expect(r.valid).toBe(false);
  });
  it("rejects pool smaller than sequence", () => {
    expect(validateConfig({ ...baseConfig, pool: ["A", "B"] }).valid).toBe(false);
  });
  it("rejects empty sequence", () => {
    expect(validateConfig({ ...baseConfig, sequence: [] }).valid).toBe(false);
  });
  it("rejects invalid step team/type", () => {
    const bad = { ...baseConfig, sequence: [{ team: "C", type: "ban" }] } as unknown as DraftConfig;
    expect(validateConfig(bad).valid).toBe(false);
  });
});

describe("draft-engine applyAction", () => {
  it("runs a valid sequence to completion", () => {
    const s = runFull();
    expect(isComplete(s)).toBe(true);
    expect(deriveView(s).whoseTurn).toBeNull();
  });
  it("rejects wrong turn", () => {
    const s = createState(baseConfig);
    const r = applyAction(s, { team: "B", item: "Map A" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("WRONG_TURN");
  });
  it("rejects unknown item", () => {
    const s = createState(baseConfig);
    const r = applyAction(s, { team: "A", item: "Nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ITEM_UNKNOWN");
  });
  it("rejects duplicate selection (case-insensitive, trimmed)", () => {
    let s = createState(baseConfig);
    const r1 = applyAction(s, { team: "A", item: "Map A" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state;
    const r2 = applyAction(s, { team: "B", item: "  map a " });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.code).toBe("ALREADY_USED");
  });
  it("rejects action after completion", () => {
    const s = runFull();
    const r = applyAction(s, { team: "A", item: "Map G" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DRAFT_COMPLETE");
  });
  it("matches canonical pool casing", () => {
    const s = createState(baseConfig);
    const r = applyAction(s, { team: "A", item: "map a" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.actions[0]?.item).toBe("Map A");
  });
  it("is deterministic for the same inputs", () => {
    const a = runFull();
    const b = runFull();
    expect(a.actions.map((x) => `${x.team}:${x.type}:${x.item}`)).toEqual(b.actions.map((x) => `${x.team}:${x.type}:${x.item}`));
  });
});

describe("draft-engine undo/deriveView", () => {
  it("undo removes the last action", () => {
    let s = createState(baseConfig);
    const r1 = applyAction(s, { team: "A", item: "Map A" });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.state;
    const u = undoLast(s);
    expect(u.ok).toBe(true);
    if (u.ok) expect(u.state.actions).toHaveLength(0);
  });
  it("undo on empty state errors", () => {
    const r = undoLast(createState(baseConfig));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOTHING_TO_UNDO");
  });
  it("deriveView tracks turn, teams, and remaining pool", () => {
    const s = runFull();
    const v = deriveView(s);
    expect(v.teamAItems).toHaveLength(3);
    expect(v.teamBItems).toHaveLength(3);
    expect(v.available.filter((p) => p.status === "available").map((p) => p.name)).toEqual(["Map G"]);
    expect(v.canUndo).toBe(true);
  });
});
