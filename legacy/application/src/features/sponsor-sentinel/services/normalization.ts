export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeHashtag(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, "");
  if (trimmed.length === 0) return "#";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function normalizeHashtagForTitle(value: string): string {
  return normalizeHashtag(value);
}

export function normalizeCategoryId(value: string): string {
  return value.trim();
}

export function normalizeTagValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseTwitchDurationToSeconds(raw: string): number | null {
  if (!raw) return null;
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const hours = match[1] !== undefined ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0;
  const seconds = match[3] !== undefined ? Number.parseInt(match[3], 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  if (hours === 0 && minutes === 0 && seconds === 0 && raw !== "0s") {
    // empty match like "" would have been caught earlier
    if (raw !== "0h0m0s" && raw !== "0m0s" && raw !== "0h") return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseYouTubeDurationToSeconds(raw: string): number | null {
  if (!raw) return null;
  const match = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = match[1] !== undefined ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0;
  const seconds = match[3] !== undefined ? Number.parseInt(match[3], 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function durationSecondsToMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}
