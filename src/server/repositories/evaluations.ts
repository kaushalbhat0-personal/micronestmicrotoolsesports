import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evaluation } from "@/types/database";

export type CreateEvaluationInput = {
  organization_id: string;
  evidence_id: string;
  deliverable_id: string;
  result: Evaluation["result"];
  reason: string;
  evaluated_at?: string;
  evaluator_version?: string;
  scan_id?: string | null;
};

export async function createEvaluation(
  supabase: SupabaseClient,
  input: CreateEvaluationInput,
): Promise<Evaluation> {
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      organization_id: input.organization_id,
      evidence_id: input.evidence_id,
      deliverable_id: input.deliverable_id,
      result: input.result,
      reason: input.reason,
      evaluated_at: input.evaluated_at ?? new Date().toISOString(),
      evaluator_version: input.evaluator_version ?? "1",
      scan_id: input.scan_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Evaluation;
}

export async function findEvaluationById(
  supabase: SupabaseClient,
  id: string,
): Promise<Evaluation | null> {
  const { data, error } = await supabase.from("evaluations").select("*").eq("id", id).single();
  if (error) return null;
  return data as Evaluation;
}

export async function listEvaluationsByEvidence(
  supabase: SupabaseClient,
  evidenceId: string,
): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("evidence_id", evidenceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Evaluation[];
}

export async function listEvaluationsByScan(
  supabase: SupabaseClient,
  scanId: string,
): Promise<Evaluation[]> {
  const { data, error } = await supabase.from("evaluations").select("*").eq("scan_id", scanId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Evaluation[];
}
