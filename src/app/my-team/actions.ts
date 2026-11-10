"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import {
  deleteTeam,
  deleteTeamMember,
  updateTeamMemberRole,
} from "@/features/finder/repositories/finder";
import { createMyTeam, updateMyTeam, assertTeamCaptain } from "@/features/finder/services/team-service";
import { removeTeamLogo, uploadTeamLogo } from "@/features/finder/services/team-logo-service";
import { parseOrThrow } from "@/lib/validation";
import { memberRoleUpdateSchema } from "@/features/finder/schemas/finder";

export interface TeamActionResult {
  ok: boolean;
  message: string;
  slug?: string | undefined;
}

/**
 * Team management actions. user_id derives from requireUser() — the
 * caller never supplies captain/owner ids. RLS is the final boundary.
 */
export async function createTeamAction(raw: unknown): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const team = await createMyTeam(supabase, user.id, raw);
    return { ok: true, message: "Team created.", slug: team.slug };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function updateTeamAction(
  teamId: string,
  raw: unknown,
): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const team = await updateMyTeam(supabase, user.id, teamId, raw);
    return { ok: true, message: "Team updated.", slug: team.slug };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function deleteTeamAction(teamId: string): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await assertTeamCaptain(supabase, teamId, user.id);
    await deleteTeam(supabase, teamId);
    return { ok: true, message: "Team deleted." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function uploadTeamLogoAction(
  teamId: string,
  formData: FormData,
): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose a logo file first." };
    }
    const previous = String(formData.get("previous_logo_url") ?? "") || null;
    await uploadTeamLogo(supabase, {
      teamId,
      userId: user.id,
      previousLogoUrl: previous,
      file,
    });
    return { ok: true, message: "Logo updated." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function removeTeamLogoAction(teamId: string): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await removeTeamLogo(supabase, { teamId, userId: user.id });
    return { ok: true, message: "Logo removed." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function removeMemberAction(
  teamId: string,
  memberUserId: string,
): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await assertTeamCaptain(supabase, teamId, user.id);
    if (memberUserId === user.id) {
      return { ok: false, message: "Captains cannot remove themselves. Delete the team instead." };
    }
    await deleteTeamMember(supabase, teamId, memberUserId);
    return { ok: true, message: "Member removed." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function leaveTeamAction(teamId: string): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    // RLS allows self-delete (user_id = auth.uid()); captains removing
    // themselves are blocked above in removeMemberAction to avoid lockout.
    await deleteTeamMember(supabase, teamId, user.id);
    return { ok: true, message: "You left the team." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function updateMemberRoleAction(
  teamId: string,
  memberUserId: string,
  raw: unknown,
): Promise<TeamActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await assertTeamCaptain(supabase, teamId, user.id);
    const input = parseOrThrow(memberRoleUpdateSchema, raw);
    await updateTeamMemberRole(supabase, teamId, memberUserId, {
      role: input.role,
      game_role: input.game_role ?? null,
    });
    return { ok: true, message: "Member role updated." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
