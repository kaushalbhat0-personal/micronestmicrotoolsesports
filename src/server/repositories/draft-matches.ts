import type { SupabaseClient } from "@supabase/supabase-js";

export type DraftMatchStatus = "in_progress" | "completed" | "abandoned";

export interface DraftMatchRow {
  id: string;
  organization_id: string;
  created_by: string;
  ref_code: string;
  match_name: string | null;
  event_name: string | null;
  format_label: string | null;
  notes: string | null;
  team_a: string;
  team_b: string;
  template_id: string | null;
  sequence: Array<{ team: "A" | "B"; type: "ban" | "pick" }>;
  pool: string[];
  actions: Array<{ stepIndex: number; team: "A" | "B"; type: "ban" | "pick"; item: string; at: string }>;
  status: DraftMatchStatus;
  share_token: string;
  cloned_from: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateDraftMatchInput = {
  organization_id: string;
  created_by: string;
  match_name: string | null;
  event_name: string | null;
  format_label: string | null;
  notes: string | null;
  team_a: string;
  team_b: string;
  template_id: string | null;
  sequence: DraftMatchRow["sequence"];
  pool: string[];
  cloned_from: string | null;
};

const MATCH_COLUMNS =
  "id, organization_id, created_by, ref_code, match_name, event_name, format_label, notes, team_a, team_b, template_id, sequence, pool, actions, status, share_token, cloned_from, completed_at, created_at, updated_at";

export async function createDraftMatch(supabase: SupabaseClient, input: CreateDraftMatchInput): Promise<DraftMatchRow> {
  const { data, error } = await supabase
    .from("draft_matches")
    .insert({
      organization_id: input.organization_id,
      created_by: input.created_by,
      match_name: input.match_name,
      event_name: input.event_name,
      format_label: input.format_label,
      notes: input.notes,
      team_a: input.team_a,
      team_b: input.team_b,
      template_id: input.template_id,
      sequence: input.sequence,
      pool: input.pool,
      cloned_from: input.cloned_from,
    })
    .select(MATCH_COLUMNS)
    .single();
  if (error) throw error;
  return data as DraftMatchRow;
}

export async function findDraftMatchById(supabase: SupabaseClient, id: string): Promise<DraftMatchRow | null> {
  const { data, error } = await supabase.from("draft_matches").select(MATCH_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as DraftMatchRow;
}

export async function listDraftMatchesByOrg(supabase: SupabaseClient, organizationId: string, limit = 50): Promise<DraftMatchRow[]> {
  const { data, error } = await supabase
    .from("draft_matches")
    .select(MATCH_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DraftMatchRow[];
}

export async function countDraftMatchesByOrg(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const res = await supabase.from("draft_matches").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const count = (res as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

export async function appendDraftAction(
  supabase: SupabaseClient,
  id: string,
  actions: DraftMatchRow["actions"],
): Promise<DraftMatchRow> {
  const { data, error } = await supabase.from("draft_matches").update({ actions }).eq("id", id).select(MATCH_COLUMNS).single();
  if (error) throw error;
  return data as DraftMatchRow;
}

export async function finalizeDraftMatch(supabase: SupabaseClient, id: string, completedAt: string): Promise<DraftMatchRow> {
  const { data, error } = await supabase
    .from("draft_matches")
    .update({ status: "completed" as DraftMatchStatus, completed_at: completedAt })
    .eq("id", id)
    .select(MATCH_COLUMNS)
    .single();
  if (error) throw error;
  return data as DraftMatchRow;
}

export async function abandonDraftMatch(supabase: SupabaseClient, id: string): Promise<DraftMatchRow> {
  const { data, error } = await supabase
    .from("draft_matches")
    .update({ status: "abandoned" as DraftMatchStatus })
    .eq("id", id)
    .select(MATCH_COLUMNS)
    .single();
  if (error) throw error;
  return data as DraftMatchRow;
}

export async function deleteDraftMatch(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("draft_matches").delete().eq("id", id);
  if (error) throw error;
}
