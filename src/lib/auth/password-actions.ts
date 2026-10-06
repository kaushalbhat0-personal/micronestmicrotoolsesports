"use server";

import { createClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/env/callback";
import { emailSchema } from "@/lib/validation";

const GENERIC_SUCCESS = "If an account exists for this email, you'll receive a password reset link.";

export interface RequestResetResult {
  ok: boolean;
  message: string;
  fieldError?: string;
}

/**
 * Enumeration-safe password reset request.
 * Always returns generic success to the client, even on Supabase error.
 * Raw errors are not exposed; they are swallowed server-side.
 */
export async function requestPasswordReset(formData: FormData): Promise<RequestResetResult> {
  const raw = String(formData.get("email") ?? "").trim();

  if (!raw) {
    return { ok: false, message: "", fieldError: "Please enter your email address" };
  }

  const parsed = emailSchema.safeParse(raw.toLowerCase());
  if (!parsed.success) {
    return { ok: false, message: "", fieldError: parsed.error.issues[0]?.message ?? "Please enter a valid email address" };
  }

  const email = parsed.data;

  try {
    const supabase = await createClient();
    const redirectTo = `${getAppBaseUrl()}/auth/callback?next=/reset-password`;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    // Intentionally ignore error discriminant — always generic success
  } catch {
    // Swallow — do not leak existence or config
  }

  return { ok: true, message: GENERIC_SUCCESS };
}
