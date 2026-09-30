import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrganization } from "@/server/repositories/organizations";
import { parseOrThrow, createOrganizationSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils/format";

/**
 * Service: organizations
 * Orchestrates validation + repository; no HTTP, no UI.
 */

export async function createOrganizationForUser(
  supabase: SupabaseClient,
  userId: string,
  input: unknown
) {
  const parsed = parseOrThrow(createOrganizationSchema, input);

  // Normalize slug
  const slug = slugify(parsed.slug);

  return createOrganization(supabase, {
    name: parsed.name,
    slug,
    owner_id: userId,
  });
}
