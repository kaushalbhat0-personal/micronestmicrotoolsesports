export interface KickTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

function sanitize(msg: string): string {
  return msg
    .slice(0, 500)
    .replace(/code=[^&\s]+/gi, "code=***")
    .replace(/access_token[^&\s]*/gi, "access_token=***")
    .replace(/refresh_token[^&\s]*/gi, "refresh_token=***")
    .replace(/client_secret[^&\s]*/gi, "client_secret=***");
}

export async function exchangeKickCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<KickTokenResponse> {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Kick not configured");

  const fetchFn = input.fetchFn ?? fetch;
  const res = await fetchFn("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Kick token exchange ${res.status} ${text}`));
  }
  const data = (await res.json()) as KickTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("Kick token malformed");
  return data;
}

export async function refreshKickToken(refreshToken: string, fetchFn: typeof fetch = fetch): Promise<KickTokenResponse> {
  const clientId = process.env.KICK_CLIENT_ID;
  const clientSecret = process.env.KICK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Kick not configured");

  const res = await fetchFn("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Kick refresh ${res.status} ${text}`));
  }
  const data = (await res.json()) as KickTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("Kick refresh malformed");
  return data;
}

export async function getKickUser(accessToken: string, fetchFn: typeof fetch = fetch): Promise<{ id: string; slug: string; username: string }> {
  // Kick authenticated user identity — GET /public/v1/users with Bearer returns current user
  // Fallback to channels if users endpoint not available, try users first
  const res = await fetchFn("https://api.kick.com/public/v1/users", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    // Fallback: try channels with Bearer (some Kick versions return channel for authenticated user)
    const fallback = await fetchFn("https://api.kick.com/public/v1/channels", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (fallback.ok) {
      const json = (await fallback.json()) as { data?: Array<{ id: number; slug: string; user_id?: number; broadcaster_user_id?: number }> };
      const ch = json.data?.[0];
      if (ch) {
        return { id: String(ch.broadcaster_user_id ?? ch.user_id ?? ch.id), slug: ch.slug, username: ch.slug };
      }
    }
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Kick Get Users ${res.status} ${text}`));
  }
  const json = (await res.json()) as { data?: Array<{ id: number; username?: string; slug?: string; email?: string }> | { id: number; username: string } };
  // Handle both array and single object forms
  const dataArray = Array.isArray((json as { data?: unknown }).data) ? (json as { data: Array<Record<string, unknown> > }).data : null;
  const user = dataArray?.[0] as Record<string, unknown> | undefined;
  const single = !dataArray ? (json as Record<string, unknown>) : null;
  const raw: Record<string, unknown> | undefined = user ?? (single as Record<string, unknown> | undefined);
  // Also handle {data: {id, username}} not array
  const id = (raw?.id as number | string | undefined) ?? (json as { id?: number | string })?.id;
  const username = (raw?.username as string | undefined) ?? (raw?.slug as string | undefined) ?? (json as { username?: string })?.username;
  if (!id || !username) {
    // Try alternative: data is { data: { id, slug } }
    const alt = (json as unknown as { data: { id: number; slug: string } })?.data;
    if (alt?.id && alt?.slug) return { id: String(alt.id), slug: alt.slug, username: alt.slug };
    throw new Error("Kick user not found");
  }
  const slug = (raw?.slug as string | undefined) ?? username;
  return { id: String(id), slug: slug as string, username: username as string };
}
