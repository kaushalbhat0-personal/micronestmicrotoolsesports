"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out — single source of truth for logout.
 * Uses existing @supabase/ssr server client (authoritative, cookie-based).
 * Do NOT duplicate with browser localStorage or custom /auth/logout route.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
