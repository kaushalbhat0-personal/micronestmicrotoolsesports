import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirect";

// Email-confirmation / recovery / OAuth callback (P14-D10).
// Completes the `?code=` exchange server-side so httpOnly cookies are set,
// then redirects to a validated same-origin `next` destination.
// No open redirects: `next` is allowlisted; everything else → workspace.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    // Invalid/expired codes fail closed to login with a generic message.
    if (error) {
      const loginUrl = new URL("/login", url.origin);
      loginUrl.searchParams.set("error", "link-expired");
      loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
