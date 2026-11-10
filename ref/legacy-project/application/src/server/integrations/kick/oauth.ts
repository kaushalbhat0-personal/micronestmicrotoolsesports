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

type KickUsersResponse = {
  data: Array<{ user_id: number; name: string; email?: string; profile_picture?: string }>;
  message?: string;
};

type KickChannelsResponse = {
  data: Array<{ broadcaster_user_id: number; slug: string; channel_id?: number }>;
  message?: string;
};

export async function getKickUser(accessToken: string, fetchFn: typeof fetch = fetch): Promise<{ id: string; slug: string; username: string }> {
  // Step 1: resolve current authorized user via /public/v1/users (no user_id param = current user)
  const usersRes = await fetchFn("https://api.kick.com/public/v1/users", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!usersRes.ok) {
    const text = await usersRes.text().catch(() => "");
    throw new Error(sanitize(`Kick user identity lookup failed ${usersRes.status} ${text}`));
  }
  const usersJson = (await usersRes.json()) as KickUsersResponse;
  const user = usersJson.data?.[0];
  if (!user || typeof user.user_id === "undefined" || !user.name) {
    throw new Error("Kick authorized user not found");
  }

  // Step 2: resolve current authorized channel via /public/v1/channels (no param = current channel)
  const channelsRes = await fetchFn("https://api.kick.com/public/v1/channels", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!channelsRes.ok) {
    const text = await channelsRes.text().catch(() => "");
    throw new Error(sanitize(`Kick channel lookup failed ${channelsRes.status} ${text}`));
  }
  const channelsJson = (await channelsRes.json()) as KickChannelsResponse;
  const channel = channelsJson.data?.[0];
  if (!channel || typeof channel.broadcaster_user_id === "undefined" || !channel.slug) {
    throw new Error("Kick authorized channel not found");
  }
  // Consistency check: channel must belong to the authenticated user
  if (String(channel.broadcaster_user_id) !== String(user.user_id)) {
    throw new Error("Kick authorized channel not found");
  }

  return { id: String(user.user_id), slug: channel.slug, username: user.name };
}
