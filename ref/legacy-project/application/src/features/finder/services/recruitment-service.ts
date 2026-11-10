import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import { AppError, internalError, notFoundError, validationError } from "@/lib/errors";
import {
  recruitmentPostCreateSchema,
  recruitmentPostUpdateSchema,
  type RecruitmentPostCreateInput,
  type RecruitmentPostUpdateInput,
} from "../schemas/finder";
import {
  createRecruitmentPost,
  findRecruitmentPostById,
  updateRecruitmentPost,
  type FinderRecruitmentPostRow,
} from "../repositories/finder";
import { assertTeamCaptain } from "./team-service";

/**
 * Finder — recruitment post writes (Phase C).
 *
 * team_id authority NEVER comes from trusting the client alone: the
 * captain check (application layer) + is_finder_team_captain RLS
 * (database layer) both derive from auth.uid(). created_by derives
 * from the session.
 */

export async function createRecruitmentPostForCaptain(
  supabase: SupabaseClient,
  userId: string,
  raw: unknown,
): Promise<FinderRecruitmentPostRow> {
  const input: RecruitmentPostCreateInput = parseOrThrow(recruitmentPostCreateSchema, raw);
  await assertTeamCaptain(supabase, input.team_id, userId);
  if (input.expires_at && Number.isNaN(Date.parse(input.expires_at))) {
    throw validationError("Expiry must be a valid date.");
  }
  try {
    return await createRecruitmentPost(supabase, userId, {
      team_id: input.team_id,
      game: input.game ?? "bgmi",
      role_needed: input.role_needed,
      slots: input.slots,
      current_level_min: input.current_level_min,
      target_level: input.target_level,
      region: input.region,
      availability_required: input.availability_required ?? [],
      experience_min: input.experience_min ?? undefined,
      tryout_required: input.tryout_required ?? true,
      status: input.status ?? "open",
      expires_at: input.expires_at ?? undefined,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw internalError();
  }
}

export async function updateRecruitmentPostForCaptain(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  raw: unknown,
): Promise<FinderRecruitmentPostRow> {
  const input: RecruitmentPostUpdateInput = parseOrThrow(recruitmentPostUpdateSchema, raw);
  const post = await findRecruitmentPostById(supabase, postId);
  if (!post) throw notFoundError("Recruitment post not found.");
  await assertTeamCaptain(supabase, post.team_id, userId);
  if (input.expires_at && Number.isNaN(Date.parse(input.expires_at))) {
    throw validationError("Expiry must be a valid date.");
  }
  try {
    return await updateRecruitmentPost(supabase, postId, {
      role_needed: input.role_needed,
      slots: input.slots,
      current_level_min: input.current_level_min,
      target_level: input.target_level,
      region: input.region,
      availability_required: input.availability_required ?? [],
      experience_min: input.experience_min ?? undefined,
      tryout_required: input.tryout_required,
      status: input.status,
      expires_at: input.expires_at ?? undefined,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw internalError();
  }
}

export async function setRecruitmentPostStatus(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  status: "open" | "paused" | "closed" | "filled",
): Promise<FinderRecruitmentPostRow> {
  const post = await findRecruitmentPostById(supabase, postId);
  if (!post) throw notFoundError("Recruitment post not found.");
  await assertTeamCaptain(supabase, post.team_id, userId);
  try {
    return await updateRecruitmentPost(supabase, postId, {
      role_needed: post.role_needed,
      slots: post.slots,
      current_level_min: post.current_level_min,
      target_level: post.target_level,
      region: post.region,
      availability_required: post.availability_required,
      experience_min: post.experience_min ?? undefined,
      tryout_required: post.tryout_required,
      status,
      expires_at: post.expires_at,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw internalError();
  }
}
