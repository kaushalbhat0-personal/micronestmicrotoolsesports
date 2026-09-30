"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertProviderCredential, updateLastTest, getProviderCredentialRow } from "@/server/credentials/repository";
import { decryptRow } from "@/server/credentials/repository";
import { testTwitchConnection, testKickConnection, testYouTubeConnection } from "@/server/credentials/test-connection";
import type { Provider } from "@/server/credentials/repository";

export async function saveProviderCredential(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  if (!["twitch", "youtube", "kick"].includes(provider)) throw new Error("Invalid provider");
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const clientId = String(formData.get("clientId") ?? "").trim() || undefined;
  const clientSecret = String(formData.get("clientSecret") ?? "").trim() || undefined;
  const apiKey = String(formData.get("apiKey") ?? "").trim() || undefined;

  // Validation: require appropriate fields, never trust orgId from form
  if (provider === "twitch" || provider === "kick") {
    if (!clientId || !clientSecret) throw new Error("Client ID and Secret required");
  }
  if (provider === "youtube" && !apiKey) throw new Error("API Key required");

  const admin = createAdminClient();
  // Use service_role but explicitly scoped to ctx.organization.id (already verified membership)
  const payload: { clientId?: string; clientSecret?: string; apiKey?: string } = {};
  if (clientId !== undefined) payload.clientId = clientId;
  if (clientSecret !== undefined) payload.clientSecret = clientSecret;
  if (apiKey !== undefined) payload.apiKey = apiKey;
  await upsertProviderCredential(admin as never, ctx.organization.id, provider, payload);

  revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  return { ok: true };
}

export async function testProviderCredential(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const admin = createAdminClient();
  const row = await getProviderCredentialRow(admin as never, ctx.organization.id, provider);
  const dec = decryptRow(row);
  let result: { ok: boolean; errorKind?: string };
  if (provider === "twitch") {
    if (!dec?.clientId || !dec?.clientSecret) return { ok: false, errorKind: "not_configured" };
    result = await testTwitchConnection(dec.clientId, dec.clientSecret);
  } else if (provider === "kick") {
    if (!dec?.clientId || !dec?.clientSecret) return { ok: false, errorKind: "not_configured" };
    result = await testKickConnection(dec.clientId, dec.clientSecret);
  } else if (provider === "youtube") {
    if (!dec?.apiKey) return { ok: false, errorKind: "not_configured" };
    result = await testYouTubeConnection(dec.apiKey);
  } else {
    return { ok: false, errorKind: "unsupported" };
  }

  await updateLastTest(admin as never, ctx.organization.id, provider, result.ok ? "success" : "failed");
  revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  // Never return secret, only safe result
  return result;
}

export async function deleteProviderCredential(formData: FormData) {
  const orgSlug = String(formData.get("orgSlug") ?? "");
  const provider = String(formData.get("provider") ?? "") as Provider;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const admin = createAdminClient();
  const { deleteProviderCredential: del } = await import("@/server/credentials/repository");
  await del(admin as never, ctx.organization.id, provider);
  revalidatePath(`/dashboard/${orgSlug}/settings/integrations`);
  return { ok: true };
}
