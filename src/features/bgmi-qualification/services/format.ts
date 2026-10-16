/**
 * Display-layer number formatting for projected totals.
 *
 * The calculation engine in `scoring.ts` intentionally keeps raw
 * deterministic numeric values (e.g. `42 + 0.1 * 3` is
 * `42.300000000000004` in IEEE-754). That is correct for math but
 * inappropriate for a user-facing points calculator, so the UI and the
 * share route must render those values through this helper.
 *
 * Display only: never feed the formatted string back into scoring,
 * verdict comparison, or share-state encoding.
 */
export function formatPoints(value: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return String(value);
  const snapped = Number(value.toPrecision(12));
  if (!Number.isFinite(snapped)) return String(value);
  if (Number.isInteger(snapped)) return String(snapped);
  let text = String(snapped);
  // Defensive: normal users must never see scientific notation.
  if (/[eE]/.test(text)) {
    text = snapped.toFixed(6).replace(/\.?0+$/, "");
  }
  return text;
}
