"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/get-user";
import { AppError } from "@/lib/errors";
import { setPrimaryOrganizationForUser } from "@/server/services/primary-workspace-service";

export interface SetPrimaryResult {
  ok: boolean;
  message?: string;
  primary?: { id: string; name: string; slug: string } | null;
}

/**
 * Server Action: set or clear the caller's Primary Workspace.
 * Membership is verified server-side; the update is confined to the
 * caller's own profile row (service check + RLS "profiles_update_own").
 * Changes no ownership, membership, entitlement, billing, or data.
 */
export async function setPrimaryWorkspaceAction(organizationId: string | null): Promise<SetPrimaryResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const primary = await setPrimaryOrganizationForUser(supabase, user.id, organizationId);
    return { ok: true, primary };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.safeMessage };
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
