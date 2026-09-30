import { createClient } from "@/lib/supabase/server";
import { forbiddenError, notFoundError } from "@/lib/errors";
import { requireUser } from "./get-user";
import type { OrganizationRole } from "@/types/database";
import { findOrganizationContext } from "@/server/repositories/organizations";

/**
 * Canonical organization context — URL slug is identifier, membership is authorization.
 * Every org-scoped feature must obtain this context first.
 *
 * Flow: URL orgSlug → find org by slug → verify membership → return context
 */

export interface OrganizationContext {
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    role: OrganizationRole;
    id: string;
  };
  user: Awaited<ReturnType<typeof requireUser>>;
}

/**
 * Require organization context — throws 401/404/403 if invariants violated.
 * Caller can safely assume: user authenticated, org exists, user is member.
 */
export async function requireOrganizationContext(orgSlug: string): Promise<OrganizationContext> {
  const user = await requireUser();
  const supabase = await createClient();

  const result = await findOrganizationContext(supabase, orgSlug, user.id);

  if (!result) {
    // Distinguish 404 vs 403 without leaking via RLS: check existence via admin (bypasses RLS) if available.
    let existsViaAdmin = false;
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { data: orgExists } = await admin.from("organizations").select("id").eq("slug", orgSlug).single();
      existsViaAdmin = !!orgExists;
    } catch {
      // Admin unavailable (e.g., tests) → fall back to secure default (404)
      existsViaAdmin = false;
    }
    if (existsViaAdmin) throw forbiddenError("You are not a member of this organization");
    throw notFoundError("Organization not found");
  }

  return {
    organization: result.organization,
    membership: result.membership as OrganizationContext["membership"],
    user,
  };
}

/**
 * Get organization context or null — for conditional rendering / 404 handling.
 * Does not throw on not-found/forbidden, returns null.
 */
export async function getOrganizationContext(orgSlug: string): Promise<OrganizationContext | null> {
  try {
    return await requireOrganizationContext(orgSlug);
  } catch {
    return null;
  }
}
