import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { z } from "zod";
import { deliverableRuleSchema, validateRulesForPlatform } from "../schemas/rules";
import type { Platform } from "../types/platform";
import * as deliverableRepo from "@/server/repositories/deliverables";
import * as campaignRepo from "@/server/repositories/sponsor-campaigns";

const createDeliverableSchema = z.object({
  campaign_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  rule: deliverableRuleSchema,
  platformHint: z.enum(["twitch", "youtube", "kick"]).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

const updateDeliverableSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  rule: deliverableRuleSchema.optional(),
  platformHint: z.enum(["twitch", "youtube", "kick"]).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).optional(),
});

function assertCampaignOwnership(campaignOrg: string, requestOrg: string) {
  if (campaignOrg !== requestOrg) throw forbiddenError("Cross-organization campaign attachment denied");
}

function validateRuleCapability(rule: unknown, platformHint: Platform | undefined): void {
  if (!platformHint) return;
  // Type cast to DeliverableRule for validation
  const parsed = deliverableRuleSchema.safeParse(rule);
  if (!parsed.success) return; // Zod will have already failed earlier
  const res = validateRulesForPlatform(platformHint, [parsed.data]);
  if (!res.valid) {
    throw validationError(res.errors[0]?.reason ?? "Rule not supported on platform", res.errors);
  }
}

export async function createDeliverable(
  supabase: SupabaseClient,
  organizationId: string,
  rawInput: unknown,
) {
  if (!organizationId) throw validationError("organizationId required");
  const input = parseOrThrow(createDeliverableSchema, rawInput);

  const campaign = await campaignRepo.findSponsorCampaignById(supabase, input.campaign_id);
  if (!campaign) throw notFoundError("Campaign not found");
  assertCampaignOwnership(campaign.organization_id, organizationId);

  validateRuleCapability(input.rule, input.platformHint as Platform | undefined);

  return deliverableRepo.createDeliverable(supabase, {
    organization_id: organizationId,
    campaign_id: input.campaign_id,
    name: input.name,
    description: input.description ?? null,
    rule: input.rule,
    status: input.status ?? "active",
  });
}

export async function updateDeliverable(
  supabase: SupabaseClient,
  organizationId: string,
  deliverableId: string,
  rawInput: unknown,
) {
  const input = parseOrThrow(updateDeliverableSchema, rawInput);
  const existing = await deliverableRepo.findDeliverableById(supabase, deliverableId);
  if (!existing) throw notFoundError("Deliverable not found");
  if (existing.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");

  if (input.rule !== undefined) {
    validateRuleCapability(input.rule, input.platformHint as Platform | undefined);
  }

  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.rule !== undefined) payload.rule = input.rule;
  if (input.status !== undefined) payload.status = input.status;

  return deliverableRepo.updateDeliverable(supabase, deliverableId, payload as never);
}

export async function getDeliverable(
  supabase: SupabaseClient,
  organizationId: string,
  deliverableId: string,
) {
  const row = await deliverableRepo.findDeliverableById(supabase, deliverableId);
  if (!row) throw notFoundError("Deliverable not found");
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

export interface RequirementCounts {
  /** Per-campaign requirement counts. Empty when failed or when there are none. */
  readonly counts: ReadonlyMap<string, number>;
  /** True when the count query failed — callers must render an unavailable state, never 0. */
  readonly failed: boolean;
}

/**
 * Requirement counts per campaign for the campaigns list.
 * Never throws: a failed query is reported via `failed` so the UI can
 * distinguish "couldn't load" from an actual zero. Supabase returns query
 * errors in `{ error }` (not as exceptions), so both are handled.
 */
export async function getRequirementCounts(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<RequirementCounts> {
  const counts = new Map<string, number>();
  try {
    const { data, error } = await supabase
      .from("deliverables")
      .select("campaign_id")
      .eq("organization_id", organizationId);
    if (error) return { counts, failed: true };
    for (const r of (data ?? []) as Array<{ campaign_id: string }>) {
      counts.set(r.campaign_id, (counts.get(r.campaign_id) ?? 0) + 1);
    }
    return { counts, failed: false };
  } catch {
    return { counts, failed: true };
  }
}
