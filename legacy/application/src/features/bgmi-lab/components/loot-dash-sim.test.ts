import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/arcade/rng";
import {
  LOOT_DASH_HEIGHT,
  LOOT_DASH_TUNING,
  LOOT_DASH_WIDTH,
  createLootDashRun,
  hazardSpeedScale,
  hazardTargetFor,
  spawnIntervalFor,
  stepLootDash,
  summarizeLootDash,
  type LootDashInput,
} from "./loot-dash-sim";

const IDLE: LootDashInput = { moveX: 0, moveY: 0, hasKeys: false, pointerX: 0, pointerY: 0, pointerActive: false };

function runFor(seed: number, seconds: number, input: LootDashInput = IDLE, dt = 1 / 60) {
  const { state, rng } = createLootDashRun(seed);
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps && state.over === null; i++) stepLootDash(state, input, dt, rng);
  return state;
}

describe("loot dash sim — movement bounds", () => {
  it("clamps the player inside the arena", () => {
    const { state, rng } = createLootDashRun(7);
    const left: LootDashInput = { ...IDLE, moveX: -1, moveY: 0, hasKeys: true };
    for (let i = 0; i < 600; i++) stepLootDash(state, left, 1 / 60, rng);
    expect(state.playerX).toBeGreaterThanOrEqual(LOOT_DASH_TUNING.playerRadius);
    expect(state.playerX).toBeLessThanOrEqual(LOOT_DASH_WIDTH - LOOT_DASH_TUNING.playerRadius);
    const down: LootDashInput = { ...IDLE, moveX: 0, moveY: 1, hasKeys: true };
    for (let i = 0; i < 600; i++) stepLootDash(state, down, 1 / 60, rng);
    expect(state.playerY).toBeLessThanOrEqual(LOOT_DASH_HEIGHT - LOOT_DASH_TUNING.playerRadius);
  });

  it("follows an active pointer target", () => {
    const { state, rng } = createLootDashRun(7);
    const startX = state.playerX;
    const follow: LootDashInput = { ...IDLE, pointerX: startX + 120, pointerY: state.playerY, pointerActive: true };
    stepLootDash(state, follow, 0.5, rng);
    expect(state.playerX).toBeGreaterThan(startX);
  });

  it("prefers keyboard over pointer when keys are held", () => {
    const { state, rng } = createLootDashRun(7);
    const startX = state.playerX;
    const both: LootDashInput = { ...IDLE, moveX: -1, moveY: 0, hasKeys: true, pointerX: startX + 200, pointerY: 0, pointerActive: true };
    stepLootDash(state, both, 0.25, rng);
    expect(state.playerX).toBeLessThan(startX);
  });
});

describe("loot dash sim — pickups and combo", () => {
  it("collects a token on contact and scores its value", () => {
    const { state, rng } = createLootDashRun(11);
    state.tokens = [{ id: 5001, x: state.playerX, y: state.playerY, kind: "supply", value: 10, radius: 9 }];
    stepLootDash(state, IDLE, 1 / 60, rng);
    // The collected token is gone; the spawner tops the field back up.
    expect(state.tokens.find((t) => t.id === 5001)).toBeUndefined();
    expect(state.score).toBe(10);
    expect(state.pickups).toBe(1);
    expect(state.combo).toBe(1);
    expect(state.bestCombo).toBe(1);
  });

  it("adds a combo bonus for chained pickups", () => {
    const { state, rng } = createLootDashRun(11);
    state.tokens = [{ id: 5001, x: state.playerX, y: state.playerY, kind: "supply", value: 10, radius: 9 }];
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.score).toBe(10);
    state.tokens = [{ id: 5002, x: state.playerX, y: state.playerY, kind: "cache", value: 25, radius: 11 }];
    stepLootDash(state, IDLE, 1 / 60, rng);
    // Second pickup earns its value plus a combo step bonus.
    expect(state.score).toBe(10 + 25 + 2);
    expect(state.bestCombo).toBe(2);
  });

  it("resets the combo when the window expires", () => {
    const { state, rng } = createLootDashRun(11);
    state.tokens = [{ id: 5001, x: state.playerX, y: state.playerY, kind: "supply", value: 10, radius: 9 }];
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.combo).toBe(1);
    for (let i = 0; i < 300; i++) stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.combo).toBe(0);
  });

  it("a medkit heals a hit instead of scoring full value", () => {
    const { state, rng } = createLootDashRun(11);
    state.hitsTaken = 1;
    state.tokens.push({ id: 9999, x: state.playerX, y: state.playerY, kind: "medkit", value: 15, radius: 10 });
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.hitsTaken).toBe(0);
    expect(state.score).toBe(5);
  });
});

