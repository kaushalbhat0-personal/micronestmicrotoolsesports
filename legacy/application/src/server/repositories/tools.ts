import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tool } from "@/types/database";

export async function listActiveTools(supabase: SupabaseClient): Promise<Tool[]> {
  const { data, error } = await supabase.from("tools").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return data as Tool[];
}

export async function findToolBySlug(supabase: SupabaseClient, slug: string): Promise<Tool | null> {
  const { data, error } = await supabase.from("tools").select("*").eq("slug", slug).single();
  if (error) return null;
  return data as Tool;
}
