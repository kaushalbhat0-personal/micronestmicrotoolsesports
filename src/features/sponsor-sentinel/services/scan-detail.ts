import type { SupabaseClient } from "@supabase/supabase-js";
import { notFoundError } from "@/lib/errors";
import type { Scan, Evidence, Evaluation } from "@/types/database";
import { findScanById } from "@/server/repositories/scans";
import { listEvidenceByScan } from "@/server/repositories/evidence";
import { listEvaluationsByScan } from "@/server/repositories/evaluations";

export interface ScanDetail {
  readonly scan: Scan;
  readonly campaignName: string | null;
  readonly evidence: readonly Evidence[];
  readonly evaluations: readonly Evaluation[];
  readonly evaluationSummary: Record<string, number>;
  readonly deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>;
}

export async function getScanDetail(
  supabase: SupabaseClient,
  organizationId: string,
  scanId: string,
): Promise<ScanDetail> {
  const scan = await findScanById(supabase, scanId);
  if (!scan) throw notFoundError("Scan not found");
  if (scan.organization_id !== organizationId) throw notFoundError("Scan not found");

  // Fetch campaign name
  let campaignName: string | null = null;
  const { data: campaignData } = await supabase.from("sponsor_campaigns").select("name").eq("id", scan.campaign_id).single();
  if (campaignData && typeof (campaignData as { name?: string }).name === "string") {
    campaignName = (campaignData as { name: string }).name;
  }

  // Per-scan evidence (exact attribution via scan_id)
  const evidence = await listEvidenceByScan(supabase, scanId);
  // Ensure tenant isolation even if scan_id somehow cross-tenant (already checked scan org, but filter)
  const filteredEvidence = evidence.filter((e) => e.organization_id === organizationId);

  // Per-scan evaluations via scan_id
  const evaluations = await listEvaluationsByScan(supabase, scanId);
  const filteredEvals = evaluations.filter((ev) => ev.organization_id === organizationId);

  const evaluationSummary: Record<string, number> = {};
  for (const ev of filteredEvals) {
    evaluationSummary[ev.result] = (evaluationSummary[ev.result] ?? 0) + 1;
  }

  // Deliverable names for display
  const { data: deliverableRows } = await supabase
    .from("deliverables")
    .select("id, name, rule")
    .eq("campaign_id", scan.campaign_id);
  const deliverableMap = new Map<string, { name: string; rule: unknown }>();
  for (const d of (deliverableRows ?? []) as Array<{ id: string; name: string; rule: unknown }>) {
    deliverableMap.set(d.id, { name: d.name, rule: d.rule });
  }

  return {
    scan,
    campaignName,
    evidence: filteredEvidence,
    evaluations: filteredEvals,
    evaluationSummary,
    deliverableMap,
  };
}
