import type { SupabaseClient } from "@supabase/supabase-js";
import { entitlementError, forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import * as templateRepo from "@/server/repositories/draft-templates";
import {
  FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX,
  freeDraftBanCustomTemplatesMax,
  mapCreateDraftTemplateError,
  resolveDraftBanAccessLevel,
} from "@/server/services/draft-ban-policy";
import { templateConfigSchema, templateNameSchema, TEMPLATES_PER_ORG_MAX } from "../schemas/draft-config";

export { FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX };

/**
 * Custom-template cap for an access level. Paid uses the authoritative
 * TEMPLATES_PER_ORG_MAX (20, schemas/draft-config — never redefined here);
 * Free resolves through the policy registry
 * (src/config/tools/policy.ts → freeDraftBanCustomTemplatesMax).
 */
export function customTemplatesMaxForLevel(level: "paid" | "free"): number {
  return level === "paid" ? TEMPLATES_PER_ORG_MAX : freeDraftBanCustomTemplatesMax();
}

function requireOwned<T extends { organization_id: string }>(row: T | null, organizationId: string): T {
  if (!row) throw notFoundError("Template not found");
  if (row.organization_id !== organizationId) throw forbiddenError("Cross-organization access denied");
  return row;
}

function toConfig(raw: unknown): { sequence: Array<{ team: "A"; type: "ban" | "pick" } | { team: "B"; type: "ban" | "pick" }>; pool: string[]; teamA: string | null; teamB: string | null } {
  const parsed = parseOrThrow(templateConfigSchema, raw);
  return {
    sequence: parsed.sequence.map((s) => ({ team: s.team, type: s.type })),
    pool: parsed.pool.map((p) => p.trim()),
    teamA: parsed.teamA?.trim() ? parsed.teamA.trim() : null,
    teamB: parsed.teamB?.trim() ? parsed.teamB.trim() : null,
  };
}

export function isStarterTemplate(row: Pick<templateRepo.DraftTemplateRow, "is_starter">): boolean {
  return row.is_starter === true;
}

/** Live custom-template usage (starters excluded) for quota display. */
export async function getCustomTemplateUsage(supabase: SupabaseClient, organizationId: string) {
  const [templates, level] = await Promise.all([
    templateRepo.listDraftTemplatesByOrg(supabase, organizationId),
    resolveDraftBanAccessLevel(supabase, { organizationId }),
  ]);
  const customCount = templates.filter((t) => !isStarterTemplate(t)).length;
  const customMax = level === "paid" ? TEMPLATES_PER_ORG_MAX : freeDraftBanCustomTemplatesMax();
  return {
    templates,
    customCount,
    starterCount: templates.length - customCount,
    customMax,
    accessLevel: level,
    canCreate: customCount < customMax,
  };
}

export async function listTemplates(supabase: SupabaseClient, organizationId: string) {
  return templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
}

/**
 * Custom-template creation — server authority, race-safe.
 *
 * Only name/config are accepted (extra keys such as a forged is_starter are
 * ignored by construction). The authoritative path is the
 * create_draft_template RPC (service-role client): membership, coverage,
 * duplicate-name, and the trigger-guarded per-org cap commit atomically, so
 * concurrent count-then-insert races converge instead of overfilling.
 * Starter templates never count toward the cap.
 */
export async function createTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  rawInput: { name: unknown; config: unknown },
) {
  const name = parseOrThrow(templateNameSchema, rawInput.name);
  const config = toConfig(rawInput.config);
  const siblings = await templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
  if (siblings.some((t) => t.name.trim().toLowerCase() === name.toLowerCase())) {
    throw validationError("A template with this name already exists");
  }
  const level = await resolveDraftBanAccessLevel(supabase, { organizationId });
  if (level === "none") {
    throw entitlementError();
  }
  const customMax = customTemplatesMaxForLevel(level);
  try {
    return await templateRepo.createDraftTemplateViaCap(createAdminClient() as unknown as SupabaseClient, {
      organizationId,
      name,
      config,
      userId,
    });
  } catch (e) {
    throw mapCreateDraftTemplateError(e, customMax);
  }
}

export async function renameTemplate(supabase: SupabaseClient, organizationId: string, templateId: string, rawName: unknown) {
  const row = requireOwned(await templateRepo.findDraftTemplateById(supabase, templateId), organizationId);
  const name = parseOrThrow(templateNameSchema, rawName);
  const siblings = await templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
  if (siblings.some((t) => t.id !== row.id && t.name.trim().toLowerCase() === name.toLowerCase())) {
    throw validationError("A template with this name already exists");
  }
  return templateRepo.updateDraftTemplate(supabase, row.id, { name });
}

export async function updateTemplate(supabase: SupabaseClient, organizationId: string, templateId: string, rawConfig: unknown) {
  const row = requireOwned(await templateRepo.findDraftTemplateById(supabase, templateId), organizationId);
  const config = toConfig(rawConfig);
  return templateRepo.updateDraftTemplate(supabase, row.id, { config });
}

export async function deleteTemplate(supabase: SupabaseClient, organizationId: string, templateId: string) {
  requireOwned(await templateRepo.findDraftTemplateById(supabase, templateId), organizationId);
  await templateRepo.deleteDraftTemplate(supabase, templateId);
}

/**
 * Idempotent starter provisioning — creates the quota-exempt "Standard Veto"
 * only when the organization has no templates yet. Safe to retry and safe
 * under concurrency (per-org advisory lock + ON CONFLICT converge on one
 * row). Starter provisioning never consumes a custom-template slot.
 */
export async function ensureStarterTemplate(supabase: SupabaseClient, organizationId: string, userId: string) {
  const existing = await templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
  if (existing.length > 0) return existing;
  // Authoritative path is the ensure_starter_draft_template RPC (service-role
  // client): the starter row is minted with the authorized-starter marker in
  // the same transaction, so the cap guard exempts it. A direct insert must
  // never substitute here — without the marker the guard would demote the
  // row to a custom template and wrongly consume a quota slot.
  await templateRepo.ensureStarterDraftTemplateViaRpc(createAdminClient() as unknown as SupabaseClient, {
    organizationId,
    userId,
  });
  return templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
}
