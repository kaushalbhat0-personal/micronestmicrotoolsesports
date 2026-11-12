/**
 * Structure-preserving HTML → text lines for LoL articles.
 *
 * Same shape contract as the VALORANT helper (block structure to line
 * breaks FIRST, then the shared sanitizer per line), plus quote tracking:
 * Riot wraps the TL;DR intro and per-entity designer notes in
 * `<blockquote>`. Quote lines are never facts; pre-section intro quotes
 * feed scoped TL;DR polarity, everything else quoted is dropped by the
 * parser. No parsing decisions live here — only shape preservation.
 */

import { sanitizePatchText } from "../../services/sanitize";

export interface LolLine {
  /** List nesting depth (0 = top-level bullet or heading). */
  readonly depth: number;
  /** Sanitized plain text (never empty). */
  readonly text: string;
  /** True for heading lines (h1-h6). */
  readonly heading: boolean;
  /** Heading level 1-6 when `heading` is true (absent for text lines). */
  readonly level?: number;
  /** True for lines inside a blockquote (intro/designer notes). */
  readonly quote: boolean;
}

const TOKEN_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>|([^<]+)/g;

const BLOCK_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "div",
  "section",
  "article",
  "blockquote",
  "br",
  "tr",
  "header",
]);

function isListTag(tag: string): boolean {
  return tag === "ul" || tag === "ol";
}

/** Convert raw article HTML to structured sanitized lines. Never throws. */
export function htmlToLines(html: string): LolLine[] {
  if (typeof html !== "string" || html === "") return [];
  interface Pending {
    depth: number;
    heading: boolean;
    level?: number;
    quote: boolean;
    parts: string[];
  }
  const lines: LolLine[] = [];
  let listDepth = 0;
  let quoteDepth = 0;
  let current: Pending | null = null;

  const flush = (): void => {
    if (current === null) return;
    const clean = sanitizePatchText(current.parts.join(" "));
    if (clean !== "") {
      lines.push({
        depth: current.depth,
        text: clean,
        heading: current.heading,
        quote: current.quote,
        ...(current.level !== undefined ? { level: current.level } : {}),
      });
    }
    current = null;
  };

  TOKEN_PATTERN.lastIndex = 0;
  let token: RegExpExecArray | null;
  while ((token = TOKEN_PATTERN.exec(html)) !== null) {
    const tag = token[1]?.toLowerCase();
    const text = token[2];
    if (tag !== undefined) {
      const closing = html[token.index + 1] === "/";
      if (!closing && isListTag(tag)) {
        listDepth += 1;
      } else if (closing && isListTag(tag)) {
        listDepth = Math.max(0, listDepth - 1);
      } else if (!closing && tag === "blockquote") {
        flush();
        quoteDepth += 1;
        current = { depth: 0, heading: false, quote: true, parts: [] };
      } else if (closing && tag === "blockquote") {
        flush();
        quoteDepth = Math.max(0, quoteDepth - 1);
      } else if (!closing && tag === "li") {
        flush();
        current = { depth: Math.max(0, listDepth - 1), heading: false, quote: quoteDepth > 0, parts: [] };
      } else if (closing && tag === "li") {
        flush();
      } else if (!closing && tag.startsWith("h") && tag.length === 2) {
        flush();
        const level = Number(tag.slice(1));
        current = {
          depth: 0,
          heading: true,
          quote: false,
          parts: [],
          ...(level >= 1 && level <= 6 ? { level } : {}),
        };
      } else if (closing && tag.startsWith("h") && tag.length === 2) {
        flush();
      } else if (!closing && BLOCK_TAGS.has(tag)) {
        flush();
        current = { depth: 0, heading: false, quote: quoteDepth > 0, parts: [] };
      } else if (closing && (BLOCK_TAGS.has(tag) || tag === "li")) {
        flush();
      }
      // Inline tags (strong, em, a, span, img) contribute no boundaries.
    } else if (text !== undefined) {
      if (current === null) {
        current = { depth: 0, heading: false, quote: quoteDepth > 0, parts: [] };
      }
      current.parts.push(text);
    }
  }
  flush();
  return lines;
}

/** Join structured lines back to plain article text (one line per row). Never throws. */
export function linesToText(lines: readonly LolLine[]): string {
  return lines.map((line) => line.text).join("\n");
}
