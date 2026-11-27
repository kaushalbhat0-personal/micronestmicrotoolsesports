// Server header wrapper (P14-D10).
// Orchestration only: establish session via cookie client, pass a boolean
// to the interactive shell. No PII (email, id) crosses into navigation.

import { createClient } from "@/lib/supabase/server";
import { SiteHeaderShell } from "./site-header-shell";

export async function SiteHeader() {
  let signedIn = false;
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    signedIn = user !== null;
  } catch {
    signedIn = false;
  }
  return <SiteHeaderShell signedIn={signedIn} />;
}
