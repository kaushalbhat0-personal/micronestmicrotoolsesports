/**
 * Callback URL helper — reuses existing NEXT_PUBLIC_APP_URL / APP_URL.
 * Never trusts Host header or client input.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Fallback for tests / local dev
  if (!raw) return "http://localhost:3000";
  // Ensure no trailing slash
  return raw.replace(/\/+$/, "");
}

export function getWebhookCallbackUrl(provider: "twitch" | "kick" | "youtube"): string {
  const base = getAppBaseUrl();
  return `${base}/api/webhooks/${provider}`;
}
