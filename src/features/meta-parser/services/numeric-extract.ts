/**
 * Deterministic numeric-transition extraction from plain-text patch entries.
 *
 * Supported (verified against the Dota 2 corpus):
 * - "increased|decreased|reduced|changed|rescaled|improved from X to Y"
 * - "OLD: X" / "NEW: Y" formula lines (kept as text; never forced scalar)
 * - integers, decimals, percentages, slash-separated level values, seconds
 *
 * Formulas are preserved as `oldText/newText` with null numerics — the
 * caller must not pretend a formula is a scalar value.
 */

export interface NumericTransition {
  readonly oldText: string | null;
  readonly newText: string | null;
  readonly oldNumeric: number | null;
  readonly newNumeric: number | null;
  /** True when both endpoints are plain scalars (not slash-lists/formulas). */
  readonly scalar: boolean;
}

const FROM_TO_PATTERN =
  /\b(?:increased|decreased|reduced|changed|rescaled|improved|adjusted)\s+from\s+(.+?)\s+to\s+(.+?)(?:\.|$)/i;

const OLD_PATTERN = /\bOLD:\s*([\s\S]+?)(?:\s*NEW:|$)/i;
const NEW_PATTERN = /\bNEW:\s*([\s\S]+?)$/i;

function toScalarNumber(raw: string): number | null {
  const cleaned = raw.replace(/%/g, "").replace(/s(ec(ond)?s?)?$/i, "").trim();
  if (cleaned === "" || /[/()+*a-zA-Z]/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function splitEndpoints(oldRaw: string, newRaw: string): NumericTransition {
  const oldText = oldRaw.trim().slice(0, 300);
  const newText = newRaw.trim().replace(/\.$/, "").trim().slice(0, 300);
  const oldNumeric = toScalarNumber(oldText);
  const newNumeric = toScalarNumber(newText);
  return {
    oldText,
    newText,
    oldNumeric,
    newNumeric,
    scalar: oldNumeric !== null && newNumeric !== null,
  };
}

const EMPTY_TRANSITION: NumericTransition = {
  oldText: null,
  newText: null,
  oldNumeric: null,
  newNumeric: null,
  scalar: false,
};

/** Extract the first explicit from→to (or OLD/NEW) transition. Never throws. */
export function extractTransition(text: string): NumericTransition {
  if (typeof text !== "string" || text === "") return EMPTY_TRANSITION;
  const fromTo = FROM_TO_PATTERN.exec(text);
  if (fromTo?.[1] !== undefined && fromTo[2] !== undefined) {
    return splitEndpoints(fromTo[1], fromTo[2]);
  }
  const oldMatch = OLD_PATTERN.exec(text);
  const newMatch = NEW_PATTERN.exec(text);
  if (oldMatch?.[1] !== undefined && newMatch?.[1] !== undefined) {
    return { ...splitEndpoints(oldMatch[1], newMatch[1]), scalar: false };
  }
  return EMPTY_TRANSITION;
}
