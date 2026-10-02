"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertProviderCredential, updateLastTest, getProviderCredentialRow } from "@/server/credentials/repository";
import { decryptRow } from "@/server/credentials/repository";
import { testTwitchConnection, testKickConnection, testYouTubeConnection } from "@/server/credentials/test-connection";
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

  const clientId = String(formData.get("clientId") ?? "").trim() || undefined;
  const clientSecret = String(formData.get("clientSecret") ?? "").trim() || undefined;
  const apiKey = String(formData.get("apiKey") ?? "").trim() || undefined;

  // Validation: require appropriate fields, never trust orgId from form
  if (provider === "twitch" || provider === "kick") {
    if (!clientId || !clientSecret) return { ok: false, error: "Client ID and Secret required" };
  }
  if (provider === "youtube" && !apiKey) return { ok: false, error: "API Key required" };

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

  const admin = createAdminClient();
  const payload: { clientId?: string; clientSecret?: string; apiKey?: string } = {};
  if (clientId !== undefined) payload.clientId = clientId;
  if (clientSecret !== undefined) payload.clientSecret = clientSecret;
  if (apiKey !== undefined) payload.apiKey = apiKey;

  try {
    await upsertProviderCredential(admin as never, ctx.organization.id, provider, payload);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    // Never log payload (may contain secrets) — log only provider and org prefix
    console.error("[saveProviderCredential persist failed]", provider, ctx.organization.id.slice(0, 8), e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
    return { ok: false, error: "We couldn't save your connection. Please try again." };
  }

  // Revalidation is best-effort — persistence already succeeded, don't falsely report failure
  try {
    revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.warn("[saveProviderCredential revalidate failed]", e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200));
  }
  return { ok: true };
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
  const dec = decryptRow(row);
  let result: { ok: boolean; errorKind?: string };
  if (provider === "twitch") {
    // OAuth takes precedence over legacy
    const oauth = await getValidAccessToken(admin as never, ctx.organization.id, "twitch");
    if (oauth.ok) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      if (!clientId) return { ok: false, errorKind: "not_configured" };
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
    } else if (dec?.clientId && dec?.clientSecret) {
      result = await testTwitchConnection(dec.clientId, dec.clientSecret);
    } else {
      return { ok: false, errorKind: "not_configured" };
    }
  } else if (provider === "kick") {
    if (!dec?.clientId || !dec?.clientSecret) return { ok: false, errorKind: "not_configured" };
    result = await testKickConnection(dec.clientId, dec.clientSecret);
  } else if (provider === "youtube") {
    if (!dec?.apiKey) return { ok: false, errorKind: "not_configured" };
    result = await testYouTubeConnection(dec.apiKey);
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
