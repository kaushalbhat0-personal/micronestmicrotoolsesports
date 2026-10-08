import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { authenticationError, integrationError } from "@/lib/errors";

/**
 * Messages/statuses that mean "no authenticated session" (401 behavior).
 * Anything else from the auth server (network/transport/5xx) is a
 * retryable service failure and must NOT be reported as logged-out.
 */
const NO_SESSION_PATTERNS =
  /auth session missing|session missing|no session|not authenticated|invalid jwt|jwt expired|token (is )?expired|refresh token not found|user not found/i;

function isNoSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: unknown; status?: unknown; code?: unknown };
  if (typeof err.status === "number" && err.status === 401) return true;
  if (typeof err.code === "string" && ["session_not_found", "user_not_found"].includes(err.code)) return true;
  return typeof err.message === "string" && NO_SESSION_PATTERNS.test(err.message);
}

/**
 * Get current authenticated user (or null).
 * Uses getUser() — validates JWT via Supabase Auth server.
 * Never use getSession() for auth checks.
 * Cached per-request via React.cache — dedupes multiple auth.getUser() calls within same render.
 *
 * Returns null ONLY when there is genuinely no authenticated session.
 * Auth transport failures throw a retryable service error instead of
 * masquerading as "logged out".
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isNoSessionError(error)) return null;
    throw integrationError("Authentication service temporarily unavailable", error);
  }
  if (!user) return null;
  return user;
});

/** Require authentication — throws 401 if not authenticated */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw authenticationError();
  return user;
}
