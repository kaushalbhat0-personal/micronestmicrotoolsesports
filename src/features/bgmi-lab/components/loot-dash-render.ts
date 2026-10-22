/**
 * Loot Dash renderer — presentation-only Canvas drawing for the Loot Dash arena.
 *
 * Purely visual, painted back-to-front: terrain, movement dust, pickup
 * objects, hazard fields, combo links, player marker, combo pulse, pickup
 * sparks and score floaters, damage edge, and result-freeze emphasis.
 * It reads simulation state but never mutates
 * gameplay — no scoring, no collision, no spawning, no phase decisions.
 * All randomness here is decorative and seeded separately from the sim.
 */

import { createRng, range } from "@/lib/arcade/rng";
import { LOOT_DASH_HEIGHT, LOOT_DASH_WIDTH, type LootHazard, type LootPickup } from "./loot-dash-sim";
import { LOOT_DASH_BGMI_THEME, LOOT_DASH_PALETTE } from "./loot-dash-theme";

/* ------------------------------------------------------------------ */
/* Terrain (decorative, seeded per run, never collides)                */
/* ------------------------------------------------------------------ */

export interface TerrainPatch {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly tone: 0 | 1 | 2;
}

export interface TerrainStroke {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface TerrainDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CoverRock {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CoverBush {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CoverWall {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface LootTerrain {
  readonly patches: readonly TerrainPatch[];
  readonly strokes: readonly TerrainStroke[];
  readonly dots: readonly TerrainDot[];
  readonly rocks: readonly CoverRock[];
  readonly bushes: readonly CoverBush[];
  readonly walls: readonly CoverWall[];
}

/** Build one decorative terrain set from a run seed. Deterministic per seed. */
export function buildLootTerrain(seed: number): LootTerrain {
  const rng = createRng(seed ^ 0x9e3779b9);
  const patches: TerrainPatch[] = [];
  for (let i = 0; i < 7; i++) {
    patches.push({
      x: range(rng, 30, LOOT_DASH_WIDTH - 30),
      y: range(rng, 30, LOOT_DASH_HEIGHT - 30),
      rx: range(rng, 26, 64),
      ry: range(rng, 20, 48),
      tone: i % 3 as 0 | 1 | 2,
    });
  }
  const strokes: TerrainStroke[] = [];
  for (let i = 0; i < 8; i++) {
    const x = range(rng, 20, LOOT_DASH_WIDTH - 60);
    const y = range(rng, 20, LOOT_DASH_HEIGHT - 40);
    strokes.push({ x1: x, y1: y, x2: x + range(rng, 24, 52), y2: y + range(rng, -14, 14) });
  }
  const dots: TerrainDot[] = [];
  for (let i = 0; i < 26; i++) {
    dots.push({
      x: range(rng, 8, LOOT_DASH_WIDTH - 8),
      y: range(rng, 8, LOOT_DASH_HEIGHT - 8),
      r: range(rng, 1, 2),
    });
  }
  const rocks: CoverRock[] = [];
  for (let i = 0; i < 3; i++) {
    rocks.push({ x: range(rng, 40, LOOT_DASH_WIDTH - 40), y: range(rng, 50, LOOT_DASH_HEIGHT - 50), r: range(rng, 10, 16) });
  }
  const bushes: CoverBush[] = [];
  for (let i = 0; i < 3; i++) {
    bushes.push({ x: range(rng, 40, LOOT_DASH_WIDTH - 40), y: range(rng, 50, LOOT_DASH_HEIGHT - 50), r: range(rng, 11, 17) });
  }
  const walls: CoverWall[] = [];
  for (let i = 0; i < 2; i++) {
    const horizontal = rng() > 0.5;
    walls.push({
      x: range(rng, 50, LOOT_DASH_WIDTH - 90),
      y: range(rng, 60, LOOT_DASH_HEIGHT - 80),
      w: horizontal ? range(rng, 44, 64) : 12,
      h: horizontal ? 12 : range(rng, 40, 58),
    });
  }
  return { patches, strokes, dots, rocks, bushes, walls };
}

/* ------------------------------------------------------------------ */
/* Transient visual effects (bounded, decorative, reduced-motion safe)  */
/* ------------------------------------------------------------------ */

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  total: number;
  color: string;
  size: number;
}

export interface FloatText {
  x: number;
  y: number;
  ttl: number;
  total: number;
  text: string;
  color: string;
}

export interface TrailPuff {
  x: number;
  y: number;
  ttl: number;
  total: number;
}

export interface ComboLink {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ttl: number;
  total: number;
}

export interface LootVisual {
  sparks: Spark[];
  floaters: FloatText[];
  trail: TrailPuff[];
  links: ComboLink[];
  damageFlash: number;
  lastDirX: number;
  lastDirY: number;
  lastPickupX: number;
  lastPickupY: number;
  hasLastPickup: boolean;
  trailClock: number;
}

export function createLootVisual(): LootVisual {
  return {
    sparks: [],
    floaters: [],
    trail: [],
    links: [],
    damageFlash: 0,
    lastDirX: 0,
    lastDirY: -1,
    lastPickupX: 0,
    lastPickupY: 0,
    hasLastPickup: false,
    trailClock: 0,
  };
}

/** Push while keeping the array bounded (drops oldest). Returns the array. */
export function pushBounded<T>(arr: T[], item: T, max: number): T[] {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
  return arr;
}

export function lootSparkCountFor(combo: number): number {
  return Math.min(4 + combo * 2, 12);
}

/* ------------------------------------------------------------------ */
/* Frame rendering                                                     */
/* ------------------------------------------------------------------ */

export interface LootFrame {
  readonly terrain: LootTerrain;
  readonly visual: LootVisual;
  readonly tokens: readonly LootPickup[];
  readonly hazards: readonly LootHazard[];
  readonly playerX: number;
  readonly playerY: number;
  readonly playerRadius: number;
  readonly elapsed: number;
  readonly combo: number;
  readonly invulnTimer: number;
  readonly over: boolean;
  readonly reducedMotion: boolean;
}

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(63, 52, 40, 0.16)";
  ctx.fill();
  ctx.restore();
}

function renderTerrain(ctx: CanvasRenderingContext2D, terrain: LootTerrain): void {
  ctx.fillStyle = LOOT_DASH_PALETTE.arena;
  ctx.fillRect(0, 0, LOOT_DASH_WIDTH, LOOT_DASH_HEIGHT);
  const tones = [LOOT_DASH_PALETTE.patchA, LOOT_DASH_PALETTE.patchB, LOOT_DASH_PALETTE.patchC] as const;
  for (const p of terrain.patches) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = tones[p.tone];
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = LOOT_DASH_PALETTE.contour;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.8;
  for (const s of terrain.strokes) {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.quadraticCurveTo((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 4, s.x2, s.y2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = LOOT_DASH_PALETTE.grid;
  for (const d of terrain.dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Cover pocket: low flat walls.
  for (const w of terrain.walls) {
    shadow(ctx, w.x + w.w / 2, w.y + w.h / 2 + 3, w.w / 2, 5);
    ctx.save();
    ctx.fillStyle = LOOT_DASH_PALETTE.coverWall;
    ctx.strokeStyle = LOOT_DASH_PALETTE.coverEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(w.x, w.y, w.w, w.h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // Rocks: faceted low polygons.
  for (const r of terrain.rocks) {
    shadow(ctx, r.x, r.y + r.r * 0.7, r.r * 0.9, r.r * 0.32);
    ctx.save();
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const rr = r.r * (i % 2 === 0 ? 1 : 0.78);
      const px = r.x + Math.cos(a) * rr;
      const py = r.y + Math.sin(a) * rr * 0.86;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = LOOT_DASH_PALETTE.coverRock;
    ctx.fill();
    ctx.strokeStyle = LOOT_DASH_PALETTE.coverEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r.x - r.r * 0.35, r.y - r.r * 0.1);
    ctx.lineTo(r.x + r.r * 0.1, r.y - r.r * 0.34);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  // Bushes: clustered canopy, darker rim.
  for (const b of terrain.bushes) {
    shadow(ctx, b.x, b.y + b.r * 0.72, b.r * 0.95, b.r * 0.3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = LOOT_DASH_PALETTE.coverBush;
    ctx.fill();
    ctx.strokeStyle = LOOT_DASH_PALETTE.coverBushEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.24, b.r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fill();
    ctx.restore();
  }
}

function renderPickup(ctx: CanvasRenderingContext2D, token: LootPickup, bob: number): void {
  const y = token.y + bob;
  if (token.kind === "supply") {
    shadow(ctx, token.x, token.y + 8, 9, 3.5);
    ctx.save();
    ctx.translate(token.x, y);
    ctx.fillStyle = LOOT_DASH_PALETTE.supplyDeep;
    ctx.fillRect(-8, -5, 16, 12);
    ctx.fillStyle = LOOT_DASH_PALETTE.supply;
    ctx.fillRect(-8, -7, 16, 12);
    ctx.strokeStyle = "#3c5a72";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -7, 16, 12);
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.lineTo(8, -1);
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(-2, -4, 4, 4);
    ctx.restore();
  } else if (token.kind === "cache") {
    shadow(ctx, token.x, token.y + 10, 12, 4);
    ctx.save();
    ctx.translate(token.x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = LOOT_DASH_PALETTE.cacheDeep;
    ctx.fillRect(-9, -7, 18, 18);
    ctx.fillStyle = LOOT_DASH_PALETTE.cache;
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    shadow(ctx, token.x, token.y + 8, 9, 3.5);
    ctx.save();
    ctx.translate(token.x, y);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = LOOT_DASH_PALETTE.medkit;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-9, -7, 18, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LOOT_DASH_PALETTE.medkit;
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.fillRect(-1.5, -5, 3, 10);
    ctx.restore();
  }
}

function renderHazard(ctx: CanvasRenderingContext2D, h: LootHazard, time: number, reduced: boolean): void {
  const wobble = reduced ? 0 : Math.sin(time * 2 + h.id * 1.7) * 0.04;
  ctx.save();
  // Soft warning tint, kept inside the true radius.
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
  ctx.fillStyle = LOOT_DASH_PALETTE.hazard;
  ctx.globalAlpha = 0.1;
  ctx.fill();
  ctx.globalAlpha = 1;
  // Irregular inner edge — decorative, strictly inside h.r.
  ctx.beginPath();
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = h.r * 0.88 * (1 + wobble * Math.sin(i * 2.3 + h.id));
    const px = h.x + Math.cos(a) * rr;
    const py = h.y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = LOOT_DASH_PALETTE.hazardSoft;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // True-radius dashed boundary — the readable danger line.
  ctx.beginPath();
  ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = reduced ? 0 : -time * 12;
  ctx.strokeStyle = LOOT_DASH_PALETTE.hazard;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.setLineDash([]);
  // Small warning pip at the top of the ring.
  ctx.beginPath();
  ctx.moveTo(h.x, h.y - h.r - 2);
  ctx.lineTo(h.x - 5, h.y - h.r - 10);
  ctx.lineTo(h.x + 5, h.y - h.r - 10);
  ctx.closePath();
  ctx.fillStyle = LOOT_DASH_PALETTE.hazard;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(h.x, h.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = LOOT_DASH_PALETTE.hazard;
  ctx.fill();
  ctx.restore();
}

function renderPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  dirX: number,
  dirY: number,
  invuln: boolean,
  time: number,
  reduced: boolean,
): void {
  shadow(ctx, x + 1, y + r * 0.85, r * 0.95, r * 0.34);
  ctx.save();
  if (invuln) ctx.globalAlpha = reduced ? 0.55 : time * 10 % 2 < 1 ? 0.35 : 1;
  // Outer tactical ring.
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.strokeStyle = LOOT_DASH_PALETTE.player;
  ctx.globalAlpha *= 1;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // Body.
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = LOOT_DASH_PALETTE.player;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = LOOT_DASH_PALETTE.playerInk;
  ctx.stroke();
  // Directional wedge.
  const len = Math.hypot(dirX, dirY);
  const dx = len > 0.01 ? dirX / len : 0;
  const dy = len > 0.01 ? dirY / len : -1;
  const px = -dy;
  const py = dx;
  ctx.beginPath();
  ctx.moveTo(x + dx * (r + 1), y + dy * (r + 1));
  ctx.lineTo(x - dx * (r * 0.3) + px * (r * 0.55), y - dy * (r * 0.3) + py * (r * 0.55));
  ctx.lineTo(x - dx * (r * 0.3) - px * (r * 0.55), y - dy * (r * 0.3) - py * (r * 0.55));
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // Core pip.
  ctx.beginPath();
  ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.restore();
  // Identity label.
  ctx.save();
  ctx.fillStyle = LOOT_DASH_PALETTE.text;
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(LOOT_DASH_BGMI_THEME.playerLabel, x, y - r - 9);
  ctx.restore();
}

/** Advance decorative effect timers. Call once per frame with clamped dt. */
export function stepLootVisualEffects(visual: LootVisual, dt: number): void {
  const tick = <T extends { ttl: number }>(arr: T[]): T[] => arr.filter((e) => (e.ttl -= dt) > 0);
  visual.sparks = tick(visual.sparks);
  visual.floaters = tick(visual.floaters);
  visual.trail = tick(visual.trail);
  visual.links = tick(visual.links);
  if (visual.damageFlash > 0) visual.damageFlash = Math.max(0, visual.damageFlash - dt);
}

export function renderLootFrame(ctx: CanvasRenderingContext2D, frame: LootFrame): void {
  const { terrain, visual, reducedMotion } = frame;
  const time = reducedMotion ? 0 : frame.elapsed;
  ctx.clearRect(0, 0, LOOT_DASH_WIDTH, LOOT_DASH_HEIGHT);
  renderTerrain(ctx, terrain);

  // Movement dust, under everything gameplay.
  if (!reducedMotion) {
    for (const t of visual.trail) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, 5 + (1 - t.ttl / t.total) * 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(143, 74, 18, 0.18)";
      ctx.globalAlpha = Math.max(0, t.ttl / t.total) * 0.6;
      ctx.fill();
      ctx.restore();
    }
  }

  for (const token of frame.tokens) {
    const bob = reducedMotion ? 0 : Math.sin(time * 3 + token.id) * 1.2;
    renderPickup(ctx, token, bob);
  }
  for (const h of frame.hazards) renderHazard(ctx, h, time, reducedMotion);

  // Combo link between successive pickups.
  if (!reducedMotion) {
    for (const l of visual.links) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.strokeStyle = LOOT_DASH_PALETTE.player;
      ctx.globalAlpha = Math.max(0, l.ttl / l.total) * 0.55;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderPlayer(ctx, frame.playerX, frame.playerY, frame.playerRadius, visual.lastDirX, visual.lastDirY, frame.invulnTimer > 0, frame.elapsed, reducedMotion);

  // Combo pulse around the player while chaining.
  if (!reducedMotion && frame.combo >= 2) {
    const tier = Math.min(frame.combo, 5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(frame.playerX, frame.playerY, frame.playerRadius + 8 + Math.sin(time * 6) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = tier >= 4 ? LOOT_DASH_PALETTE.comboHot : LOOT_DASH_PALETTE.player;
    ctx.globalAlpha = 0.35 + tier * 0.08;
    ctx.lineWidth = 1.5 + tier * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  // Pickup sparks.
  if (!reducedMotion) {
    for (const s of visual.sparks) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0, s.ttl / s.total);
      ctx.fill();
      ctx.restore();
    }
    // Rising score markers.
    for (const f of visual.floaters) {
      const k = 1 - f.ttl / f.total;
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.ttl / f.total);
      ctx.fillStyle = f.color;
      ctx.font = "bold 12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - k * 22);
      ctx.restore();
    }
  }

  // Damage emphasis: restrained red edge. Static under reduced motion.
  if (visual.damageFlash > 0) {
    ctx.save();
    ctx.strokeStyle = LOOT_DASH_PALETTE.hazard;
    ctx.globalAlpha = reducedMotion ? 0.25 : Math.max(0, visual.damageFlash / 0.4) * 0.55;
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, LOOT_DASH_WIDTH - 6, LOOT_DASH_HEIGHT - 6);
    ctx.restore();
  }

  // Final freeze emphasis once the run ends (single static frame).
  if (frame.over) {
    ctx.save();
    ctx.strokeStyle = "rgba(63, 52, 40, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, LOOT_DASH_WIDTH - 4, LOOT_DASH_HEIGHT - 4);
    ctx.beginPath();
    ctx.arc(frame.playerX, frame.playerY, frame.playerRadius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = LOOT_DASH_PALETTE.playerInk;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}
