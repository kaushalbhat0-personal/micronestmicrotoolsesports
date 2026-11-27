/**
 * Arcade seeded RNG — minimal deterministic randomness for interactive Lab games.
 *
 * One algorithm only (mulberry32). Games create one generator per run from a
 * seed and thread it through spawning/placement so tests can reproduce any
 * scenario. Normal interactive runs use a fresh ephemeral seed per attempt.
 * No Math.random() inside gameplay paths that consume this generator.
 */

export type ArcadeRng = () => number;

/** Unsigned 32-bit seed from any integer input. */
export function normalizeSeed(seed: number): number {
  return (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
}

/** mulberry32 — small, fast, deterministic across engines for integer seeds. */
export function createRng(seed: number): ArcadeRng {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (state >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float in [min, max). */
export function range(rng: ArcadeRng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Integer in [min, max] inclusive. */
export function int(rng: ArcadeRng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Ephemeral run seed for real play (never persisted, never displayed). */
export function createRunSeed(): number {
  return (Date.now() % 2147483647) ^ ((Math.random() * 0xffffffff) >>> 0);
}
