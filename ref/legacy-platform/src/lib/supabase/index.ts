/**
 * Supabase client exports — barrel.
 * Import explicitly for clarity:
 *   - browser:  "@/lib/supabase/client"
 *   - server:   "@/lib/supabase/server"
 *   - admin:    "@/lib/supabase/admin"
 */
export { createClient as createBrowserClient } from "./client";
export { createClient as createServerClient } from "./server";
export { createAdminClient } from "./admin";
export { updateSession } from "./middleware";
