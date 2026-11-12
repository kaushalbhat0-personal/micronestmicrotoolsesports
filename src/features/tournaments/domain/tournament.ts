// P3 tournaments domain — lifecycle, status, formats (new vertical).
// Game-agnostic core: status derives from instants only, never from
// game-specific rules. Time parsing/validation lives in ./dates; money in
// ./money; organizers in ./organizer; registration in ./registration.

export const TOURNAMENT_STATUSES = ["upcoming", "ongoing", "completed"] as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export function isTournamentStatus(value: unknown): value is TournamentStatus {
  return typeof value === "string" && (TOURNAMENT_STATUSES as ReadonlyArray<string>).includes(value);
}

export const PARTICIPATION_FORMATS = ["team", "individual", "both"] as const;

export type ParticipationFormat = (typeof PARTICIPATION_FORMATS)[number];

export function isParticipationFormat(value: unknown): value is ParticipationFormat {
  return typeof value === "string" && (PARTICIPATION_FORMATS as ReadonlyArray<string>).includes(value);
}

export const LIFECYCLE_STATES = ["draft", "published", "unpublished"] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export function isLifecycleState(value: unknown): value is LifecycleState {
  return typeof value === "string" && (LIFECYCLE_STATES as ReadonlyArray<string>).includes(value);
}

/**
 * Derive public status from event instants. Pure: caller supplies `now`
 * (milliseconds) so tests and render paths stay deterministic.
 * - now < startsAt → upcoming
 * - startsAt <= now < endsAt → ongoing
 * - now >= endsAt → completed
 * Non-finite inputs fail closed to "completed" (never advertise a broken
 * listing as open). Callers must Zod-validate ISO strings before converting.
 */
export function deriveStatus(startsAtMs: number, endsAtMs: number, nowMs: number): TournamentStatus {
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || !Number.isFinite(nowMs)) {
    return "completed";
  }
  if (nowMs < startsAtMs) {
    return "upcoming";
  }
  if (nowMs < endsAtMs) {
    return "ongoing";
  }
  return "completed";
}

/**
 * Registration availability indicator. True only when the listing is
 * published, the event has not started, and the registration window (when
 * given) has not closed. Anything unknown fails closed to false.
 */
export function isRegistrationOpen(args: {
  lifecycle: LifecycleState;
  status: TournamentStatus;
  registrationClosesAtMs: number | null;
  nowMs: number;
}): boolean {
  if (args.lifecycle !== "published") {
    return false;
  }
  if (args.status !== "upcoming") {
    return false;
  }
  if (!Number.isFinite(args.nowMs)) {
    return false;
  }
  if (args.registrationClosesAtMs === null) {
    return true;
  }
  if (!Number.isFinite(args.registrationClosesAtMs)) {
    return false;
  }
  return args.nowMs < args.registrationClosesAtMs;
}
