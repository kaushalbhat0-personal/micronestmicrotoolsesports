import { describe, expect, it } from "vitest";
import {
  buildLootTerrain,
  createLootVisual,
  lootSparkCountFor,
  pushBounded,
  stepLootVisualEffects,
} from "./loot-dash-render";

describe("loot dash visuals — presentation-only terrain", () => {
  it("builds the same decorative terrain from the same seed", () => {
    const a = buildLootTerrain(42);
    const b = buildLootTerrain(42);
    expect(a).toEqual(b);
    expect(a.patches.length).toBeGreaterThan(0);
    expect(a.rocks.length).toBe(3);
    expect(a.bushes.length).toBe(3);
    expect(a.walls.length).toBe(2);
  });

  it("varies decorative terrain between seeds", () => {
    expect(buildLootTerrain(1)).not.toEqual(buildLootTerrain(2));
  });

  it("keeps every terrain element inside the 360x480 arena", () => {
    const t = buildLootTerrain(7);
    for (const p of t.patches) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(360);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(480);
    }
    for (const r of [...t.rocks, ...t.bushes]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThanOrEqual(360);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThanOrEqual(480);
    }
    for (const w of t.walls) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.x + w.w).toBeLessThanOrEqual(360);
      expect(w.y).toBeGreaterThanOrEqual(0);
      expect(w.y + w.h).toBeLessThanOrEqual(480);
    }
  });
});

describe("loot dash visuals — bounded effects", () => {
  it("caps effect arrays instead of growing across restarts", () => {
    const visual = createLootVisual();
    for (let i = 0; i < 200; i++) {
      pushBounded(visual.sparks, { x: 0, y: 0, vx: 0, vy: 0, ttl: 0.45, total: 0.45, color: "#fff", size: 2 }, 60);
      pushBounded(visual.floaters, { x: 0, y: 0, ttl: 0.8, total: 0.8, text: "+10", color: "#000" }, 12);
      pushBounded(visual.trail, { x: 0, y: 0, ttl: 0.4, total: 0.4 }, 20);
      pushBounded(visual.links, { x1: 0, y1: 0, x2: 1, y2: 1, ttl: 0.35, total: 0.35 }, 8);
    }
    expect(visual.sparks.length).toBe(60);
    expect(visual.floaters.length).toBe(12);
    expect(visual.trail.length).toBe(20);
    expect(visual.links.length).toBe(8);
  });

  it("expires effects within the 250-450ms feel window", () => {
    const visual = createLootVisual();
    pushBounded(visual.sparks, { x: 0, y: 0, vx: 0, vy: 0, ttl: 0.45, total: 0.45, color: "#fff", size: 2 }, 60);
    pushBounded(visual.links, { x1: 0, y1: 0, x2: 1, y2: 1, ttl: 0.35, total: 0.35 }, 8);
    stepLootVisualEffects(visual, 0.5);
    expect(visual.sparks).toEqual([]);
    expect(visual.links).toEqual([]);
    expect(visual.damageFlash).toBe(0);
  });

  it("escalates spark counts with combo without exceeding the cap", () => {
    expect(lootSparkCountFor(0)).toBe(4);
    expect(lootSparkCountFor(2)).toBe(8);
    expect(lootSparkCountFor(9)).toBe(12);
  });
});
