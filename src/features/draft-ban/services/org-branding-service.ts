import type { SupabaseClient } from "@supabase/supabase-js";
import { forbiddenError, validationError } from "@/lib/errors";
import { findOrganizationById } from "@/server/repositories/organizations";

export const ORG_LOGO_BUCKET = "org-logos";
export const ORG_LOGO_MAX_BYTES = 512 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function getOrgLogoUrl(supabase: SupabaseClient, organizationId: string): Promise<string | null> {
  const org = await findOrganizationById(supabase, organizationId);
  if (!org) return null;
  return (org as { logo_url?: string | null }).logo_url ?? null;
}

export function validateLogoFile(file: File): { ext: string } {
  if (!ALLOWED_MIME.has(file.type)) throw validationError("Logo must be PNG, JPEG, or WebP");
  if (file.size <= 0) throw validationError("Logo file is empty");
  if (file.size > ORG_LOGO_MAX_BYTES) throw validationError("Logo must be at most 512 KB");
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw validationError("Logo must be PNG, JPEG, or WebP");
  return { ext };
}

/** Owner/admin-only upload. Path is org-scoped ({orgId}/logo.*) and storage
 * write policies additionally enforce owner/admin of the path organization
 * (can_manage_org_logo), so logos cannot cross organizations at the DB layer. */
export async function uploadOrgLogo(
  supabase: SupabaseClient,
  input: { organizationId: string; role: string; previousLogoUrl: string | null; file: File },
): Promise<string> {
  if (input.role !== "owner" && input.role !== "admin") throw forbiddenError("Only owners or admins can update the organization logo");
  const { ext } = validateLogoFile(input.file);
  const path = `${input.organizationId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage.from(ORG_LOGO_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: true,
  });
  if (uploadError) throw validationError("Logo upload failed. Please try again.");

  const { data } = supabase.storage.from(ORG_LOGO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) throw validationError("Logo upload failed. Please try again.");

  const { error: updateError } = await supabase.from("organizations").update({ logo_url: publicUrl }).eq("id", input.organizationId);
  if (updateError) throw validationError("Logo upload failed. Please try again.");

  // Best-effort cleanup of a stale extension variant (png→jpg switches).
  if (input.previousLogoUrl && !input.previousLogoUrl.includes(`/logo.${ext}`)) {
    const stale = input.previousLogoUrl.split("?")[0]?.split("/").slice(-2).join("/");
    if (stale && stale.startsWith(`${input.organizationId}/logo.`)) {
      await supabase.storage.from(ORG_LOGO_BUCKET).remove([stale]).catch(() => undefined);
    }
  }
  return publicUrl;
}

export async function removeOrgLogo(supabase: SupabaseClient, input: { organizationId: string; role: string }): Promise<void> {
  if (input.role !== "owner" && input.role !== "admin") throw forbiddenError("Only owners or admins can update the organization logo");
  const { error } = await supabase.from("organizations").update({ logo_url: null }).eq("id", input.organizationId);
  if (error) throw validationError("Failed to remove logo. Please try again.");
}
