import { validationError } from "@/lib/errors";
import type { PayoutTrackerStatus } from "../types";

/**
 * Prize Payout Tracker — minimal state machine.
 *
 * draft → published (via the quota-checked publish RPC, the only ceremony)
 * published → completed (derived: every recipient paid, set atomically by
 *   the recipient-status RPC — never a separate button)
 * completed → published (derived: any recipient back to pending)
 *
 * No unpublish workflow in V1: link lifecycle is publish → revoke (rotate).
 * No archived state: delete covers it. completed is never a permanent lock.
 */

const ALLOWED: Readonly<Record<PayoutTrackerStatus, ReadonlyArray<PayoutTrackerStatus>>> = {
  draft: ["published"],
  published: ["completed"],
  completed: ["published"],
};

export function canTransition(from: PayoutTrackerStatus, to: PayoutTrackerStatus): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export function assertTransition(from: PayoutTrackerStatus, to: PayoutTrackerStatus): void {
  if (!canTransition(from, to)) {
    throw validationError(`This tracker cannot move from ${from} to ${to} right now.`);
  }
}
