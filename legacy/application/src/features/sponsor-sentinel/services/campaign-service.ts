import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { z } from "zod";
import * as repo from "@/server/repositories/sponsor-campaigns";

/**
 * Normalizes datetime-local (YYYY-MM-DDTHH:mm) and other common browser
 * submissions to ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ) expected by
 * Zod .datetime() and Postgres timestamptz. Deterministic: datetime-local
 * without offset is treated as UTC wall time (matches defaultValue using
 * toISOString().slice(0,16) which is UTC). Existing ISO with Z/offset
 * is parsed and re-serialized to canonical ISO.
 */
export function normalizeDateTimeInput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (!v) return v;
  // If already has offset/Z, let Date parse and return canonical ISO
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(v);
  if (hasOffset) {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toISOString();
  }
  // datetime-local without offset: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss"
  // Add seconds if missing
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  const d = new Date(withSeconds);
  if (isNaN(d.getTime())) return v;
  return d.toISOString();
}

const createCampaignSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  starts_at: z.preprocess(normalizeDateTimeInput, z.string().datetime()),
  ends_at: z.preprocess(normalizeDateTimeInput, z.string().datetime()),
}).refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
  message: "ends_at must be after starts_at",
  path: ["ends_at"],
});

const updateCampaignSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "completed", "archived"]).optional(),
  starts_at: z.preprocess(normalizeDateTimeInput, z.string().datetime().optional()),
  ends_at: z.preprocess(normalizeDateTimeInput, z.string().datetime().optional()),
});

export async function createCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  rawInput: unknown,
  opts?: { userId?: string },
) {
  if (!organizationId) throw validationError("organizationId required");
  const input = parseOrThrow(createCampaignSchema, rawInput);
  if (opts?.userId) {
    const { assertFreeCampaignCreateAllowed } = await import("@/server/services/sponsorship-limits");
    await assertFreeCampaignCreateAllowed(supabase, { userId: opts.userId, organizationId });
  }
  return repo.createSponsorCampaign(supabase, {
    organization_id: organizationId,
    name: input.name,
    description: input.description ?? null,
    status: input.status ?? "draft",
    starts_at: input.starts_at,
    ends_at: input.ends_at,
  });
}

export async function updateCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  rawInput: unknown,
) {
  const input = parseOrThrow(updateCampaignSchema, rawInput);
  const existing = await repo.findSponsorCampaignById(supabase, campaignId);
  if (!existing) throw notFoundError("Campaign not found");
  if (existing.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  // Draft-only editing: lifecycle transitions (activate/complete/archive) own all
  // status changes. Editing a tracking/completed/archived campaign is rejected
  // server-side even if the UI is bypassed.
  if (existing.status !== "draft") throw validationError(`Only draft campaigns can be edited (current: ${existing.status})`);
  // Optional window validation if both provided or one changed
  if (input.starts_at !== undefined || input.ends_at !== undefined) {
    const starts = input.starts_at ?? existing.starts_at;
    const ends = input.ends_at ?? existing.ends_at;
    if (new Date(ends) <= new Date(starts)) throw validationError("ends_at must be after starts_at");
  }
  return repo.updateSponsorCampaign(supabase, campaignId, input as Record<string, unknown> as never);
}

export async function getCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
) {
  const row = await repo.findSponsorCampaignById(supabase, campaignId);
  if (!row) throw notFoundError("Campaign not found");
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

export async function listCampaigns(supabase: SupabaseClient, organizationId: string) {
  if (!organizationId) throw forbiddenError("Missing organization");
  return repo.listSponsorCampaignsByOrg(supabase, organizationId);
}
