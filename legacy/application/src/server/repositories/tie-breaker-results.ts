import type { SupabaseClient } from "@supabase/supabase-js";

export type TieBreakerWinner = "team_a" | "team_b" | "draw";

export interface TieBreakerResultRow {
  id: string;
  competition_id: string;
  organization_id: string;
  team_a_id: string;
  team_b_id: string;
  winner: TieBreakerWinner | null;
  maps_a: number | null;
  maps_b: number | null;
  rounds_a: number | null;
  rounds_b: number | null;
  played_at: string | null;
  notes: string | null;
  is_complete: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CreateTieBreakerResultInput = {
  competition_id: string;
  organization_id: string;
  created_by: string;
  team_a_id: string;
  team_b_id: string;
  winner: TieBreakerWinner | null;
  maps_a: number | null;
  maps_b: number | null;
  rounds_a: number | null;
  rounds_b: number | null;
  played_at: string | null;
  notes: string | null;
  is_complete: boolean;
};

const RESULT_COLUMNS =
  "id, competition_id, organization_id, team_a_id, team_b_id, winner, maps_a, maps_b, rounds_a, rounds_b, played_at, notes, is_complete, created_by, created_at, updated_at";

export async function createTieBreakerResult(
  supabase: SupabaseClient,
  input: CreateTieBreakerResultInput,
): Promise<TieBreakerResultRow> {
  const { data, error } = await supabase.from("tie_breaker_results").insert(input).select(RESULT_COLUMNS).single();
  if (error) throw error;
  return data as TieBreakerResultRow;
}

export async function listTieBreakerResultsByCompetition(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<TieBreakerResultRow[]> {
  const { data, error } = await supabase
    .from("tie_breaker_results")
    .select(RESULT_COLUMNS)
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TieBreakerResultRow[];
}

export async function countCompleteTieBreakerResults(supabase: SupabaseClient, competitionId: string): Promise<number> {
  const res = await supabase
    .from("tie_breaker_results")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("is_complete", true);
  const count = (res as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

/** Existing results between the same pair (either direction) — duplicate-pair warning source. */
export async function findTieBreakerResultsByPair(
  supabase: SupabaseClient,
  competitionId: string,
  teamAId: string,
  teamBId: string,
): Promise<TieBreakerResultRow[]> {
  const { data, error } = await supabase
    .from("tie_breaker_results")
    .select(RESULT_COLUMNS)
    .eq("competition_id", competitionId)
    .or(`and(team_a_id.eq.${teamAId},team_b_id.eq.${teamBId}),and(team_a_id.eq.${teamBId},team_b_id.eq.${teamAId})`);
  if (error) throw error;
  return (data ?? []) as TieBreakerResultRow[];
}

export async function findTieBreakerResultById(
  supabase: SupabaseClient,
  id: string,
): Promise<TieBreakerResultRow | null> {
  const { data, error } = await supabase.from("tie_breaker_results").select(RESULT_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as TieBreakerResultRow;
}

export type UpdateTieBreakerResultPatch = {
  team_a_id?: string;
  team_b_id?: string;
  winner?: TieBreakerWinner | null;
  maps_a?: number | null;
  maps_b?: number | null;
  rounds_a?: number | null;
  rounds_b?: number | null;
  played_at?: string | null;
  notes?: string | null;
  is_complete?: boolean;
};

export async function updateTieBreakerResult(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateTieBreakerResultPatch,
): Promise<TieBreakerResultRow> {
  const { data, error } = await supabase.from("tie_breaker_results").update(patch).eq("id", id).select(RESULT_COLUMNS).single();
  if (error) throw error;
  return data as TieBreakerResultRow;
}

export async function deleteTieBreakerResult(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tie_breaker_results").delete().eq("id", id);
  if (error) throw error;
}
