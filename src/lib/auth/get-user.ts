import { createClient } from "@/lib/supabase/server";
import { authenticationError } from "@/lib/errors";

/**
 * Get current authenticated user (or null).
 * Uses getUser() — validates JWT via Supabase Auth server.
 * Never use getSession() for auth checks.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/** Require authentication — throws 401 if not authenticated */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw authenticationError();
  return user;
}
