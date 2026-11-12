/**
 * Normalization — comparison keys vs display values.
 *
 * Pure functions. No React, no Supabase, no browser APIs, no randomness.
 * Same input always produces the same output.
 *
 * Comparison (`normalizeIdentity`):
 *  1. Unicode NFC normalize (canonically equivalent sequences compare equal)
 *  2. Remove zero-width characters (U+200B–U+200D, U+2060, U+FEFF)
 *  3. Trim leading/trailing whitespace
 *  4. Collapse repeated whitespace to a single space
 *  5. Locale-independent lowercase (`toLowerCase`, never `toLocaleLowerCase`)
 *
 * Deliberately NOT done: stripping punctuation, accents/diacritics, or
 * numbers. `Viper-OP` !== `Viper OP`, `José` !== `Jose`, `Rogue2` !== `Rogue`.
 * Aggressive folding conflates distinct gamer tags — a P0 identity risk.
 *
 * Display (`displayName`): NFC + zero-width removal + control-character
 * removal + trim + collapse. Case and punctuation preserved. The display
 * value is what the organizer typed; the comparison key is what we match on.
 */

/** Zero-width characters that survive copy-paste from WhatsApp/Discord/Sheets. */
const ZERO_WIDTH_RE = /[\u200b\u200c\u200d\u2060\uFEFF]/g;

/** C0 controls + DEL. Tab/newline never reach here (lines are pre-split). */
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

/** Any whitespace run (space, tab, NBSP, etc.) collapses to one ASCII space. */
const WHITESPACE_RUN_RE = /\s+/g;

export function stripZeroWidth(value: string): string {
  return value.replace(ZERO_WIDTH_RE, "");
}

export function isBlank(value: string): boolean {
  return normalizeIdentity(value).length === 0;
}

/**
 * Comparison key. Empty string means "no identity" (missing team/player) —
 * never a matchable value.
 */
export function normalizeIdentity(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .trim()
    .replace(WHITESPACE_RUN_RE, " ")
    .toLowerCase();
}

/**
 * User-facing display value. Whitespace-collapsed and control-stripped for
 * safe rendering, but case/punctuation/diacritics/numbers untouched.
 */
export function displayName(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(CONTROL_RE, "")
    .trim()
    .replace(WHITESPACE_RUN_RE, " ");
}
