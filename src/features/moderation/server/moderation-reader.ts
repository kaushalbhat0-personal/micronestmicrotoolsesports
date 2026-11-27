// Moderation queue reader (P10) — DISABLED SHELL.
// The review queue requires a proven moderator authorization boundary
// (P10-04: platform_admins via is_super_admin + an approved queue
// retention/visibility rule). That boundary does not exist yet, so there is
// no operational reader: every function validates its input shape and then
// throws the disabled error before any table touch.
//
// Why a shell instead of a reader:
// - Listing reports without an authorization boundary would leak reporter
//   identity and private report details to ordinary users.
// - The queue tables themselves do not exist (no P10 migration is applied;
//   see docs deferred-decisions). A reader against missing tables could only
//   fake results or crash — both are worse than an honest disabled state.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAppUser } from "@/features/player-profile/server/ensure-app-user";
import { ModerationWriteDisabledError, ReportOperationError } from "../domain/report";

export interface QueuedReport {
  readonly id: string;
  readonly entityType: "tournament" | "organizer";
  readonly entitySlug: string;
  readonly category: string;
  readonly status: string;
  readonly createdAt: string;
}

export async function listQueuedReports(client: SupabaseClient): Promise<QueuedReport[]> {
  await ensureAppUser(client);
  // No moderator boundary is proven; the queue must not be listed.
  throw new ModerationWriteDisabledError();
}

export async function getQueuedReport(
  client: SupabaseClient,
  reportId: unknown
): Promise<QueuedReport | null> {
  await ensureAppUser(client);
  if (typeof reportId !== "string" || reportId.trim() === "") {
    throw new ReportOperationError();
  }
  // No moderator boundary is proven; report details must not be served.
  throw new ModerationWriteDisabledError();
}