describe("loot dash sim — hazards", () => {
  it("a hazard hit costs combo and grants brief protection", () => {
    const { state, rng } = createLootDashRun(21);
    const h = state.hazards[0]!;
    state.playerX = h.x;
    state.playerY = h.y;
    state.combo = 3;
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.hitsTaken).toBe(1);
    expect(state.combo).toBe(0);
    expect(state.invulnTimer).toBeGreaterThan(0);
    const hits = state.hitsTaken;
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.hitsTaken).toBe(hits);
  });

  it("three hits ends the run as caught", () => {
    const { state, rng } = createLootDashRun(21);
    for (let n = 0; n < 3; n++) {
      state.invulnTimer = 0;
      const h = state.hazards[0]!;
      state.playerX = h.x;
      state.playerY = h.y;
      stepLootDash(state, IDLE, 1 / 60, rng);
    }
    expect(state.hitsTaken).toBe(3);
    expect(state.over).toBe("caught");
    expect(summarizeLootDash(state).reason).toBe("caught");
  });

  it("hazards bounce inside the arena", () => {
    const { state, rng } = createLootDashRun(21);
    for (let i = 0; i < 3600 && state.over === null; i++) stepLootDash(state, IDLE, 1 / 60, rng);
    for (const h of state.hazards) {
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x).toBeLessThanOrEqual(LOOT_DASH_WIDTH);
      expect(h.y).toBeGreaterThanOrEqual(0);
      expect(h.y).toBeLessThanOrEqual(LOOT_DASH_HEIGHT);
    }
  });
});

describe("loot dash sim — timer and game over", () => {
  it("ends the run when the timer expires", () => {
    const tuning = { ...LOOT_DASH_TUNING, durationSec: 2 };
    const { state, rng } = createLootDashRun(5, tuning);
    let ended = false;
    for (let i = 0; i < 300 && !ended; i++) ended = stepLootDash(state, IDLE, 1 / 60, rng, tuning);
    expect(ended).toBe(true);
    expect(state.over).toBe("finished");
    expect(summarizeLootDash(state).reason).toBe("finished");
  });

  it("never advances past game over", () => {
    const state = runFor(5, 60);
    expect(state.over).not.toBeNull();
    const score = state.score;
    const { rng } = createLootDashRun(5);
    stepLootDash(state, IDLE, 1 / 60, rng);
    expect(state.score).toBe(score);
  });
});

describe("loot dash sim — seeded randomness and difficulty", () => {
  it("reproduces the same layout from the same seed", () => {
    const a = createLootDashRun(1234);
    const b = createLootDashRun(1234);
    expect(a.state.tokens).toEqual(b.state.tokens);
    expect(a.state.hazards.map((h) => [h.x, h.y])).toEqual(b.state.hazards.map((h) => [h.x, h.y]));
  });

  it("varies layouts between runs", () => {
    const a = createLootDashRun(1);
    const b = createLootDashRun(2);
    expect(a.state.tokens).not.toEqual(b.state.tokens);
  });

  it("ramps hazard count and speed across the run", () => {
    expect(hazardTargetFor(0)).toBe(3);
    expect(hazardTargetFor(15)).toBe(4);
    expect(hazardTargetFor(30)).toBe(5);
    expect(hazardSpeedScale(45, 45)).toBeGreaterThan(hazardSpeedScale(0, 45));
    expect(spawnIntervalFor(40, 45)).toBeLessThan(spawnIntervalFor(0, 45));
  });

  it("summarizes an untouched run honestly", () => {
    const { state } = createLootDashRun(9);
    const summary = summarizeLootDash(state);
    expect(summary).toEqual({ score: 0, pickups: 0, bestCombo: 0, hitsTaken: 0, reason: "finished" });
  });

  it("rng helpers stay in range", () => {
    const rng = createRng(42);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
