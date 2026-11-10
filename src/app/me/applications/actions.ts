"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import { withdrawMyApplication } from "@/features/finder/services/application-service";

export interface WithdrawResult {
  ok: boolean;
  message: string;
}

/** Player withdraws their own application. */
export async function withdrawApplicationAction(
  applicationId: string,
): Promise<WithdrawResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    await withdrawMyApplication(supabase, user.id, applicationId);
    return { ok: true, message: "Application withdrawn." };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
