import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/server/env";

// Server-only. Never import from browser code.
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient is server-only.");
  }
  const env = getServerEnv();
  return createServiceClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
