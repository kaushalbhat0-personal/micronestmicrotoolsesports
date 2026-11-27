/**
 * Callback URL helper — reuses existing NEXT_PUBLIC_APP_URL / APP_URL.
 * Never trusts Host header or client input.
 */
export function getAppBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();

  if (!raw) {
    return "http://localhost:3000";
  }

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  return withScheme.replace(/\/+$/, "");
}

export function getWebhookCallbackUrl(provider: "twitch" | "kick" | "youtube"): string {
  const base = getAppBaseUrl();
  return `${base}/api/webhooks/${provider}`;
}

export function getOAuthCallbackUrl(provider: "twitch" | "youtube" | "kick"): string {
  const base = getAppBaseUrl();
  return `${base}/api/auth/${provider}/callback`;
}
