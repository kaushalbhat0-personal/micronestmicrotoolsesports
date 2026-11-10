/**
 * Shared entity-name normalization for tracking joins.
 *
 * Game-agnostic: lowercase, de-apostrophed, whitespace-collapsed.
 * Adapters own game-specific canonicalization (aliases); this helper owns
 * only the final normalized form. No per-game logic lives here.
 */

/** Normalize entity text for tracking joins. Never throws. */
export function normalizeEntityName(name: string): string {
  if (typeof name !== "string") return "";
  return name
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
