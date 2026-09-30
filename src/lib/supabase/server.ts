import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase client — for Server Components, Route Handlers, and Server Actions.
 * Correctly handles secure cookie-based session via Next.js cookies().
 *
 * - Uses anon key (RLS enforced)
 * - Session stored in httpOnly cookies (not localStorage)
 * - Call within request context (headers/cookies available)
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Narrow boundary: Supabase CookieOptions ↔ Next ResponseCookie mismatch
      // is isolated here. The cast is required because next/headers cookies().set
      // overload differs from Supabase's CookieOptions under exactOptionalPropertyTypes.
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Isolated third-party boundary — Supabase → Next cookie adaptation
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll called from Server Component — middleware will handle refresh.
          // This catch is required by @supabase/ssr docs.
        }
      },
    },
  });
}
