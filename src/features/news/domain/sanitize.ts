// P4 News — sanitization (reimplemented from the archived Meta-Parser idea,
// no legacy runtime import).
//
// Legacy reference: legacy/application/src/features/meta-parser/
// services/sanitize.ts + services/safe-fetch.ts (plain-text sanitizer, HTTPS
// allowlist, size caps). Only the IDEAS are reused: strip markup, decode a
// small entity set, collapse whitespace, drop control characters, never
// render raw HTML. All logic below is new and dependency-free.
//
// Strategy: article bodies are structured blocks (see domain/article.ts),
// never HTML. Every block text passes through sanitizePlainText before
// storage validation AND before rendering (defense in depth).

const BASIC_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeBasicEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|nbsp);|&#39;/g, (match) => BASIC_ENTITIES[match] ?? match);
}

/**
 * Reduce arbitrary input to safe plain text:
 * - strips tags (<...>) entirely (no tag allowlist: nothing is rendered as HTML)
 * - decodes a small entity set (no script-capable decoding)
 * - removes control characters except \n and \t
 * - collapses whitespace runs
 * - trims and caps length
 */
export function sanitizePlainText(input: string, maxLength = 2000): string {
  const withoutTags = input.replace(/<[^>]*>/g, " ");
  const decoded = decodeBasicEntities(withoutTags);
  // biome-ignore lint: explicit control range is the intent.
  const withoutControls = decoded.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return withoutControls.replace(/[ \t]+\n/g, "\n").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

/** True when the value contains no angle-bracket markup at all. */
export function containsMarkup(value: string): boolean {
  return /<[^>]*>/.test(value);
}

/** HTTPS-only external URL check (no credentials, capped length). */
export function isSafeExternalUrl(value: unknown, maxLength = 2048): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > maxLength) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hostname !== ""
    );
  } catch {
    return false;
  }
}
