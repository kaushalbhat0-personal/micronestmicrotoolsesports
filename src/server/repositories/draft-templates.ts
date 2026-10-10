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
  /** True for starter templates (quota-exempt). Custom templates are false. Server-minted only — never client input. */
  is_starter: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const TEMPLATE_COLUMNS = "id, organization_id, name, config, is_starter, created_by, created_at, updated_at";

export async function createDraftTemplate(
  supabase: SupabaseClient,
  input: { organization_id: string; name: string; config: DraftTemplateRow["config"]; created_by: string },
): Promise<DraftTemplateRow> {
  const { data, error } = await supabase.from("draft_templates").insert(input).select(TEMPLATE_COLUMNS).single();
  if (error) throw error;
  return data as DraftTemplateRow;
}

/**
 * Authoritative custom-template creation through the race-safe RPC.
 * Must be called with the service-role client (the RPC revokes
 * authenticated execution): membership + coverage + duplicate-name + the
 * trigger-guarded per-org cap commit atomically. Free 3, paid 20, starters
 * exempt. Throws DBT01/DBT02/DBN01-coded errors for the policy mapper.
 */
export async function createDraftTemplateViaCap(
  supabase: SupabaseClient,
  input: { organizationId: string; name: string; config: DraftTemplateRow["config"]; userId: string },
): Promise<DraftTemplateRow> {
  const { data, error } = await supabase.rpc("create_draft_template", {
    p_org_id: input.organizationId,
    p_name: input.name,
    p_config: input.config,
    p_user_id: input.userId,
  });
  if (error) throw error;
  if (!data) throw new Error("Template creation returned no draft template row");
  return data as DraftTemplateRow;
}

/**
 * Idempotent starter provisioning through the race-safe RPC.
 * Must be called with the service-role client. Creates the quota-exempt
 * 'Standard Veto' only for workspaces with zero templates; otherwise returns
 * the existing starter row, or null when the workspace has templates but no
 * starter (starter is never backfilled over existing customs).
 */
export async function ensureStarterDraftTemplateViaRpc(
  supabase: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<DraftTemplateRow | null> {
  const { data, error } = await supabase.rpc("ensure_starter_draft_template", {
    p_org_id: input.organizationId,
    p_user_id: input.userId,
  });
  if (error) throw error;
  if (!data) return null;
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

/** Live custom-template count for quota display (starter templates excluded). */
export async function countCustomDraftTemplatesByOrg(supabase: SupabaseClient, organizationId: string): Promise<number> {
  const res = await supabase
    .from("draft_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_starter", false);
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
