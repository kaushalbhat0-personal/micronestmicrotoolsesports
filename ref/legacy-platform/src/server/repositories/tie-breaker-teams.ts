import type { SupabaseClient } from "@supabase/supabase-js";

export interface TieBreakerTeamRow {
  id: string;
  competition_id: string;
  organization_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

const TEAM_COLUMNS = "id, competition_id, organization_id, name, short_name, logo_url, created_at, updated_at";

export async function createTieBreakerTeam(
  supabase: SupabaseClient,
  input: { competition_id: string; organization_id: string; name: string; short_name: string | null; logo_url: string | null },
): Promise<TieBreakerTeamRow> {
  const { data, error } = await supabase.from("tie_breaker_teams").insert(input).select(TEAM_COLUMNS).single();
  if (error) throw error;
  return data as TieBreakerTeamRow;
}

export async function listTieBreakerTeamsByCompetition(
  supabase: SupabaseClient,
  competitionId: string,
): Promise<TieBreakerTeamRow[]> {
  const { data, error } = await supabase
    .from("tie_breaker_teams")
    .select(TEAM_COLUMNS)
    .eq("competition_id", competitionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TieBreakerTeamRow[];
}

export async function countTieBreakerTeamsByCompetition(supabase: SupabaseClient, competitionId: string): Promise<number> {
  const res = await supabase
    .from("tie_breaker_teams")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  const count = (res as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

export async function findTieBreakerTeamById(supabase: SupabaseClient, id: string): Promise<TieBreakerTeamRow | null> {
  const { data, error } = await supabase.from("tie_breaker_teams").select(TEAM_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as TieBreakerTeamRow;
}

export async function updateTieBreakerTeam(
  supabase: SupabaseClient,
  id: string,
  patch: { name?: string; short_name?: string | null; logo_url?: string | null },
): Promise<TieBreakerTeamRow> {
  const { data, error } = await supabase.from("tie_breaker_teams").update(patch).eq("id", id).select(TEAM_COLUMNS).single();
  if (error) throw error;
  return data as TieBreakerTeamRow;
}

export async function deleteTieBreakerTeam(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tie_breaker_teams").delete().eq("id", id);
  if (error) throw error;
}
