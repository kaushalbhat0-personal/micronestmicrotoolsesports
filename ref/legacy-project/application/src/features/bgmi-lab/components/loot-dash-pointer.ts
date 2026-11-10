/**
 * Loot Dash pointer mapping — control-space touch lift, no gameplay.
 *
 * The simulation (`loot-dash-sim.ts`) is authoritative and already settles
 * the player ~26 logical px above the raw pointer. On touch screens that is
 * not enough: the fingertip occludes roughly a 40–60 CSS px contact area,
 * so the marker's lower half sits underneath the finger.
 *
 * This module maps the raw pointer into the pointer target the shell hands
 * to the sim. On coarse pointers (touch) it pre-applies an additional
 * upward lift; on fine pointers (mouse) the target is unchanged. Total
 * touch separation is therefore 26 (sim) + 30 (here) = 56 logical px,
 * which renders as ~48–56 CSS px on mobile canvas scales — inside the
 * 44–64 CSS px touch-visibility window.
 *
 * Pure mapping only: no speed, radius, scoring, spawn, or clamp changes.
 * Arena clamping still happens inside the sim, so a lifted target near the
 * top edge simply clamps the player to the normal boundary — the marker
 * stays visible and never leaves the arena.
 */

export const LOOT_DASH_TOUCH_LIFT_PX = 30;

/** Simulation-side offset, documented here so the total stays reviewable. */
export const LOOT_DASH_SIM_FOLLOW_OFFSET_PX = 26;

export interface LootPointerTarget {
  readonly x: number;
  readonly y: number;
}

/**
 * Map a raw logical pointer position to the sim's follow target.
 * X passes through untouched; Y lifts only for coarse (touch) pointers.
 */
export function resolveLootPointerTarget(
  pointer: LootPointerTarget,
  coarsePointer: boolean,
): LootPointerTarget {
  if (!coarsePointer) return { x: pointer.x, y: pointer.y };
  return { x: pointer.x, y: pointer.y - LOOT_DASH_TOUCH_LIFT_PX };
}
