import type { SupabaseClient } from "@supabase/supabase-js";

export interface DraftTemplateRow {
  id: string;
  organization_id: string;
  name: string;
  config: {
    sequence: Array<{ team: "A" | "B"; type: "ban" | "pick" }>;
    pool: string[];
    teamA: string | null;
    teamB: string | null;
  };
  created_by: string;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_COLUMNS = "id, organization_id, name, config, created_by, created_at, updated_at";

export async function createDraftTemplate(
  supabase: SupabaseClient,
  input: { organization_id: string; name: string; config: DraftTemplateRow["config"]; created_by: string },
): Promise<DraftTemplateRow> {
  const { data, error } = await supabase.from("draft_templates").insert(input).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  return data as DraftTemplateRow;
}

export async function findDraftTemplateById(supabase: SupabaseClient, id: string): Promise<DraftTemplateRow | null> {
  const { data, error } = await supabase.from("draft_templates").select(TEMPLATE_COLUMNS).eq("id", id).single();
  if (error) return null;
  return data as DraftTemplateRow;
}

export async function listDraftTemplatesByOrg(supabase: SupabaseClient, organizationId: string): Promise<DraftTemplateRow[]> {
  const { data, error } = await supabase
    .from("draft_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DraftTemplateRow[];
}

export async function countDraftTemplatesByOrg(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const res = await supabase.from("draft_templates").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const count = (res as { count?: unknown }).count;
  return typeof count === "number" ? count : 0;
}

export async function updateDraftTemplate(
  supabase: SupabaseClient,
  id: string,
  input: { name?: string; config?: DraftTemplateRow["config"] },
): Promise<DraftTemplateRow> {
  const { data, error } = await supabase.from("draft_templates").update(input).eq("id", id).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  return data as DraftTemplateRow;
}

export async function deleteDraftTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("draft_templates").delete().eq("id", id);
  if (error) throw error;
}
