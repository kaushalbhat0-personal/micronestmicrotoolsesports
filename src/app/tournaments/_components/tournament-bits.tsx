// Shared tournament presentation bits: status badge, fee/prize lines, and
// the registration availability indicator. Display-only; all values arrive
// as typed card props — nothing invented, nothing fetched here.

import type { PublicTournamentCard } from "@/features/tournaments/domain/public-card";
import { formatInTimezone } from "@/features/tournaments/domain/dates";
import { formatEntryFee, formatPrizePool } from "@/features/tournaments/domain/money";
import { isRegistrationOpen } from "@/features/tournaments/domain/tournament";
import { getGameByKey } from "@/lib/game-catalog/catalog";

const statusStyles: Record<string, string> = {
  upcoming: "bg-emerald-100 text-emerald-900",
  ongoing: "bg-amber-100 text-amber-900",
  completed: "bg-slate-100 text-slate-600",
};

export function gameDisplayName(gameKey: string): string {
  // Display-only resolution: unknown keys render raw (the reader fails
  // unknown filter values closed to zero rows instead).
  return getGameByKey(gameKey)?.shortName ?? gameKey;
}

export function TournamentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles["completed"] ?? ""}`}
    >
      {status}
    </span>
  );
}

export function TournamentDates({ card }: { card: PublicTournamentCard }) {
  return (
    <p className="mt-1 text-sm text-slate-700">
      {formatInTimezone(card.starts_at, card.timezone)}
      {" — "}
      {formatInTimezone(card.ends_at, card.timezone)}{" "}
      <span className="text-slate-500">({card.timezone})</span>
    </p>
  );
}

export function TournamentMoney({ card }: { card: PublicTournamentCard }) {
  return (
    <p className="mt-1 text-sm text-slate-700">
      <span className="font-medium">{formatEntryFee(card.entry_fee)}</span>
      {" · "}
      Prize pool: <span className="font-medium">{formatPrizePool(card.prize_pool)}</span>
    </p>
  );
}

export function RegistrationIndicator({ card, nowMs }: { card: PublicTournamentCard; nowMs: number }) {
  const open = isRegistrationOpen({
    lifecycle: card.lifecycle,
    status: card.status,
    registrationClosesAtMs:
      card.registration_closes_at === null ? null : Date.parse(card.registration_closes_at),
    nowMs,
  });
  if (card.registration_url === null) {
    return (
      <span className="inline-block rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
        Registration details inside
      </span>
    );
  }
  return open ? (
    <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
      Registration open
    </span>
  ) : (
    <span className="inline-block rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
      Registration closed
    </span>
  );
}
