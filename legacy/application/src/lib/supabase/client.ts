import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client — safe for Client Components.
 * Uses secure cookies via @supabase/ssr, NOT localStorage.
 * Only requires anon key (public, RLS-protected).
 *
 * Never use service_role key here.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(url, anonKey);
}
