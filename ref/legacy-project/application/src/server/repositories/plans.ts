import type { SupabaseClient } from "@supabase/supabase-js";
import type { Plan } from "@/types/database";

export async function listActivePlans(supabase: SupabaseClient): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("amount_minor");
  if (error) throw error;
  return (data as Plan[]) ?? [];
}

export async function getPlanById(supabase: SupabaseClient, planId: string): Promise<Plan | null> {
  const { data, error } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
  if (error) throw error;
  return (data as Plan | null) ?? null;
}

export async function getPlanBySlug(supabase: SupabaseClient, slug: string): Promise<Plan | null> {
  const { data, error } = await supabase.from("plans").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as Plan | null) ?? null;
}

export async function listPlansForTool(supabase: SupabaseClient, toolId: string | null): Promise<Plan[]> {
  if (toolId === null) {
    const { data, error } = await supabase.from("plans").select("*").is("tool_id", null).eq("is_active", true);
    if (error) throw error;
    return (data as Plan[]) ?? [];
  }
  const { data, error } = await supabase.from("plans").select("*").eq("tool_id", toolId).eq("is_active", true);
  if (error) throw error;
  return (data as Plan[]) ?? [];
}
