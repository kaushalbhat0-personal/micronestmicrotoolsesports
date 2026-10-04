export const APP_TIMEZONE = "Asia/Kolkata" as const;

/**
 * Returns UTC ISO strings for start and end of "today" in APP_TIMEZONE (Asia/Kolkata).
 * Kolkata is fixed UTC+5:30, no DST. Start is 00:00 IST, end is next 00:00 IST.
 */
export function getKolkataTodayRange(now = new Date()): { start: string; end: string } {
  const kolkataDate = now.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }); // YYYY-MM-DD
  const start = new Date(`${kolkataDate}T00:00:00.000+05:30`).toISOString();
  // next day
  const nextDay = new Date(new Date(`${kolkataDate}T00:00:00.000+05:30`).getTime() + 24 * 60 * 60 * 1000);
  const nextDateStr = nextDay.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const end = new Date(`${nextDateStr}T00:00:00.000+05:30`).toISOString();
  return { start, end };
}

/**
 * Authoritative date-time formatter — always Asia/Kolkata.
 * Use for all customer-facing timestamps. Stored UTC → display IST.
 * Never rely on browser local timezone.
 */
export function formatDateTimeKolkata(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIMEZONE,
      timeZoneName: "short",
    }).format(d);
  } catch {
    return String(value);
  }
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(d);
}

export function formatRelativeTime(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}
