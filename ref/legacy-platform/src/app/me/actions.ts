"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import { saveMyProfile } from "@/features/finder/services/profile-service";

export interface SaveMyProfileResult {
  ok: boolean;
  message: string;
  handle?: string;
}

/**
 * Owner profile save. user_id derives from requireUser() — the caller
 * never supplies it. RLS (user_id = auth.uid()) enforces the same
 * invariant at the database layer.
 */
export async function saveMyProfileAction(raw: unknown): Promise<SaveMyProfileResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { profile } = await saveMyProfile(supabase, user.id, raw);
    return { ok: true, message: "Profile saved.", handle: profile.handle };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
