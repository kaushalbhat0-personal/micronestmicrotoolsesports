import type { SupabaseClient } from "@supabase/supabase-js";

export type TieBreakerStatus = "draft" | "active" | "locked";

export interface TieBreakerCompetitionRow {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  status: TieBreakerStatus;
  scoring_win: number;
  scoring_draw: number;
  scoring_loss: number;
  draws_enabled: boolean;
  round_label: "rounds" | "games";
  rule_order: string[];
  preset_ref: string | null;
  share_token: string;
  record_number: string | null;
  locked_at: string | null;
  locked_snapshot: Record<string, unknown> | null;
  cloned_from: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateTieBreakerCompetitionInput = {
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  scoring_win: number;
  scoring_draw: number;
  scoring_loss: number;
  draws_enabled: boolean;
  round_label: "rounds" | "games";
  rule_order: string[];
  preset_ref: string | null;
  cloned_from: string | null;
};

const COMPETITION_COLUMNS =
  "id, organization_id, created_by, name, description, status, scoring_win, scoring_draw, scoring_loss, draws_enabled, round_label, rule_order, preset_ref, share_token, record_number, locked_at, locked_snapshot, cloned_from, created_at, updated_at";

export async function createTieBreakerCompetition(
  supabase: SupabaseClient,
  input: CreateTieBreakerCompetitionInput,
): Promise<TieBreakerCompetitionRow> {
  const { data, error } = await supabase
    .from("tie_breaker_competitions")
    .insert({
      organization_id: input.organization_id,
      created_by: input.created_by,
      name: input.name,
      description: input.description,
      scoring_win: input.scoring_win,
      scoring_draw: input.scoring_draw,
      scoring_loss: input.scoring_loss,
      draws_enabled: input.draws_enabled,
      round_label: input.round_label,
      rule_order: input.rule_order,
      preset_ref: input.preset_ref,
      cloned_from: input.cloned_from,
    })
    .select(COMPETITION_COLUMNS)
    .single();
  if (error) throw error;
  return data as TieBreakerCompetitionRow;
}

export async function findTieBreakerCompetitionById(
  supabase: SupabaseClient,
  id: string,
): Promise<TieBreakerCompetitionRow | null> {
  const { data, error } = await supabase.from("tie_breaker_competitions").select(COMPETITION_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as TieBreakerCompetitionRow;
}

export async function listTieBreakerCompetitionsByOrg(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50,
): Promise<TieBreakerCompetitionRow[]> {
  const { data, error } = await supabase
    .from("tie_breaker_competitions")
    .select(COMPETITION_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TieBreakerCompetitionRow[];
}

export async function countTieBreakerCompetitionsByOrg(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const res = await supabase
    .from("tie_breaker_competitions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  const count = (res as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

export async function allocateTieBreakerRecordNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("tie_breaker_next_ref");
  if (error) throw error;
  return data as string;
}

/**
 * Atomic lock: single UPDATE guarded by status. Returns null when the row is
 * already locked (or missing) so the service can return the locked record
 * idempotently instead of tripping the immutability guard.
 */
export async function lockTieBreakerCompetition(
  supabase: SupabaseClient,
  input: { id: string; recordNumber: string; lockedAt: string; snapshot: Record<string, unknown> },
): Promise<TieBreakerCompetitionRow | null> {
  const { data, error } = await supabase
    .from("tie_breaker_competitions")
    .update({
      status: "locked" as TieBreakerStatus,
      record_number: input.recordNumber,
      locked_at: input.lockedAt,
      locked_snapshot: input.snapshot,
    })
    .eq("id", input.id)
    .neq("status", "locked")
    .select(COMPETITION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return (data as TieBreakerCompetitionRow | null) ?? null;
}

export type UpdateTieBreakerCompetitionPatch = {
  name?: string;
  description?: string | null;
  status?: TieBreakerStatus;
  scoring_win?: number;
  scoring_draw?: number;
  scoring_loss?: number;
  draws_enabled?: boolean;
  round_label?: "rounds" | "games";
  rule_order?: string[];
  preset_ref?: string | null;
};

/** Pre-lock configuration edits and draft→active promotion. Locked rows are rejected by the DB guard. */
export async function updateTieBreakerCompetition(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateTieBreakerCompetitionPatch,
): Promise<TieBreakerCompetitionRow> {
  const { data, error } = await supabase
    .from("tie_breaker_competitions")
    .update(patch)
    .eq("id", id)
    .select(COMPETITION_COLUMNS)
    .single();
  if (error) throw error;
  return data as TieBreakerCompetitionRow;
}

export interface TieBreakerHistoryQuery {
  search?: string;
  status?: TieBreakerStatus;
  limit?: number;
}

/** Newest-first history with optional name/record-number search and status filter. */
export async function searchTieBreakerCompetitions(
  supabase: SupabaseClient,
  organizationId: string,
  query: TieBreakerHistoryQuery = {},
): Promise<TieBreakerCompetitionRow[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  let builder = supabase
    .from("tie_breaker_competitions")
    .select(COMPETITION_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (query.status) builder = builder.eq("status", query.status);
  const term = query.search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,\\]/g, (c) => `\\${c}`);
    builder = builder.or(`name.ilike.%${escaped}%,record_number.ilike.%${escaped}%`);
  }
  const { data, error } = await builder;
  if (error) throw error;
  return (data ?? []) as TieBreakerCompetitionRow[];
}

export async function deleteTieBreakerCompetition(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tie_breaker_competitions").delete().eq("id", id);
  if (error) throw error;
}
