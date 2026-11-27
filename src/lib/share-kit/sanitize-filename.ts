/** Safe download basename (no path separators or reserved characters). */
export function sanitizeFilename(raw: string, fallback = "fragix-share"): string {
  const trimmed = raw.trim().toLowerCase();
  const cleaned = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function pngFilename(base: string): string {
  return `${sanitizeFilename(base)}.png`;
}
