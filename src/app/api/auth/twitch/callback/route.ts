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
  return msg.slice(0, 300).replace(/code=[^&\s]+/gi, "code=***").replace(/access_token[^&\s]*/gi, "access_token=***").replace(/refresh_token[^&\s]*/gi, "refresh_token=***").replace(/client_secret[^&\s]*/gi, "client_secret=***").replace(/code_verifier[^&\s]*/gi, "code_verifier=***");
}

function clearOAuthCookies(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(stateCookieName("twitch"), "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(verifierCookieName("twitch"), "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set("oauth_next_twitch", "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
}

function errorJson(message: string, status: number): NextResponse {
  const res = NextResponse.json({ error: sanitizeError(message) }, { status });
  clearOAuthCookies(res);
  return res;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const isCancelled = error === "access_denied";
    // Never echo provider error descriptions — they may contain internals.
    const msg = isCancelled ? "Twitch authorization was cancelled." : "Twitch authorization failed. Please try connecting again.";
    return errorJson(msg, 400);
  }

  if (!code || !state) {
    return errorJson("Missing code or state", 400);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(stateCookieName("twitch"))?.value;
  const verifier = cookieStore.get(verifierCookieName("twitch"))?.value;
  const nextCookie = cookieStore.get("oauth_next_twitch")?.value;
  const safeNext = nextCookie && isSafeRedirect(nextCookie) ? nextCookie : null;

  if (!stateCookie) return errorJson("Missing state cookie", 400);
  if (!verifier) return errorJson("Missing verifier", 400);
  if (state !== stateCookie) return errorJson("State mismatch", 400);

  const user = await getCurrentUser();
  if (!user) return errorJson("Unauthorized", 401);

  let payload: ReturnType<typeof verifyState>;
  try {
    const payloadB64 = state.split(".")[0]!;
    const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const parsed = JSON.parse(json) as { orgId: string; userId: string; provider: string };
    payload = verifyState({ state, expectedOrganizationId: parsed.orgId, expectedUserId: user.id, expectedProvider: "twitch" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid state";
    return errorJson(msg, 400);
  }

  if (payload.userId !== user.id) {
    return errorJson("User mismatch", 400);
  }

  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    const admin = createAdminClient();
    const { data: orgRow } = await admin.from("organizations").select("id, slug").eq("id", payload.orgId).single();
    if (!orgRow) return errorJson("Organization not found", 400);
    ctx = await requireOrganizationContext((orgRow as { slug: string }).slug);
    if (ctx.organization.id !== payload.orgId) {
      return errorJson("Organization mismatch", 400);
    }
  } catch {
    // Never expose membership/DB internals from the org check.
    return errorJson("You don't have access to this workspace.", 403);
  }

  const orgSlug = ctx.organization.slug;
  const redirectUri = getOAuthCallbackUrl("twitch");
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorJson("Twitch not configured", 500);
  }

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
  } catch {
    // Never expose provider token-exchange internals.
    return errorJson("We couldn't complete the Twitch connection. Please try again.", 400);
  }

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
  } catch {
    // Never expose provider identity-lookup internals.
    return errorJson("We couldn't identify your Twitch account. Please try again.", 400);
  }

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
  } catch {
    // Token persistence failed — never claim success, never leak DB internals.
    return errorJson("We authorized your Twitch account but couldn't save the connection. Please try connecting again.", 500);
  }

  const supabase = await createClient();
  try {
    const { data: existing } = await supabase
      .from("connected_channels")
      .select("id, connection_mode")
      .eq("organization_id", ctx.organization.id)
      .eq("platform", "twitch")
      .eq("external_channel_id", twitchUser.id)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
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
      if (updateError) throw updateError;
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
    // Channel persistence failed AFTER tokens were saved: do NOT redirect as
    // if the connection succeeded. Log a safe diagnostic and send the user to
    // a customer-safe failure state (no SQL/RLS/UUID details).
    console.error("[twitch callback channel]", e instanceof Error ? sanitizeError(e.message) : String(e).slice(0, 200));
    const failUrl = new URL(`/dashboard/${orgSlug}/connections`, request.url);
    failUrl.searchParams.set("oauth", "channel_save_failed");
    failUrl.searchParams.set("provider", "twitch");
    try {
      revalidatePath(`/dashboard/${orgSlug}/connections`);
    } catch {}
    const failRes = NextResponse.redirect(failUrl.toString());
    clearOAuthCookies(failRes);
    return failRes;
  }

  const finalUrl = safeNext ?? `/dashboard/${orgSlug}/connections`;
  const redirectRes = NextResponse.redirect(new URL(finalUrl, request.url).toString());
  clearOAuthCookies(redirectRes);

  try {
    revalidatePath(`/dashboard/${orgSlug}/connections`);
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
    revalidatePath(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns`);
  } catch {}

  return redirectRes;
}
