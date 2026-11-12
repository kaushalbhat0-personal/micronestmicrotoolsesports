// D1 roster intake — normalization (PORT from legacy roster-builder normalize).
// Legacy: legacy/application/src/features/roster-builder/services/normalize.ts
// Adaptations: none to logic. Pure functions only.

const ZERO_WIDTH_RE = new RegExp("[\\u200b\\u200c\\u200d\\u2060\\uFEFF]", "g");
const CONTROL_RE = new RegExp("[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]", "g");
const WHITESPACE_RUN_RE = /\s+/g;

export function stripZeroWidth(value: string): string {
  return value.replace(ZERO_WIDTH_RE, "");
}

export function isBlank(value: string): boolean {
  return normalizeIdentity(value).length === 0;
}

export function normalizeIdentity(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .trim()
    .replace(WHITESPACE_RUN_RE, " ")
    .toLowerCase();
}

export function displayName(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH_RE, "")
    .replace(CONTROL_RE, "")
    .trim()
    .replace(WHITESPACE_RUN_RE, " ");
}
