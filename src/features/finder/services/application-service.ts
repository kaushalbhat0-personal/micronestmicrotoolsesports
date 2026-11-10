import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrThrow } from "@/lib/validation";
import {
  conflictError,
  forbiddenError,
  internalError,
  notFoundError,
  validationError,
} from "@/lib/errors";
import {
  applicationCreateSchema,
  type ApplicationCreateInput,
} from "../schemas/finder";
import {
  createApplication,
  decideApplication,
  findApplicationById,
  findRecruitmentPostById,
  insertTeamMember,
  withdrawApplication,
  type FinderApplicationRow,
} from "../repositories/finder";
import { assertTeamCaptain } from "./team-service";

/**
 * Finder — application lifecycle (Phase C).
 *
 * Apply → shortlist/accept/decline, withdraw for players. Statuses use
 * the existing model only. Duplicate active applications are rejected
 * by the partial unique index (post_id, applicant) WHERE status IN
 * (applied, shortlisted) — mapped here to a safe conflict message.
 * Accepting auto-adds roster membership (safest existing transition);
 * if the player is already a member the roster write is ignored and
 * the acceptance still stands.
 */

function isDuplicateApplication(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "23505" &&
    typeof record.message === "string" &&
    record.message.includes("finder_applications_active_unique")
  );
}

function isPostOpen(post: { status: string; expires_at: string }): boolean {
  if (post.status !== "open") return false;
  return Date.parse(post.expires_at) > Date.now();
}

export async function applyToPost(
  supabase: SupabaseClient,
  userId: string,
  raw: unknown,
): Promise<FinderApplicationRow> {
  const input: ApplicationCreateInput = parseOrThrow(applicationCreateSchema, raw);
  const post = await findRecruitmentPostById(supabase, input.post_id);
  // findRecruitmentPostById returns null for non-open posts when the
  // caller is anonymous (RLS select_open). For an authenticated player
  // who is not a member, non-open posts are equally unreadable — treat
  // both as "not open for applications" without leaking existence.
  if (!post) throw validationError("This recruitment post is not open for applications.");
  if (!isPostOpen(post)) {
    throw validationError("This recruitment post is not open for applications.");
  }
  try {
    return await createApplication(supabase, userId, {
      post_id: input.post_id,
      note: input.note ?? undefined,
    });
  } catch (error) {
    if (isDuplicateApplication(error)) {
      throw conflictError("You already have an active application for this post.");
    }
    throw internalError();
  }
}

export async function withdrawMyApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<FinderApplicationRow> {
  const application = await findApplicationById(supabase, applicationId);
  if (!application) throw notFoundError("Application not found.");
  if (application.applicant_user_id !== userId) {
    throw forbiddenError("You can only withdraw your own application.");
  }
  if (application.status !== "applied" && application.status !== "shortlisted") {
    throw validationError("Only active applications can be withdrawn.");
  }
  try {
    return await withdrawApplication(supabase, applicationId);
  } catch {
    throw internalError();
  }
}

export async function decideApplicationAsCaptain(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
  status: "shortlisted" | "accepted" | "declined",
): Promise<FinderApplicationRow> {
  const application = await findApplicationById(supabase, applicationId);
  if (!application) throw notFoundError("Application not found.");
  const post = await findRecruitmentPostById(supabase, application.post_id);
  if (!post) throw notFoundError("Recruitment post not found.");
  await assertTeamCaptain(supabase, post.team_id, userId);
  let decided: FinderApplicationRow;
  try {
    decided = await decideApplication(supabase, applicationId, userId, status);
  } catch {
    throw internalError();
  }
  if (status === "accepted") {
    // Safest existing transition: acceptance confers roster membership.
    // A player who joined through another path stays a member — the
    // acceptance itself is unaffected.
    try {
      await insertTeamMember(supabase, {
        team_id: post.team_id,
        user_id: application.applicant_user_id,
        role: "player",
      });
    } catch {
      // Ignore (already a member or transient roster write failure —
      // the application decision stands either way).
    }
  }
  return decided;
}
