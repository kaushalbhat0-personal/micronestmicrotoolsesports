"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLastTest, getProviderCredentialRow } from "@/server/credentials/repository";
import { decryptRow } from "@/server/credentials/repository";
import type { Provider } from "@/server/credentials/repository";
import { AppError } from "@/lib/errors";
import { getValidAccessToken } from "@/server/credentials/token-service";
import { TwitchClient } from "@/server/integrations/twitch/client";

type SaveResult = { ok: true } | { ok: false; error: string };

function isNextRedirect(e: unknown): boolean {
  return e instanceof Error && e.message.includes("NEXT_REDIRECT");
}

export async function saveProviderCredential(formData: FormData): Promise<SaveResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  if (!["twitch", "youtube", "kick"].includes(provider)) {
    return { ok: false, error: "Invalid provider" };
  }

  // All providers are now OAuth-only — no manual persistence via this action.
  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    if (e instanceof AppError) {
      console.warn(`[saveProviderCredential ${e.code}]`, e.safeMessage);
      return { ok: false, error: e.safeMessage };
    }
    console.error("[saveProviderCredential auth unexpected]", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
    return { ok: false, error: "We couldn't save your connection. Please try again." };
  }

  // Customer manual credentials removed — OAuth-only for all providers.
  const clientIdRaw = String(formData.get("clientId") ?? "").trim();
  const clientSecretRaw = String(formData.get("clientSecret") ?? "").trim();
  const apiKeyRaw = String(formData.get("apiKey") ?? "").trim();
  if (clientIdRaw || clientSecretRaw || apiKeyRaw) {
    return { ok: false, error: "Manual credentials are no longer supported. Please use Connect via OAuth." };
  }

  // No customer credential to persist — OAuth flow handles persistence via callback.
  if (provider === "twitch" || provider === "kick" || provider === "youtube") {
    return { ok: false, error: `Connect ${provider.charAt(0).toUpperCase() + provider.slice(1)} via OAuth. Manual entry is no longer supported.` };
  }

  void ctx;
  return { ok: false, error: "Invalid provider" };
}

export async function testProviderCredential(formData: FormData): Promise<{ ok: boolean; errorKind?: string; error?: string }> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  if (!["twitch", "youtube", "kick"].includes(provider)) return { ok: false, errorKind: "unsupported", error: "Invalid provider" };
  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    if (e instanceof AppError) return { ok: false, errorKind: "auth", error: e.safeMessage };
    return { ok: false, errorKind: "server", error: "We couldn't test your connection. Please try again." };
  }
  const admin = createAdminClient();
  const row = await getProviderCredentialRow(admin as never, ctx.organization.id, provider);
  void decryptRow; void row;
  let result: { ok: boolean; errorKind?: string };
  if (provider === "twitch") {
    const oauth = await getValidAccessToken(admin as never, ctx.organization.id, "twitch");
    if (oauth.ok) {
      const clientId = process.env.TWITCH_CLIENT_ID ?? "oauth";
      try {
        const client = new TwitchClient(
          { clientId, clientSecret: process.env.TWITCH_CLIENT_SECRET ?? "oauth", userAccessToken: oauth.accessToken },
        );
        // Lightweight authenticated request — Get Users with user token
        await client.getUsersByLogin(["twitch"]);
        result = { ok: true };
      } catch (e) {
        const kind = (e as { kind?: string }).kind ?? "server";
        if (kind === "auth") result = { ok: false, errorKind: "auth" };
        else result = { ok: false, errorKind: kind };
      }
    } else {
      return { ok: false, errorKind: "not_configured" };
    }
  } else if (provider === "kick") {
    const oauth = await getValidAccessToken(admin as never, ctx.organization.id, "kick");
    if (oauth.ok) {
      try {
        const { getKickUser } = await import("@/server/integrations/kick/oauth");
        await getKickUser(oauth.accessToken);
        result = { ok: true };
      } catch (e) {
        const kind = (e as { kind?: string }).kind ?? "auth";
        if (kind === "auth") result = { ok: false, errorKind: "auth" };
        else result = { ok: false, errorKind: kind };
      }
    } else {
      return { ok: false, errorKind: "not_configured" };
    }
  } else if (provider === "youtube") {
    const oauth = await getValidAccessToken(admin as never, ctx.organization.id, "youtube");
    if (oauth.ok) {
      try {
        const { getYouTubeChannelForToken } = await import("@/server/integrations/youtube/oauth");
        await getYouTubeChannelForToken(oauth.accessToken);
        result = { ok: true };
      } catch (e) {
        const kind = (e as { kind?: string }).kind ?? "auth";
        if (kind === "auth") result = { ok: false, errorKind: "auth" };
        else if (kind === "quota_exceeded") result = { ok: false, errorKind: "quota_exceeded" };
        else result = { ok: false, errorKind: kind };
      }
    } else {
      return { ok: false, errorKind: "not_configured" };
    }
  } else {
    return { ok: false, errorKind: "unsupported" };
  }

  try {
    await updateLastTest(admin as never, ctx.organization.id, provider, result.ok ? "success" : "failed");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.warn("[testProviderCredential updateLastTest failed]", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
  }
  try {
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.warn("[testProviderCredential revalidate failed]", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
  }
  // Never return secret, only safe result
  return result;
}

export async function deleteProviderCredential(formData: FormData): Promise<SaveResult> {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  if (!["twitch", "youtube", "kick"].includes(provider)) return { ok: false, error: "Invalid provider" };
  let ctx: Awaited<ReturnType<typeof requireOrganizationContext>>;
  try {
    ctx = await requireOrganizationContext(orgSlug);
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    if (e instanceof AppError) {
      console.warn(`[deleteProviderCredential ${e.code}]`, e.safeMessage);
      return { ok: false, error: e.safeMessage };
    }
    return { ok: false, error: "We couldn't remove your connection. Please try again." };
  }
  const admin = createAdminClient();
  const { deleteProviderCredential: del } = await import("@/server/credentials/repository");
  try {
    await del(admin as never, ctx.organization.id, provider);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("[deleteProviderCredential failed]", provider, e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
    return { ok: false, error: "We couldn't remove your connection. Please try again." };
  }
  try {
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.warn("[deleteProviderCredential revalidate failed]", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
  }
  return { ok: true };
}
