"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { isDraftBanTemplateLimitError } from "@/server/services/draft-ban-policy";
import { createTemplate, deleteTemplate, ensureStarterTemplate, renameTemplate, updateTemplate } from "../services/template-service";

type ActionResult = { error?: string; templateId?: string; templateLimited?: boolean };

function toResult(e: unknown, fallback: string): ActionResult {
  if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
  if (e instanceof AppError) {
    console.warn(`[AppError ${e.code}]`, e.safeMessage);
    if (isDraftBanTemplateLimitError(e)) return { error: e.safeMessage, templateLimited: true };
    return { error: e.safeMessage };
  }
  console.error("[draft-ban template action] unexpected", e);
  return { error: fallback };
}

async function orgContext(orgSlug: string) {
  if (!orgSlug) throw new AppError({ code: "VALIDATION_ERROR", status: 400, message: "Missing organization", safeMessage: "Missing organization" });
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "draft-ban");
  return ctx;
}

export async function ensureStarterTemplateAction(input: { orgSlug: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await ensureStarterTemplate(supabase, ctx.organization.id, ctx.user.id);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function createTemplateAction(input: {
  orgSlug: string;
  name: string;
  config: { sequence: Array<{ team: "A" | "B"; type: "ban" | "pick" }>; pool: string[]; teamA: string | null; teamB: string | null };
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    const template = await createTemplate(supabase, ctx.organization.id, ctx.user.id, { name: input.name, config: input.config });
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return { templateId: template.id };
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function renameTemplateAction(input: { orgSlug: string; templateId: string; name: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await renameTemplate(supabase, ctx.organization.id, input.templateId, input.name);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function updateTemplateAction(input: {
  orgSlug: string;
  templateId: string;
  config: { sequence: Array<{ team: "A" | "B"; type: "ban" | "pick" }>; pool: string[]; teamA: string | null; teamB: string | null };
}): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await updateTemplate(supabase, ctx.organization.id, input.templateId, input.config);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}

export async function deleteTemplateAction(input: { orgSlug: string; templateId: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await deleteTemplate(supabase, ctx.organization.id, input.templateId);
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return {};
  } catch (e) {
    return toResult(e, "Something went wrong. Please try again.");
  }
}
