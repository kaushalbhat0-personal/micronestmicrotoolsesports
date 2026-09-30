import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client — service_role.
 * ──────────────────────────────────────────
 * SECURITY: This client BYPASSES RLS.
 * ──────────────────────────────────────────
 * Rules:
 * - Only import in server-only contexts
 * - Never import in Client Components or browser utils
 * - Only use for operations that explicitly require elevated privilege:
 *   * webhook handlers (verified)
 *   * cron jobs (authenticated via CRON_SECRET)
 *   * admin operations with explicit authorization checks
 *
 * Fail fast if service_role key missing.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing Supabase URL (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL)");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — admin client requires service_role key. Never expose this client-side."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
