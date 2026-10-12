/**
 * WhatsApp click-to-chat primitive (direct user sharing only).
 *
 * Builds official `wa.me/?text=` links that open WhatsApp / WhatsApp Web
 * with a message pre-filled. The user always chooses the recipient and
 * presses Send themselves — nothing is ever sent automatically.
 *
 * Domain-agnostic by design: this module knows nothing about prize pools,
 * teams, players, payouts, sponsors, drafts, or tie-breakers. Per-tool
 * message composers live in their feature services and pass plain strings
 * in here.
 *
 * Pure functions only. No network calls, no client storage, no tracking,
 * no recipient numbers, no user-agent branching.
 */

/** Conservative prefill budget (chars). Not a platform guarantee — keeps URLs short enough for browsers/apps. */
export const WHATSAPP_PREFILL_BUDGET = 1500;

/**
 * Build an official click-to-chat URL with the message pre-filled.
 * Encodes exactly once via encodeURIComponent: Unicode, emoji, line
 * breaks (%0A), and & # ? % + (notably + → %2B) all survive. Never
 * hand-rolls replacements, never double-encodes, never uses form-style
 * `+`-for-space. No phone number is appended — the user picks the
 * recipient/group inside WhatsApp.
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export interface TruncatedShareText {
  readonly text: string;
  readonly truncated: boolean;
}

/**
 * Bound a share body to maxChars. Returns the input untouched when it
 * fits. Otherwise cuts at the last line break (or space) within budget so
 * words/lines are not split mid-token, falling back to a hard cut only
 * when no boundary exists. Callers append their own explicit continuation
 * marker (e.g. a share URL or a "full list in CSV" note) — this helper
 * never invents one, so a shortened message can never look complete.
 */
export function truncateForShare(text: string, maxChars: number): TruncatedShareText {
  if (maxChars <= 0) return { text: "", truncated: text.length > 0 };
  if (text.length <= maxChars) return { text, truncated: false };
  const head = text.slice(0, maxChars);
  const boundary = Math.max(head.lastIndexOf("\n"), head.lastIndexOf(" "));
  const cut = boundary > 0 ? head.slice(0, boundary) : head;
  return { text: cut.replace(/\s+$/u, ""), truncated: true };
}

/**
 * Placement helper for tools with an existing public share URL: body,
 * blank line, URL on its own final line. The URL is embedded verbatim —
 * the whole message is encoded once by buildWhatsAppShareUrl.
 */
export function appendPublicUrl(body: string, url: string): string {
  return `${body}\n\nView online: ${url}`;
}
