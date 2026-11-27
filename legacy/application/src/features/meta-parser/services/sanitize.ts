/**
 * Plain-text sanitizer for external patch-note content.
 *
 * Patch entries (verified Dota 2 corpus) embed HTML fragments such as
 * `<br>`, `<font color="...">`, `<span class="...">`, `<h2>`, `<table>`.
 * Everything persisted or shown to users must be plain text:
 *  1. strip HTML tags (block tags become a space so words never join),
 *  2. decode HTML entities,
 *  3. normalize whitespace,
 *  4. drop ASCII control characters.
 *
 * Never render source HTML directly. Never pass raw HTML to the LLM layer.
 */

const BLOCK_TAG_PATTERN = /<\/?(?:br|p|div|h[1-6]|li|ul|ol|tr|table|tbody|thead)\b[^>]*>/gi;
const ANY_TAG_PATTERN = /<[^>]*>/g;

const ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const code = Number.parseInt(digits, 10);
      if (!Number.isSafeInteger(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isSafeInteger(code) || code < 0 || code > 0x10ffff) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => ENTITY_MAP[name.toLowerCase()] ?? match);
}

/** Strip all HTML and return plain readable text. Never throws. */
export function sanitizePatchText(input: unknown): string {
  if (typeof input !== "string") return "";
  const withBreaks = input.replace(BLOCK_TAG_PATTERN, " ");
  const withoutTags = withBreaks.replace(ANY_TAG_PATTERN, "");
  const decoded = decodeEntities(withoutTags);
  const noControls = decoded.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return noControls.replace(/\s+/g, " ").trim().slice(0, 2000);
}

/** True when the raw string contains anything tag-like. Used for metrics only. */
export function containsMarkup(input: string): boolean {
  return /<[^>]*>/.test(input);
}
