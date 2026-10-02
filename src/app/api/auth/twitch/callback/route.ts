import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { verifyState } from "@/server/oauth/state";
import { stateCookieName, verifierCookieName } from "@/server/oauth/cookies";
import { getOAuthCallbackUrl } from "@/lib/env/callback";
import { upsertOAuthTokens } from "@/server/credentials/repository";
import { createConnectedChannel } from "@/features/sponsor-sentinel/services/connected-channel-service";
import { revalidatePath } from "next/cache";
import { isSafeRedirect } from "@/lib/validation";

function sanitizeError(msg: string): string {
  return msg.slice(0, 300).replace(/code=[^&\s]+/gi, "code=***").replace(/access_token[^&\s]*/gi, "access_token=***").replace(/refresh_token[^&\s]*/gi, "refresh_token=***");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    // User cancelled or provider error
    const safeMsg = sanitizeError(errorDescription ?? error);
    const isCancelled = error === "access_denied";
    const msg = isCancelled ? "Twitch authorization was cancelled." : `Twitch authorization failed: ${safeMsg}`;
    // Redirect to integrations with error? For now return 400 with message
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(stateCookieName("twitch"))?.value;
  const verifier = cookieStore.get(verifierCookieName("twitch"))?.value;
  const nextCookie = cookieStore.get("oauth_next_twitch")?.value;
  const safeNext = nextCookie && isSafeRedirect(nextCookie) ? nextCookie : null;

  if (!stateCookie) return NextResponse.json({ error: "Missing state cookie" }, { status: 400 });
  if (!verifier) return NextResponse.json({ error: "Missing verifier" }, { status: 400 });
  if (state !== stateCookie) return NextResponse.json({ error: "State mismatch" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify signed state is tenant-bound to this user
  // We need organizationId from state payload itself, but we must also verify it matches an org the user belongs to.
  // Decode without yet knowing orgSlug: verify with expected org from state after decoding raw? Instead we verify after retrieving payload.
  // First, peek payload to get orgId (without full verification of org), then verify fully.
  let payload: ReturnType<typeof verifyState>;
  // We need expectedOrganizationId — we can extract by decoding payload without verification first, then verify fully.
  // Simpler: try to verify against every org? Instead, decode payload JSON without sig check to get orgId, then verify.
  // For now, decode payloadB64
  try {
    const payloadB64 = state.split(".")[0]!;
    const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed = JSON.parse(json) as { orgId: string; userId: string; provider: string };
    payload = verifyState({ state, expectedOrganizationId: parsed.orgId, expectedUserId: user.id, expectedProvider: "twitch" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid state";
    return NextResponse.json({ error: sanitizeError(msg) }, { status: 400 });
  }

  if (payload.userId !== user.id) {
    return NextResponse.json({ error: "User mismatch" }, { status: 400 });
  }

  // Verify user still belongs to that organization
  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    // We need org slug to call requireOrganizationContext, but we only have orgId.
    // Instead, fetch organization slug via admin, then verify membership.
    const admin = createAdminClient();
    const { data: orgRow } = await admin.from("organizations").select("id, slug").eq("id", payload.orgId).single();
    if (!orgRow) return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    // Use requireOrganizationContext with slug to enforce membership
    ctx = await requireOrganizationContext((orgRow as { slug: string }).slug);
    if (ctx.organization.id !== payload.orgId) {
      return NextResponse.json({ error: "Organization mismatch" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Forbidden";
    return NextResponse.json({ error: sanitizeError(msg) }, { status: 403 });
  }

  const orgSlug = ctx.organization.slug;
  const redirectUri = getOAuthCallbackUrl("twitch");
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Twitch not configured" }, { status: 500 });
  }

  // Exchange code for tokens
  let tokenData: { access_token: string; refresh_token?: string; expires_in: number; scope?: string; token_type: string };
  try {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Twitch token exchange ${res.status} ${text}`.trim());
    }
    tokenData = (await res.json()) as typeof tokenData;
    if (!tokenData.access_token || typeof tokenData.expires_in !== "number") throw new Error("Twitch token malformed");
  } catch (e) {
    const msg = e instanceof Error ? sanitizeError(e.message) : "Token exchange failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Get Twitch user identity via Get Users with user token
  let twitchUser: { id: string; login: string; display_name: string };
  try {
    const res = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Client-Id": clientId,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Twitch Get Users ${res.status} ${text}`.trim());
    }
    const json = (await res.json()) as { data: Array<{ id: string; login: string; display_name: string }> };
    const u = json.data?.[0];
    if (!u?.id || !u?.login) throw new Error("Twitch user not found");
    twitchUser = { id: u.id, login: u.login, display_name: u.display_name ?? u.login };
  } catch (e) {
    const msg = e instanceof Error ? sanitizeError(e.message) : "Could not identify Twitch channel";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Persist OAuth tokens encrypted
  const supabaseAdmin = createAdminClient();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  try {
    await upsertOAuthTokens(supabaseAdmin as never, ctx.organization.id, "twitch", {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt,
      scope: tokenData.scope ?? null,
      externalAccountId: twitchUser.id,
      externalAccountLogin: twitchUser.login,
    });
  } catch (e) {
    const msg = e instanceof Error ? sanitizeError(e.message) : "Persist failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Create/update Connected Channel (authorized)
  const supabase = await createClient();
  try {
    // Check existing by platform + external_channel_id
    const { data: existing } = await supabase
      .from("connected_channels")
      .select("id, connection_mode")
      .eq("organization_id", ctx.organization.id)
      .eq("platform", "twitch")
      .eq("external_channel_id", twitchUser.id)
      .maybeSingle();

    if (existing) {
      // Upgrade to authorized if needed
      await supabase
        .from("connected_channels")
        .update({
          external_handle: twitchUser.login,
          display_name: twitchUser.display_name,
          canonical_url: `https://twitch.tv/${twitchUser.login}`,
          connection_mode: "authorized",
          connection_status: "connected",
          authorized_at: new Date().toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
    } else {
      await createConnectedChannel(supabase, ctx.organization.id, {
        platform: "twitch",
        external_channel_id: twitchUser.id,
        external_handle: twitchUser.login,
        display_name: twitchUser.display_name,
        canonical_url: `https://twitch.tv/${twitchUser.login}`,
        connection_mode: "authorized",
        connection_status: "connected",
        authorized_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Channel creation failure should not fail OAuth overall; log and continue
    console.error("[twitch callback channel]", e instanceof Error ? sanitizeError(e.message) : String(e).slice(0, 200));
  }

  // Clear cookies
  const finalUrl = safeNext ?? `/dashboard/${orgSlug}/settings/integrations`;
  const redirectRes = NextResponse.redirect(new URL(finalUrl, request.url).toString());
  redirectRes.cookies.set(stateCookieName("twitch"), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  redirectRes.cookies.set(verifierCookieName("twitch"), "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  redirectRes.cookies.set("oauth_next_twitch", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });

  try {
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
  } catch {}

  return redirectRes;
}
