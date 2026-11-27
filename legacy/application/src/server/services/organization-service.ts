import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrganization } from "@/server/repositories/organizations";
import { findProfileById, updatePrimaryOrganizationId } from "@/server/repositories/profiles";
import { parseOrThrow, createOrganizationSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils/format";

/**
 * Service: organizations
 * Orchestrates validation + repository; no HTTP, no UI.
 *
 * Phase 3: creating an organization provisions owner membership ONLY
 * (via the DB trigger). No Sponsorship entitlement is created here or
 * anywhere else on the creation path — the trigger no longer auto-grants
 * sponsor-sentinel.
 */

export async function createOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
  input: unknown
) {
  const parsed = parseOrThrow(createOrganizationSchema, input);

  // Normalize slug
  const slug = slugify(parsed.slug);

  const org = await createOrganization(supabase, {
    name: parsed.name,
    slug,
    owner_id: userId,
  });

  // Primary workspace: set only when the user has none. Never overwrites an
  // existing preference. Preference only — grants no access, no entitlement.
  // Best-effort: a primary-set failure must never fail organization creation
  // (the org + owner membership already exist via the DB trigger).
  try {
    const profile = await findProfileById(supabase, userId);
    if (profile && !profile.primary_organization_id) {
      await updatePrimaryOrganizationId(supabase, userId, org.id);
    }
  } catch (e) {
    console.warn("[createOrganizationForUser] primary workspace not set", e instanceof Error ? e.message : String(e).slice(0, 200));
  }

  return org;
}
