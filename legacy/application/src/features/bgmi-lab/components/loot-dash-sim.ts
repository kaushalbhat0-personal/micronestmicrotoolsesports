/**
 * Loot Dash simulation — pure game logic, no React, no DOM, no Canvas.
 *
 * A top-down arena run: move, collect supply tokens, dodge hazard rings,
 * chain pickups into combos. All randomness flows through an injected
 * seeded generator so tests reproduce any scenario.
 *
 * Portability boundary: every entity here is abstract (player, token,
 * hazard, arena, combo). Flavor words ("supplies", "danger rings", "loot
 * route") live in `loot-dash-theme.ts`, never in this module — a future
 * MLBB skin remaps copy and colors without touching mechanics.
 */

import { createRng, range, type ArcadeRng } from "@/lib/arcade/rng";
import { clamp, circlesOverlap } from "@/lib/arcade/geometry";

export const LOOT_DASH_WIDTH = 360;
export const LOOT_DASH_HEIGHT = 480;
export const LOOT_DASH_DURATION_SEC = 45;
export const LOOT_DASH_LIVES = 3;

export type LootPickupKind = "supply" | "cache" | "medkit";

export interface LootPickup {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly kind: LootPickupKind;
  readonly value: number;
  readonly radius: number;
}

export interface LootHazard {
  readonly id: number;
  x: number;
  y: number;
  readonly r: number;
  vx: number;
  vy: number;
}

export type LootOverReason = "finished" | "caught";

export interface LootDashState {
  elapsed: number;
  timeLeft: number;
  score: number;
  pickups: number;
  combo: number;
  bestCombo: number;
  hitsTaken: number;
  invulnTimer: number;
  comboTimer: number;
  spawnTimer: number;
  nextId: number;
  playerX: number;
  playerY: number;
  tokens: LootPickup[];
  hazards: LootHazard[];
  over: LootOverReason | null;
}

export interface LootDashInput {
  /** Keyboard vector, already normalized to length <= 1. Zero when no keys. */
  readonly moveX: number;
  readonly moveY: number;
  readonly hasKeys: boolean;
  /** Pointer-follow target in logical coords (drag-to-move). */
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerActive: boolean;
}

export interface LootDashTuning {
  readonly durationSec: number;
  readonly lives: number;
  readonly playerSpeed: number;
  readonly playerRadius: number;
  readonly comboWindowSec: number;
  readonly invulnSec: number;
}

export const LOOT_DASH_TUNING: LootDashTuning = {
  durationSec: LOOT_DASH_DURATION_SEC,
  lives: LOOT_DASH_LIVES,
  playerSpeed: 235,
  playerRadius: 10,
  comboWindowSec: 4,
  invulnSec: 1.5,
};

const TOKEN_TARGET = 4;
const COMBO_BONUS_PER_STEP = 2;

function rollKind(rng: ArcadeRng): { kind: LootPickupKind; value: number; radius: number } {
  const roll = rng();
  if (roll < 0.12) return { kind: "medkit", value: 15, radius: 10 };
  if (roll < 0.3) return { kind: "cache", value: 25, radius: 11 };
  return { kind: "supply", value: 10, radius: 9 };
}

function spawnToken(s: LootDashState, rng: ArcadeRng): void {
  const { kind, value, radius } = rollKind(rng);
  s.tokens.push({
    id: s.nextId++,
    x: range(rng, 24, LOOT_DASH_WIDTH - 24),
    y: range(rng, 24, LOOT_DASH_HEIGHT - 24),
    kind,
    value,
    radius,
  });
}

