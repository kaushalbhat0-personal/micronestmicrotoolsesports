import { NextResponse } from "next/server";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { getCurrentUser } from "@/lib/auth/get-user";
import { generateState } from "@/server/oauth/state";
import { generateVerifier, generateChallenge } from "@/server/oauth/pkce";
import { stateCookieName, verifierCookieName, getStateCookieOptions, getVerifierCookieOptions } from "@/server/oauth/cookies";
import { getOAuthCallbackUrl } from "@/lib/env/callback";
import { isSafeRedirect } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgSlug = url.searchParams.get("orgSlug") ?? "";
  const next = url.searchParams.get("next") ?? `/dashboard/${orgSlug}/connections`;
  const safeNext = isSafeRedirect(next) ? next : `/dashboard/${orgSlug}/connections`;

  if (!orgSlug) return NextResponse.json({ error: "Missing orgSlug" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  if (ctx.user.id !== user.id) {
    return NextResponse.json({ error: "User mismatch" }, { status: 403 });
  }

  // Free-tier quota: connecting another channel is blocked server-side.
  // (Same-channel re-authorization that only updates an existing connected
  // row is still allowed at the callback; new channels are gated here.)
  try {
    const { assertFreeChannelConnectAllowed } = await import("@/server/services/sponsorship-limits");
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await assertFreeChannelConnectAllowed(supabase as never, { userId: user.id, organizationId: ctx.organization.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Twitch not configured" }, { status: 500 });

  const { state } = generateState({ organizationId: ctx.organization.id, userId: user.id, provider: "twitch" });
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);

  const redirectUri = getOAuthCallbackUrl("twitch");
  // Minimal scope: user:read:email is sufficient to identify broadcaster via Get Users; if Twitch allows empty scope we still request this minimal one.
  const scope = "user:read:email";

  const authUrl = new URL("https://id.twitch.tv/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  // Store next in state? Use separate cookie for next redirect (safe)
  const res = NextResponse.redirect(authUrl.toString());
  const stateName = stateCookieName("twitch");
  const verifierName = verifierCookieName("twitch");
  const stateOpts = getStateCookieOptions();
  const verifierOpts = getVerifierCookieOptions();

  res.cookies.set(stateName, state, {
    httpOnly: stateOpts.httpOnly,
    secure: stateOpts.secure,
    sameSite: stateOpts.sameSite as "lax",
    path: stateOpts.path,
    maxAge: stateOpts.maxAge,
  });
  res.cookies.set(verifierName, verifier, {
    httpOnly: verifierOpts.httpOnly,
    secure: verifierOpts.secure,
    sameSite: verifierOpts.sameSite as "lax",
    path: verifierOpts.path,
    maxAge: verifierOpts.maxAge,
  });
  // Store next redirect safely in a short-lived cookie (not in state)
  res.cookies.set(`oauth_next_twitch`, safeNext, {
    httpOnly: true,
    secure: stateOpts.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
