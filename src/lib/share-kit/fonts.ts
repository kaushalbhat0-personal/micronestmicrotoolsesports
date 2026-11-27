// Best-effort font warm-up so canvas text uses the same faces as the app shell.
// Next/font registers Oswald/Geist under CSS variables on <html>; canvas must
// resolve those computed family names (not only the human "Oswald" label).

const FALLBACK_DISPLAY = 'Oswald, "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const FALLBACK_BODY = 'Geist, system-ui, -apple-system, "Segoe UI", sans-serif';

function readCssFontVar(varName: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value.length > 0 ? value : fallback;
}

/** Resolved at call time so Next/font hashed family names are used when present. */
export function resolveShareFontDisplay(): string {
  return readCssFontVar("--font-display", FALLBACK_DISPLAY);
}

export function resolveShareFontBody(): string {
  return readCssFontVar("--font-sans", FALLBACK_BODY);
}

/** @deprecated Prefer resolveShareFontDisplay() at draw time. */
export const SHARE_FONT_DISPLAY = FALLBACK_DISPLAY;
/** @deprecated Prefer resolveShareFontBody() at draw time. */
export const SHARE_FONT_BODY = FALLBACK_BODY;

export async function ensureShareFonts(timeoutMs = 2000): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }
  const display = resolveShareFontDisplay();
  const body = resolveShareFontBody();
  const primaryDisplay = display.split(",")[0]?.trim() || "Oswald";
  const primaryBody = body.split(",")[0]?.trim() || "Geist";
  const specs = [
    `700 64px ${primaryDisplay}`,
    `600 36px ${primaryDisplay}`,
    `500 28px ${primaryDisplay}`,
    `700 28px Oswald`,
    `400 28px ${primaryBody}`,
    `500 24px ${primaryBody}`,
    `400 22px Geist`,
  ];
  const loads = specs.map((spec) => document.fonts.load(spec).catch(() => undefined));
  await Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}
