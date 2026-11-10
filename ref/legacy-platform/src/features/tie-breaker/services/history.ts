import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";
import { FREE_TIE_BREAKER_HISTORY_LIMIT } from "@/server/services/tie-breaker-policy";

/**
 * Tie-Breaker Resolver — History queries. Newest first, optional text
 * search (name or record number) and status filter. No pagination in V1.
 *
 * Free workspaces see every draft/active competition plus the latest
 * FREE_TIE_BREAKER_HISTORY_LIMIT locked official records (locked_at DESC).
 * Older locked rows stay stored — upgrade reveals them with no migration.
 * Paid workspaces see the full retained history.
 */

const historyQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "active", "locked"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export async function getHistory(
  supabase: SupabaseClient,
  organizationId: string,
  rawQuery: unknown = {},
  accessLevel: "paid" | "free" = "paid",
) {
  const query = parseOrThrow(historyQuerySchema, rawQuery ?? {});
  if (accessLevel !== "free") {
    const competitions = await compRepo.searchTieBreakerCompetitions(supabase, organizationId, {
      ...(query.search ? { search: query.search } : {}),
      ...(query.status ? { status: query.status } : {}),
      limit: query.limit,
    });
    return { competitions, total: competitions.length };
  }
  // Free: open competitions (draft/active, unlimited) + latest locked window.
  // Locked ordering is locked_at DESC — never created_at. The underlying
  // dataset is never truncated; the window is presentation-only.
  const [open, locked] = await Promise.all([
    compRepo.searchTieBreakerCompetitions(supabase, organizationId, {
      ...(query.search ? { search: query.search } : {}),
      limit: query.limit,
    }),
    compRepo.listLockedTieBreakerCompetitionsSince(supabase, organizationId, new Date(0).toISOString(), 100),
  ]);
  const term = query.search?.trim().toLowerCase();
  const visibleLocked = locked
    .filter((c) =>
      term
        ? c.name.toLowerCase().includes(term) || (c.record_number ?? "").toLowerCase().includes(term)
        : true,
    )
    .slice(0, FREE_TIE_BREAKER_HISTORY_LIMIT)
    .map((c) => c.id);
  const visibleLockedSet = new Set(visibleLocked);
  const competitions = open.filter((c) => {
    if (c.status !== "locked") return query.status ? c.status === query.status : true;
    if (query.status && query.status !== "locked") return false;
    return visibleLockedSet.has(c.id);
  });
  return { competitions, total: competitions.length };
}
