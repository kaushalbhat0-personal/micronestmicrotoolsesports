import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, notFoundError, validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import * as templateRepo from "@/server/repositories/draft-templates";
import { templateConfigSchema, templateNameSchema, TEMPLATES_PER_ORG_MAX } from "../schemas/draft-config";
import { STANDARD_VETO_NAME, standardVetoTemplate } from "./presets";
import { validateConfig } from "./draft-engine";

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

export async function listTemplates(supabase: SupabaseClient, organizationId: string) {
  return templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
}

export async function createTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  rawInput: { name: unknown; config: unknown },
) {
  const name = parseOrThrow(templateNameSchema, rawInput.name);
  const config = toConfig(rawInput.config);
  const existing = await templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
  if (existing.length >= TEMPLATES_PER_ORG_MAX) throw validationError(`Template limit reached (${TEMPLATES_PER_ORG_MAX} per organization)`);
  if (existing.some((t) => t.name.trim().toLowerCase() === name.toLowerCase())) throw validationError("A template with this name already exists");
  return templateRepo.createDraftTemplate(supabase, { organization_id: organizationId, name, config, created_by: userId });
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
 * Idempotent starter provisioning — creates "Standard Veto" only when the
 * organization has no templates yet. Safe to retry.
 */
export async function ensureStarterTemplate(supabase: SupabaseClient, organizationId: string, userId: string) {
  const existing = await templateRepo.listDraftTemplatesByOrg(supabase, organizationId);
  if (existing.length > 0) return existing;
  const seed = standardVetoTemplate();
  // Starter has empty pool by design (user enters match pool); validate shape only.
  const check = validateConfig({ teamA: "Team A", teamB: "Team B", pool: ["A", "B", "C", "D", "E", "F", "G"], sequence: [...seed.sequence] });
  if (!check.valid) throw validationError(check.errors[0] ?? "Invalid starter template");
  const created = await templateRepo.createDraftTemplate(supabase, {
    organization_id: organizationId,
    name: STANDARD_VETO_NAME,
    config: { sequence: seed.sequence.map((s) => ({ team: s.team, type: s.type })), pool: [], teamA: null, teamB: null },
    created_by: userId,
  });
  return [created, ...existing];
}
