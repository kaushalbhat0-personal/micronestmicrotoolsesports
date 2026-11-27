"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import { deleteRecruitmentPost } from "@/features/finder/repositories/finder";
import {
  createRecruitmentPostForCaptain,
  setRecruitmentPostStatus,
  updateRecruitmentPostForCaptain,
} from "@/features/finder/services/recruitment-service";
import { decideApplicationAsCaptain } from "@/features/finder/services/application-service";
import { assertTeamCaptain } from "@/features/finder/services/team-service";
import { findRecruitmentPostById } from "@/features/finder/repositories/finder";

export interface RecruitmentActionResult {
  ok: boolean;
  message: string;
  postId?: string | undefined;
}

/** Captain-only recruitment + application-review actions. */
export async function createPostAction(raw: unknown): Promise<RecruitmentActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const post = await createRecruitmentPostForCaptain(supabase, user.id, raw);
    return { ok: true, message: "Opening posted.", postId: post.id };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function updatePostAction(
  postId: string,
  raw: unknown,
): Promise<RecruitmentActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await updateRecruitmentPostForCaptain(supabase, user.id, postId, raw);
    return { ok: true, message: "Opening updated.", postId };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function setPostStatusAction(
  postId: string,
  status: "open" | "paused" | "closed" | "filled",
): Promise<RecruitmentActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await setRecruitmentPostStatus(supabase, user.id, postId, status);
    return { ok: true, message: `Opening ${status}.`, postId };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function deletePostAction(postId: string): Promise<RecruitmentActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const post = await findRecruitmentPostById(supabase, postId);
    if (!post) return { ok: false, message: "Recruitment post not found." };
    await assertTeamCaptain(supabase, post.team_id, user.id);
    await deleteRecruitmentPost(supabase, postId);
    return { ok: true, message: "Opening deleted." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function decideApplicationAction(
  applicationId: string,
  status: "shortlisted" | "accepted" | "declined",
): Promise<RecruitmentActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await decideApplicationAsCaptain(supabase, user.id, applicationId, status);
    const message =
      status === "accepted"
        ? "Application accepted — the player joined your roster."
        : status === "shortlisted"
          ? "Application shortlisted."
          : "Application declined.";
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
