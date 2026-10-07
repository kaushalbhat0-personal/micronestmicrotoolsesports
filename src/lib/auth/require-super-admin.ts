import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./get-user";
import { forbiddenError } from "@/lib/errors";

/**
 * Platform Super Admin guard — separate from organization membership.
 *
 * Security sequence:
 *   requireUser() → verify via is_super_admin() (auth.uid(), SECURITY DEFINER)
 *   → return user if super admin, else 403.
 *
 * Never uses email, env, localStorage, or organization slug.
 * Service-role client is created ONLY after this check by the caller
 * when performing privileged operations (createAdminClient).
 */
export const requireSuperAdmin = cache(async () => {
  const user = await requireUser();

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("is_super_admin");

  // Treat any error as not authorized — do not leak DB details
  if (error) {
    throw forbiddenError("Super admin access required");
  }

  if (data !== true) {
    throw forbiddenError("Super admin access required");
  }

  return user;
});

/**
 * Non-throwing check — useful for conditional UI, not for protection.
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_super_admin");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Alias for semantic clarity where 401 vs 403 distinction matters.
 * requireSuperAdmin already does 401 (via requireUser) vs 403.
 */
export async function assertSuperAdmin() {
  return requireSuperAdmin();
}
