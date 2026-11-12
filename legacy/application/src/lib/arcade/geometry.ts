/**
 * Arcade geometry helpers — pure collision math for interactive Lab games.
 *
 * Small tested primitives only. No physics engine, no timestep system, no
 * broadphase: Loot Dash-scale games have a handful of entities and check
 * circle overlap directly each frame.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** True when two circles overlap (touching counts as a hit for pickups). */
export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const r = ar + br;
  return distSq(ax, ay, bx, by) <= r * r;
}

/**
 * Backing-store size for a displayed CSS box at a bounded DPR.
 * The logical aspect is preserved exactly: height always derives from the
 * width via logicalHeight/logicalWidth, never from a clamped element box.
 */
export function arcadeBackingSize(
  cssWidth: number,
  logicalWidth: number,
  logicalHeight: number,
  devicePixelRatio: number | undefined,
): { readonly width: number; readonly height: number } {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(((cssWidth * logicalHeight) / logicalWidth) * dpr));
  return { width, height };
}

/**
 * Map a client pointer position into logical arena coordinates.
 * Returns NaN coordinates for degenerate rects so callers can no-op.
 */
export function toLogicalCoords(
  rect: { readonly width: number; readonly height: number; readonly left?: number; readonly top?: number },
  logicalWidth: number,
  logicalHeight: number,
  clientX: number,
  clientY: number,
): { readonly x: number; readonly y: number } {
  const left = rect.left ?? 0;
  const top = rect.top ?? 0;
  if (!(rect.width > 0) || !(rect.height > 0)) return { x: Number.NaN, y: Number.NaN };
  return {
    x: ((clientX - left) / rect.width) * logicalWidth,
    y: ((clientY - top) / rect.height) * logicalHeight,
  };
}
