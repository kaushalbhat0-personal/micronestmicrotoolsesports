import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, validationError, notFoundError, entitlementError } from "@/lib/errors";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as channelRepo from "@/server/repositories/connected-channels";

export type CampaignStatus = "draft" | "active" | "completed" | "archived";

const ALLOWED: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "archived"],
  active: ["completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(from: CampaignStatus, to: CampaignStatus) {
  if (from === to) return;
  if (!canTransition(from, to)) throw validationError(`Invalid status transition ${from} → ${to}`);
}

export async function activateCampaign(supabase: SupabaseClient, organizationId: string, campaignId: string) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  if (campaign.status !== "draft") throw validationError(`Only draft campaigns can be activated (current: ${campaign.status})`);

  // Entitlement check — use has_tool_access RPC directly for server-side
  const has = await checkEntitlement(supabase, organizationId);
  if (!has) throw entitlementError("Sponsor Sentinel entitlement required");

  // Must have at least one usable connected channel
  const channels = await channelRepo.listConnectedChannelsByOrg(supabase, organizationId);
  const usable = channels.filter((c) => c.connection_status === "connected");
  if (usable.length === 0) throw validationError("At least one connected channel required", { code: "NO_CHANNEL" });

  // Must have at least one deliverable
  const deliverables = await deliverableRepo.listDeliverablesByCampaign(supabase, campaignId);
  if (deliverables.length === 0) throw validationError("At least one deliverable required", { code: "NO_DELIVERABLE" });

  // All deliverable rules must be valid (already validated on create, but re-check for capability)
  for (const d of deliverables) {
    // Rule already validated via Zod on create; here ensure rule is object
    if (!d.rule || typeof d.rule !== "object") throw validationError(`Invalid rule for deliverable ${d.name}`);
  }

  // Transactional update — single status change, no partial mutation (Supabase lacks transaction, single UPDATE is atomic)
  const updated = await campaignRepo.updateSponsorCampaign(supabase, campaignId, { status: "active" as CampaignStatus });
  if (updated.status !== "active") throw validationError("Activation failed");
  return updated;
}

async function checkEntitlement(supabase: SupabaseClient, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("has_tool_access", { org_id: organizationId, tool_slug: "sponsor-sentinel" });
    if (!error && typeof data === "boolean") return data;
  } catch {}
  // Fallback: check tool_entitlements directly
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", "sponsor-sentinel").single();
  if (!tool) return false;
  const { data: entitlements } = await supabase.from("tool_entitlements").select("is_all_access, tool_id, expires_at").eq("organization_id", organizationId);
  if (!entitlements) return false;
  const list = entitlements as Array<{ is_all_access: boolean; tool_id: string | null; expires_at: string | null }>;
  return list.some((e) => {
    const notExpired = !e.expires_at || new Date(e.expires_at) > new Date();
    if (!notExpired) return false;
    if (e.is_all_access) return true;
    return e.tool_id === (tool as { id: string }).id;
  });
}

export async function transitionCampaign(supabase: SupabaseClient, organizationId: string, campaignId: string, to: CampaignStatus) {
  const campaign = await campaignRepo.findSponsorCampaignById(supabase, campaignId);
  if (!campaign) throw notFoundError("Campaign not found");
  if (campaign.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  assertTransition(campaign.status as CampaignStatus, to);
  return campaignRepo.updateSponsorCampaign(supabase, campaignId, { status: to });
}
