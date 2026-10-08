import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { forbiddenError } from "@/lib/errors";
import { findOrganizationById } from "@/server/repositories/organizations";
import {
  findProfileById,
  findOldestMembershipOrganization,
  updatePrimaryOrganizationId,
} from "@/server/repositories/profiles";

export interface PrimaryWorkspace {
  id: string;
  name: string;
  slug: string;
}

/**
 * Service: per-user Primary Workspace preference.
 *
 * Preference only — never authorization. Setting or reading the primary
 * workspace changes no ownership, membership, entitlement, billing, or data.
 * Every consumer must still authorize via membership → entitlement → RLS.
 */

/** Verified primary org, or null when unset, deleted, or membership lapsed. Never writes. */
export async function getPrimaryOrganizationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PrimaryWorkspace | null> {
  const profile = await findProfileById(supabase, userId);
  const primaryId = profile?.primary_organization_id ?? null;
  if (!primaryId) return null;

  // Membership may have lapsed since selection — surface only active memberships.
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", primaryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const org = await findOrganizationById(supabase, primaryId);
  if (!org) return null;
  return { id: org.id, name: org.name, slug: org.slug };
}

/**
 * Set (or clear with null) the caller's own Primary Workspace.
 * Target must exist and the caller must be a member — any role qualifies.
 */
export async function setPrimaryOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null
): Promise<PrimaryWorkspace | null> {
  const caller = await requireUser();
  if (caller.id !== userId) {
    throw forbiddenError("You can only change your own primary workspace");
  }

  if (organizationId !== null) {
    // Reuses the canonical membership helper: 404 when the org is missing,
    // 403 when the caller is not a member. No entitlement or role involved.
    await requireOrganizationMember(organizationId);
    const org = await findOrganizationById(supabase, organizationId);
    if (!org) throw forbiddenError("You are not a member of this organization");
    await updatePrimaryOrganizationId(supabase, userId, organizationId);
    return { id: org.id, name: org.name, slug: org.slug };
  }

  await updatePrimaryOrganizationId(supabase, userId, null);
  return null;
}

/**
 * Runtime display resolution — derived per request, never persisted.
 * Verified primary wins; otherwise the oldest membership org is suggested
 * so UI can hint without silently writing a preference.
 */
export async function resolveDisplayWorkspace(
  supabase: SupabaseClient,
  userId: string
): Promise<{ primary: PrimaryWorkspace | null; fallback: PrimaryWorkspace | null }> {
  const primary = await getPrimaryOrganizationForUser(supabase, userId);
  if (primary) return { primary, fallback: null };
  const fallback = await findOldestMembershipOrganization(supabase, userId);
  return { primary: null, fallback };
}
