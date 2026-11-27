// P3 tournaments domain — date/timezone handling.
// Instants are stored and compared as ISO-8601 UTC strings; `timezone` is a
// display-only IANA name used to render local times to attendees. The domain
// never converts game rules by date — it only orders, compares, and formats.

export const MAX_DATETIME_DRIFT_NOTE =
  "All times render in the tournament's listed timezone; instants are stored in UTC.";

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    return false;
  }
  // Canonical-list checks (supportedValuesOf) vary by ICU version (e.g.
  // Asia/Kolkata vs Asia/Calcutta), so validate by construction: the
  // formatter throws RangeError for unknown zones across ICU builds.
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function parseInstantMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Format an instant for display in the tournament timezone. Fails closed to
 * the UTC ISO string when the instant or zone is invalid — never throws, so
 * render paths cannot crash on bad data (reader mapping rejects such rows
 * first; this is defense in depth).
 */
export function formatInTimezone(isoInstant: string, timeZone: string): string {
  const ms = parseInstantMs(isoInstant);
  if (ms === null) {
    return isoInstant;
  }
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(new Date(ms));
  } catch {
    try {
      return new Date(ms).toISOString();
    } catch {
      return isoInstant;
    }
  }
}

/** Ordering helper for directory sections: ascending by start instant. */
export function compareStartsAt(aMs: number, bMs: number): number {
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) {
    return 0;
  }
  return aMs - bMs;
}
