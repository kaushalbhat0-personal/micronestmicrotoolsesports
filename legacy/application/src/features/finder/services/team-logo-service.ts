import type { SupabaseClient } from "@supabase/supabase-js";
import { validationError } from "@/lib/errors";
import { updateTeamLogoUrl } from "../repositories/finder";
import { assertTeamCaptain } from "./team-service";

/**
 * Finder — team logo upload (Phase C).
 *
 * Reuses the finder-avatars bucket (never a new bucket). Storage RLS
 * (can_manage_finder_avatar: own user folder OR captained {teamId}/...)
 * is the authority; the captain check below gives safe UX errors.
 * Mirrors the org-branding-service validator shape without importing
 * across features.
 */

export const TEAM_LOGO_BUCKET = "finder-avatars";
export const TEAM_LOGO_MAX_BYTES = 512 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function validateTeamLogoFile(file: File): { ext: string } {
  if (!ALLOWED_MIME.has(file.type)) throw validationError("Logo must be PNG, JPEG, or WebP");
  if (file.size <= 0) throw validationError("Logo file is empty");
  if (file.size > TEAM_LOGO_MAX_BYTES)
    throw validationError("Logo must be at most 512 KB");
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw validationError("Logo must be PNG, JPEG, or WebP");
  return { ext };
}

/** Captain-only upload. Path is team-scoped ({teamId}/logo.*) — the client never chooses it. */
export async function uploadTeamLogo(
  supabase: SupabaseClient,
  input: {
    teamId: string;
    userId: string;
    previousLogoUrl: string | null;
    file: File;
  },
): Promise<string> {
  await assertTeamCaptain(supabase, input.teamId, input.userId);
  const { ext } = validateTeamLogoFile(input.file);
  const path = `${input.teamId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage.from(TEAM_LOGO_BUCKET).upload(
    path,
    input.file,
    { contentType: input.file.type, upsert: true },
  );
  if (uploadError) throw validationError("Logo upload failed. Please try again.");

  const { data } = supabase.storage.from(TEAM_LOGO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (!publicUrl) throw validationError("Logo upload failed. Please try again.");

  try {
    await updateTeamLogoUrl(supabase, input.teamId, publicUrl);
  } catch {
    throw validationError("Logo upload failed. Please try again.");
  }

  // Best-effort cleanup of a stale extension variant (png→jpg switches).
  if (input.previousLogoUrl && !input.previousLogoUrl.includes(`/logo.${ext}`)) {
    const stale = input.previousLogoUrl.split("?")[0]?.split("/").slice(-2).join("/");
    if (stale && stale.startsWith(`${input.teamId}/logo.`)) {
      await supabase.storage.from(TEAM_LOGO_BUCKET).remove([stale]).catch(() => undefined);
    }
  }
  return publicUrl;
}

export async function removeTeamLogo(
  supabase: SupabaseClient,
  input: { teamId: string; userId: string },
): Promise<void> {
  await assertTeamCaptain(supabase, input.teamId, input.userId);
  try {
    await updateTeamLogoUrl(supabase, input.teamId, null);
  } catch {
    throw validationError("Failed to remove logo. Please try again.");
  }
}
