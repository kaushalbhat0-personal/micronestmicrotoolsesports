"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { AppError, validationError } from "@/lib/errors";
import { getOrgLogoUrl, removeOrgLogo, uploadOrgLogo } from "../services/org-branding-service";

type ActionResult = { error?: string; logoUrl?: string | null };

async function orgContext(orgSlug: string, toolSlug = "draft-ban") {
  if (!orgSlug) throw validationError("Missing organization");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, toolSlug);
  return ctx;
}

export async function uploadOrgLogoAction(formData: FormData): Promise<ActionResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  try {
    const ctx = await orgContext(orgSlug);
    const file = formData.get("logo");
    if (!(file instanceof File)) return { error: "Choose a PNG, JPEG, or WebP file" };
    const supabase = await createClient();
    const previousLogoUrl = await getOrgLogoUrl(supabase, ctx.organization.id);
    const logoUrl = await uploadOrgLogo(supabase, {
      organizationId: ctx.organization.id,
      role: ctx.membership.role,
      previousLogoUrl,
      file,
    });
    revalidatePath(`/dashboard/${orgSlug}/draft-ban`);
    return { logoUrl };
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[uploadOrgLogoAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function removeOrgLogoAction(input: { orgSlug: string }): Promise<ActionResult> {
  try {
    const ctx = await orgContext(input.orgSlug);
    const supabase = await createClient();
    await removeOrgLogo(supabase, { organizationId: ctx.organization.id, role: ctx.membership.role });
    revalidatePath(`/dashboard/${input.orgSlug}/draft-ban`);
    return { logoUrl: null };
  } catch (e) {
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[removeOrgLogoAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}
