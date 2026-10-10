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

export interface DraftMatchHistoryQuery {
  search?: string;
  status?: DraftMatchStatus;
  limit?: number;
}

/** Org-scoped history with optional status + text search, newest-created first. */
export async function searchDraftMatches(
  supabase: SupabaseClient,
  organizationId: string,
  query: DraftMatchHistoryQuery = {},
): Promise<DraftMatchRow[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
  let builder = supabase
    .from("draft_matches")
    .select(MATCH_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (query.status) builder = builder.eq("status", query.status);
  const term = query.search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,\\]/g, (c) => `\\${c}`);
    builder = builder.or(
      `match_name.ilike.%${escaped}%,event_name.ilike.%${escaped}%,ref_code.ilike.%${escaped}%,team_a.ilike.%${escaped}%,team_b.ilike.%${escaped}%`,
    );
  }
  const { data, error } = await builder;
  if (error) throw error;
  return (data ?? []) as DraftMatchRow[];
}

/**
 * Completed official matches, newest-completed first (completed_at DESC,
 * id DESC for deterministic ties). Completed rows always carry
 * completed_at (DB CHECK), so ordering never touches created_at.
 */
export async function listCompletedDraftMatchesByOrg(
  supabase: SupabaseClient,
  organizationId: string,
  query: Pick<DraftMatchHistoryQuery, "search" | "limit"> = {},
): Promise<DraftMatchRow[]> {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 100);
  let builder = supabase
    .from("draft_matches")
    .select(MATCH_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  const term = query.search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,\\]/g, (c) => `\\${c}`);
    builder = builder.or(
      `match_name.ilike.%${escaped}%,event_name.ilike.%${escaped}%,ref_code.ilike.%${escaped}%,team_a.ilike.%${escaped}%,team_b.ilike.%${escaped}%`,
    );
  }
  const { data, error } = await builder;
  if (error) throw error;
  return (data ?? []) as DraftMatchRow[];
}

/** Total matching completed records BEFORE any Free-window slicing (honest "N of latest 5 of N" copy). */
export async function countCompletedDraftMatches(
  supabase: SupabaseClient,
  organizationId: string,
  query: Pick<DraftMatchHistoryQuery, "search"> = {},
): Promise<number> {
  let builder = supabase
    .from("draft_matches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "completed");
  const term = query.search?.trim();
  if (term) {
    const escaped = term.replace(/[%_,\\]/g, (c) => `\\${c}`);
    builder = builder.or(
      `match_name.ilike.%${escaped}%,event_name.ilike.%${escaped}%,ref_code.ilike.%${escaped}%,team_a.ilike.%${escaped}%,team_b.ilike.%${escaped}%`,
    );
  }
  const res = await builder;
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

/**
 * Quota-aware finalize through the SECURITY DEFINER RPC.
 * Must be called with the service-role client (the RPC revokes
 * authenticated execution): membership, coverage, workspace-month ledger
 * quota, and the completed UPDATE commit atomically with completed_at from
 * the database clock. Returns the finalized (or already-completed) row.
 * This is the sole production completion path; the completion-path guard
 * trigger rejects direct status→completed writes.
 */
export async function finalizeDraftMatchViaQuota(
  supabase: SupabaseClient,
  input: { organizationId: string; matchId: string; userId: string },
): Promise<DraftMatchRow> {
  const { data, error } = await supabase.rpc("consume_draft_ban_completion", {
    p_org_id: input.organizationId,
    p_match_id: input.matchId,
    p_user_id: input.userId,
  });
  if (error) throw error;
  if (!data) throw new Error("Completion reservation returned no draft match row");
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