function spawnHazard(s: LootDashState, rng: ArcadeRng, awayFrom: boolean): void {
  const r = range(rng, 22, 30);
  let x = range(rng, r + 8, LOOT_DASH_WIDTH - r - 8);
  let y = range(rng, r + 8, LOOT_DASH_HEIGHT - r - 8);
  if (awayFrom) {
    for (let tries = 0; tries < 8; tries++) {
      const dx = x - s.playerX;
      const dy = y - s.playerY;
      if (Math.hypot(dx, dy) >= 120) break;
      x = range(rng, r + 8, LOOT_DASH_WIDTH - r - 8);
      y = range(rng, r + 8, LOOT_DASH_HEIGHT - r - 8);
    }
  }
  const angle = rng() * Math.PI * 2;
  const speed = range(rng, 18, 34);
  s.hazards.push({ id: s.nextId++, x, y, r, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
}

/** Difficulty ramp: hazard count and drift speed grow across the run. */
export function hazardTargetFor(elapsed: number): number {
  return 3 + (elapsed >= 15 ? 1 : 0) + (elapsed >= 30 ? 1 : 0);
}

export function hazardSpeedScale(elapsed: number, durationSec: number): number {
  return 1 + (Math.min(elapsed, durationSec) / durationSec) * 0.6;
}

export function spawnIntervalFor(elapsed: number, durationSec: number): number {
  return Math.max(0.7, 1.2 - (Math.min(elapsed, durationSec) / durationSec) * 0.5);
}

export function createLootDashRun(
  seed: number,
  tuning: LootDashTuning = LOOT_DASH_TUNING,
): { state: LootDashState; rng: ArcadeRng } {
  const rng = createRng(seed);
  const state: LootDashState = {
    elapsed: 0,
    timeLeft: tuning.durationSec,
    score: 0,
    pickups: 0,
    combo: 0,
    bestCombo: 0,
    hitsTaken: 0,
    invulnTimer: 0,
    comboTimer: 0,
    spawnTimer: 0,
    nextId: 1,
    playerX: LOOT_DASH_WIDTH / 2,
    playerY: LOOT_DASH_HEIGHT - 60,
    tokens: [],
    hazards: [],
    over: null,
  };
  for (let i = 0; i < TOKEN_TARGET; i++) spawnToken(state, rng);
  for (let i = 0; i < 3; i++) spawnHazard(state, rng, true);
  return { state, rng };
}

function collectToken(s: LootDashState, token: LootPickup, tuning: LootDashTuning): void {
  s.tokens = s.tokens.filter((t) => t.id !== token.id);
  s.combo += 1;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.comboTimer = tuning.comboWindowSec;
  if (token.kind === "medkit" && s.hitsTaken > 0) {
    s.hitsTaken -= 1;
    s.score += 5;
  } else {
    s.score += token.value + (s.combo - 1) * COMBO_BONUS_PER_STEP;
  }
  s.pickups += 1;
}

/**
 * Advance the simulation by dt seconds. Mutates state (single owner: the
 * shell's ref). Returns true when the run just ended this step.
 */
export function stepLootDash(
  s: LootDashState,
  input: LootDashInput,
  dtSec: number,
  rng: ArcadeRng,
  tuning: LootDashTuning = LOOT_DASH_TUNING,
): boolean {
  if (s.over !== null) return false;
  const dt = Math.min(Math.max(dtSec, 0), 0.05);

  s.elapsed += dt;
  s.timeLeft = Math.max(0, tuning.durationSec - s.elapsed);
  if (s.invulnTimer > 0) s.invulnTimer = Math.max(0, s.invulnTimer - dt);
  if (s.comboTimer > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) s.combo = 0;
  }

  // Movement: keyboard vector wins when keys are held, otherwise drift
  // toward the active pointer target (drag-to-move).
  const speed = tuning.playerSpeed;
  if (input.hasKeys) {
    s.playerX += input.moveX * speed * dt;
    s.playerY += input.moveY * speed * dt;
  } else if (input.pointerActive) {
    const dx = input.pointerX - s.playerX;
    const dy = input.pointerY - s.playerY - 26;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const step = Math.min(dist, speed * dt);
      s.playerX += (dx / dist) * step;
      s.playerY += (dy / dist) * step;
    }
  }
  const pr = tuning.playerRadius;
  s.playerX = clamp(s.playerX, pr + 4, LOOT_DASH_WIDTH - pr - 4);
  s.playerY = clamp(s.playerY, pr + 4, LOOT_DASH_HEIGHT - pr - 4);

  // Pickups.
  for (const token of [...s.tokens]) {
    if (circlesOverlap(s.playerX, s.playerY, pr, token.x, token.y, token.radius)) {
      collectToken(s, token, tuning);
    }
  }

  // Hazard drift (bounce off walls) + collision.
  const scale = hazardSpeedScale(s.elapsed, tuning.durationSec);
  for (const h of s.hazards) {
    h.x += h.vx * scale * dt;
    h.y += h.vy * scale * dt;
    if (h.x < h.r + 4 || h.x > LOOT_DASH_WIDTH - h.r - 4) h.vx *= -1;
    if (h.y < h.r + 4 || h.y > LOOT_DASH_HEIGHT - h.r - 4) h.vy *= -1;
    h.x = clamp(h.x, h.r + 4, LOOT_DASH_WIDTH - h.r - 4);
    h.y = clamp(h.y, h.r + 4, LOOT_DASH_HEIGHT - h.r - 4);
  }
  if (s.invulnTimer <= 0) {
    for (const h of s.hazards) {
      if (circlesOverlap(s.playerX, s.playerY, pr * 0.85, h.x, h.y, h.r * 0.9)) {
        s.hitsTaken += 1;
        s.combo = 0;
        s.comboTimer = 0;
        s.invulnTimer = tuning.invulnSec;
        if (s.hitsTaken >= tuning.lives) {
          s.over = "caught";
          return true;
        }
        break;
      }
    }
  }

  // Spawns: hold the token count, grow hazards on the ramp.
  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    s.spawnTimer = spawnIntervalFor(s.elapsed, tuning.durationSec);
    if (s.tokens.length < TOKEN_TARGET) spawnToken(s, rng);
  }
  if (s.hazards.length < hazardTargetFor(s.elapsed)) spawnHazard(s, rng, true);

  if (s.timeLeft <= 0) {
    s.over = "finished";
    return true;
  }
  return false;
}

export interface LootDashSummary {
  readonly score: number;
  readonly pickups: number;
  readonly bestCombo: number;
  readonly hitsTaken: number;
  readonly reason: LootOverReason;
}

export function summarizeLootDash(s: LootDashState): LootDashSummary {
  return {
    score: s.score,
    pickups: s.pickups,
    bestCombo: s.bestCombo,
    hitsTaken: s.hitsTaken,
    reason: s.over ?? "finished",
  };
}
