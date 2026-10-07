import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import * as compRepo from "@/server/repositories/tie-breaker-competitions";

/**
 * Tie-Breaker Resolver — History queries. Newest first, optional text
 * search (name or record number) and status filter. No pagination in V1.
 */

const historyQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "active", "locked"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type HistoryQuery = z.infer<typeof historyQuerySchema>;

export async function getHistory(supabase: SupabaseClient, organizationId: string, rawQuery: unknown = {}) {
  const query = parseOrThrow(historyQuerySchema, rawQuery ?? {});
  const competitions = await compRepo.searchTieBreakerCompetitions(supabase, organizationId, {
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
    limit: query.limit,
  });
  return { competitions, total: competitions.length };
}
