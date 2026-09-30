import { createClient } from "@/lib/supabase/server";
import { forbiddenError, notFoundError } from "@/lib/errors";
import { requireUser } from "./get-user";
import type { OrganizationRole } from "@/types/database";

/**
 * Membership authorization — separate from authentication.
 *
 * Usage:
 *   const { user, membership, organization } = await requireOrganizationMember(orgId)
 *   await requireOrganizationRole(orgId, ['owner','admin'])
 */

export interface MembershipContext {
  user: Awaited<ReturnType<typeof requireUser>>;
  membership: {
    id: string;
    organization_id: string;
    user_id: string;
    role: OrganizationRole;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
  };
}

/** Assert user is member of organization — throws 403 otherwise */
export async function requireOrganizationMember(organizationId: string): Promise<MembershipContext> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, owner_id")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) throw notFoundError("Organization not found");

  const { data: membership, error: memError } = await supabase
    .from("organization_members")
    .select("id, organization_id, user_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (memError || !membership) {
    throw forbiddenError("You are not a member of this organization");
  }

  return { user, membership: membership as MembershipContext["membership"], organization: org };
}

/** Assert membership with specific role(s) */
export async function requireOrganizationRole(
  organizationId: string,
  allowedRoles: OrganizationRole[]
): Promise<MembershipContext> {
  const ctx = await requireOrganizationMember(organizationId);
  if (!allowedRoles.includes(ctx.membership.role)) {
    throw forbiddenError(`Requires role: ${allowedRoles.join(" | ")}`);
  }
  return ctx;
}

/** Get all organizations for current user — for org switcher */
export async function getUserOrganizations() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, slug, owner_id, created_at)")
    .eq("user_id", user.id);

  if (error) throw error;
  return data;
}
