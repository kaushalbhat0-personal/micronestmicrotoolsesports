/**
 * Prize Payout Tracker — deadline display state (pure).
 *
 * Deadlines are calendar-date concepts stored as timestamptz at UTC
 * midnight. Display compares UTC calendar days only — no new timezone
 * system, no cron, no automatic state changes when a deadline passes.
 */

export type DeadlineState = "none" | "upcoming" | "due-today" | "overdue";

function toUtcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function deadlineState(deadline: string | null, now: Date = new Date()): DeadlineState {
  if (!deadline) return "none";
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return "none";
  const day = toUtcDayKey(parsed);
  const today = toUtcDayKey(now);
  if (day < today) return "overdue";
  if (day > today) return "upcoming";
  return "due-today";
}

/** Calendar-date label for public display (e.g. "20 Dec 2026"), UTC day granularity. */
export function formatDeadlineDate(deadline: string | null): string | null {
  if (!deadline) return null;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** Paid-date label at day granularity — never exact internal timestamps. */
export function formatPaidDate(paidAt: string | null): string | null {
  if (!paidAt) return null;
  const parsed = new Date(paidAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** Convert a YYYY-MM-DD date input to UTC-midnight ISO for storage. */
export function deadlineInputToIso(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00Z`).toISOString();
}

/** Masked reference display — the stored last-4, never more. */
export function formatMaskedReference(referenceLast4: string | null): string | null {
  if (!referenceLast4) return null;
  return `····${referenceLast4}`;
}
