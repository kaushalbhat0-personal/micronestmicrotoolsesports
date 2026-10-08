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
import { exchangeKickCode, getKickUser } from "@/server/integrations/kick/oauth";

function sanitizeError(msg: string): string {
  return msg.slice(0, 300).replace(/code=[^&\s]+/gi, "code=***").replace(/access_token[^&\s]*/gi, "access_token=***").replace(/refresh_token[^&\s]*/gi, "refresh_token=***").replace(/client_secret[^&\s]*/gi, "client_secret=***").replace(/code_verifier[^&\s]*/gi, "code_verifier=***");
}

function clearOAuthCookies(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(stateCookieName("kick"), "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set(verifierCookieName("kick"), "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
  res.cookies.set("oauth_next_kick", "", { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 0 });
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
    const msg = isCancelled ? "Kick authorization was cancelled." : "Kick authorization failed. Please try connecting again.";
    return errorJson(msg, 400);
  }

  if (!code || !state) {
    return errorJson("Missing code or state", 400);
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(stateCookieName("kick"))?.value;
  const verifier = cookieStore.get(verifierCookieName("kick"))?.value;
  const nextCookie = cookieStore.get("oauth_next_kick")?.value;
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
    payload = verifyState({ state, expectedOrganizationId: parsed.orgId, expectedUserId: user.id, expectedProvider: "kick" });
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
  const redirectUri = getOAuthCallbackUrl("kick");

  let tokenData: { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
  try {
    tokenData = await exchangeKickCode({ code, codeVerifier: verifier, redirectUri });
  } catch {
    // Never expose provider token-exchange internals.
    return errorJson("We couldn't complete the Kick connection. Please try again.", 400);
  }

  let kickUser: { id: string; slug: string; username: string };
  try {
    kickUser = await getKickUser(tokenData.access_token);
  } catch {
    // Never expose provider identity-lookup internals.
    return errorJson("We couldn't identify your Kick account. Please try again.", 400);
  }

  const supabaseAdmin = createAdminClient();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
  try {
    await upsertOAuthTokens(supabaseAdmin as never, ctx.organization.id, "kick", {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresAt,
      scope: tokenData.scope ?? "user:read channel:read",
      externalAccountId: kickUser.id,
      externalAccountLogin: kickUser.slug,
    });
  } catch {
    // Token persistence failed — never claim success, never leak DB internals.
    return errorJson("We authorized your Kick account but couldn't save the connection. Please try connecting again.", 500);
  }

  const supabase = await createClient();
  try {
    const { data: existing } = await supabase
      .from("connected_channels")
      .select("id, connection_mode")
      .eq("organization_id", ctx.organization.id)
      .eq("platform", "kick")
      .eq("external_channel_id", kickUser.id)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("connected_channels")
        .update({
          external_handle: kickUser.slug,
          display_name: kickUser.username,
          canonical_url: `https://kick.com/${kickUser.slug}`,
          connection_mode: "authorized",
          connection_status: "connected",
          authorized_at: new Date().toISOString(),
        })
        .eq("id", (existing as { id: string }).id);
      if (updateError) throw updateError;
    } else {
      await createConnectedChannel(supabase, ctx.organization.id, {
        platform: "kick",
        external_channel_id: kickUser.id,
        external_handle: kickUser.slug,
        display_name: kickUser.username,
        canonical_url: `https://kick.com/${kickUser.slug}`,
        connection_mode: "authorized",
        connection_status: "connected",
        authorized_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    // Channel persistence failed AFTER tokens were saved: do NOT redirect as
    // if the connection succeeded. Log a safe diagnostic and send the user to
    // a customer-safe failure state (no SQL/RLS/UUID details).
    console.error("[kick callback channel]", e instanceof Error ? sanitizeError(e.message) : String(e).slice(0, 200));
    const failUrl = new URL(`/dashboard/${orgSlug}/connections`, request.url);
    failUrl.searchParams.set("oauth", "channel_save_failed");
    failUrl.searchParams.set("provider", "kick");
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
