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

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "YouTube not configured" }, { status: 500 });

  const { state } = generateState({ organizationId: ctx.organization.id, userId: user.id, provider: "youtube" });
  const verifier = generateVerifier();
  const challenge = generateChallenge(verifier);

  const redirectUri = getOAuthCallbackUrl("youtube");
  const scope = "https://www.googleapis.com/auth/youtube.readonly";

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("include_granted_scopes", "true");

  const res = NextResponse.redirect(authUrl.toString());
  const stateName = stateCookieName("youtube");
  const verifierName = verifierCookieName("youtube");
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
  res.cookies.set(`oauth_next_youtube`, safeNext, {
    httpOnly: true,
    secure: stateOpts.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return res;
}
