import { describe, expect, it } from "vitest";
import {
  LOOT_DASH_HEIGHT,
  LOOT_DASH_TUNING,
  LOOT_DASH_WIDTH,
  createLootDashRun,
  stepLootDash,
  type LootDashInput,
} from "./loot-dash-sim";
import {
  LOOT_DASH_SIM_FOLLOW_OFFSET_PX,
  LOOT_DASH_TOUCH_LIFT_PX,
  resolveLootPointerTarget,
} from "./loot-dash-pointer";

const IDLE: LootDashInput = { moveX: 0, moveY: 0, hasKeys: false, pointerX: 0, pointerY: 0, pointerActive: false };

describe("loot dash pointer mapping — touch lift", () => {
  it("leaves fine-pointer (mouse) targets untouched", () => {
    expect(resolveLootPointerTarget({ x: 180, y: 240 }, false)).toEqual({ x: 180, y: 240 });
  });

  it("lifts coarse-pointer (touch) targets upward in logical coords", () => {
    expect(resolveLootPointerTarget({ x: 180, y: 240 }, true)).toEqual({
      x: 180,
      y: 240 - LOOT_DASH_TOUCH_LIFT_PX,
    });
  });

  it("preserves logical X at the arena center", () => {
    const t = resolveLootPointerTarget({ x: LOOT_DASH_WIDTH / 2, y: 300 }, true);
    expect(t.x).toBe(LOOT_DASH_WIDTH / 2);
  });

  it("keeps the combined sim + shell offset inside the 44-64px touch window", () => {
    // Sim settles the player SIM_OFFSET above the target; the shell lifts
    // the target TOUCH_LIFT above the finger. Total separation per axis:
    const total = LOOT_DASH_SIM_FOLLOW_OFFSET_PX + LOOT_DASH_TOUCH_LIFT_PX;
    expect(total).toBeGreaterThanOrEqual(44);
    expect(total).toBeLessThanOrEqual(64);
  });

  it("passes edge touches through unclamped — the sim owns clamping", () => {
    // Left/right/top/bottom raw values survive mapping 1:1 (minus Y lift);
    // the sim's clamp keeps the player inside the arena.
    expect(resolveLootPointerTarget({ x: 0, y: 240 }, true)).toEqual({ x: 0, y: 240 - LOOT_DASH_TOUCH_LIFT_PX });
    expect(resolveLootPointerTarget({ x: 360, y: 240 }, true)).toEqual({ x: 360, y: 240 - LOOT_DASH_TOUCH_LIFT_PX });
    expect(resolveLootPointerTarget({ x: 180, y: 0 }, true)).toEqual({ x: 180, y: -LOOT_DASH_TOUCH_LIFT_PX });
    expect(resolveLootPointerTarget({ x: 180, y: 480 }, true)).toEqual({ x: 180, y: 480 - LOOT_DASH_TOUCH_LIFT_PX });
  });
});

describe("loot dash pointer mapping — clamping and visibility through the sim", () => {
  function stepWithTouch(pointerX: number, pointerY: number, steps = 240) {
    const { state, rng } = createLootDashRun(7);
    const target = resolveLootPointerTarget({ x: pointerX, y: pointerY }, true);
    const input: LootDashInput = { ...IDLE, pointerX: target.x, pointerY: target.y, pointerActive: true };
    for (let i = 0; i < steps; i++) stepLootDash(state, input, 1 / 60, rng);
    return state;
  }

  it("settles the player a full touch offset above the finger at center", () => {
    const state = stepWithTouch(180, 300);
    // Player converges to target (lifted 30) minus the sim's 26px follow
    // offset, within the sim's 4px arrival dead zone.
    const expected = 300 - LOOT_DASH_TOUCH_LIFT_PX - LOOT_DASH_SIM_FOLLOW_OFFSET_PX;
    expect(Math.abs(state.playerY - expected)).toBeLessThanOrEqual(4);
    expect(300 - state.playerY).toBeGreaterThanOrEqual(48);
    expect(state.playerX).toBeCloseTo(180, 0);
  });

  it("clamps a top-edge touch to the normal boundary without disappearing", () => {
    const state = stepWithTouch(180, 0);
    const minY = LOOT_DASH_TUNING.playerRadius + 4;
    expect(state.playerY).toBeGreaterThanOrEqual(minY);
    expect(state.playerY).toBeLessThanOrEqual(LOOT_DASH_HEIGHT - LOOT_DASH_TUNING.playerRadius);
  });

  it("clamps left/right/bottom-edge touches inside the arena", () => {
    for (const [x, y] of [[0, 240], [360, 240], [180, 480]] as const) {
      const state = stepWithTouch(x, y);
      expect(state.playerX).toBeGreaterThanOrEqual(LOOT_DASH_TUNING.playerRadius);
      expect(state.playerX).toBeLessThanOrEqual(LOOT_DASH_WIDTH - LOOT_DASH_TUNING.playerRadius);
      expect(state.playerY).toBeGreaterThanOrEqual(LOOT_DASH_TUNING.playerRadius);
      expect(state.playerY).toBeLessThanOrEqual(LOOT_DASH_HEIGHT - LOOT_DASH_TUNING.playerRadius);
    }
  });

  it("still collects a token on contact with lifted input active", () => {
    const { state, rng } = createLootDashRun(11);
    const target = resolveLootPointerTarget({ x: state.playerX, y: state.playerY + 56 }, true);
    // Finger rests 56 below the player; lifted target lands on the player.
    const input: LootDashInput = { ...IDLE, pointerX: target.x, pointerY: target.y, pointerActive: true };
    state.tokens = [{ id: 5001, x: state.playerX, y: state.playerY, kind: "supply", value: 10, radius: 9 }];
    stepLootDash(state, input, 1 / 60, rng);
    expect(state.score).toBe(10);
    expect(state.pickups).toBe(1);
  });
});
