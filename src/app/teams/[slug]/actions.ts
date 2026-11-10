"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import { applyToPost } from "@/features/finder/services/application-service";

export interface ApplyActionResult {
  ok: boolean;
  message: string;
}

/** Player applies to an open recruitment post. Post authority comes from the route, not the client body. */
export async function applyToPostAction(
  postId: string,
  note: string | undefined,
): Promise<ApplyActionResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await applyToPost(supabase, user.id, { post_id: postId, note: note || undefined });
    return { ok: true, message: "Application sent. The captain will review it." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
