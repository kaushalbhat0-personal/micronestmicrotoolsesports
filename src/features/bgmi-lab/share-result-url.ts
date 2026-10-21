/**
 * BGMI Lab result-aware share URLs — pure, no React, no browser APIs.
 *
 * Encodes a completed-run score as a display-only `?result=S-T` query
 * parameter on top of the canonical game URL. The payload is a UX
 * challenge hint for the recipient only: it must never be treated as
 * authoritative scoring, ranking, reward, or entitlement data.
 *
 * Fail-closed by design: malformed, out-of-range, or cross-game payloads
 * parse to null and the caller renders a plain direct visit.
 */

export interface LabSharedResult {
  readonly score: number;
  readonly total: number;
}

/** Hard bound on raw payload length — rejects pasted blobs, not real scores. */
const MAX_RESULT_RAW_LENGTH = 16;

/**
 * Build the shareable URL for a completed run: canonical game URL plus
 * `?result=S-T`. Returns the canonical URL unchanged when the caller's
 * own score is somehow invalid (sender side is always valid in practice).
 * Never appends tracking parameters; preserves no existing query except
 * by `&` when one is already present.
 */
export function buildLabResultShareUrl(canonicalUrl: string, score: number, total: number): string {
  if (
    !Number.isInteger(score) ||
    !Number.isInteger(total) ||
    total <= 0 ||
    score < 0 ||
    score > total
  ) {
    return canonicalUrl;
  }
  const separator = canonicalUrl.includes("?") ? "&" : "?";
  return `${canonicalUrl}${separator}result=${score}-${total}`;
}

/**
 * Strictly parse a raw `result` param value. `expectedTotal` is the
 * rendering game's own total (8 Circle IQ, 5 Rotation Replay, 6
 * Tournament Scenario Generator) — a payload total that does not match
 * is a cross-game paste and returns null.
 */
export function parseLabSharedResult(raw: unknown, expectedTotal: number): LabSharedResult | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RESULT_RAW_LENGTH) return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (!match) return null;
  const score = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(score) || !Number.isInteger(total)) return null;
  if (!Number.isInteger(expectedTotal) || expectedTotal <= 0) return null;
  if (total !== expectedTotal) return null;
  if (score < 0 || score > total) return null;
  return { score, total };
}

/**
 * Parse the `result` param out of a location search string
 * (`window.location.search`). Returns null for missing, malformed, or
 * overlong input — never throws.
 */
export function parseLabSharedResultFromSearch(
  search: string,
  expectedTotal: number
): LabSharedResult | null {
  if (typeof search !== "string" || search.length > 2048) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  return parseLabSharedResult(params.get("result"), expectedTotal);
}
