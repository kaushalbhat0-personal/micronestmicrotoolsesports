export interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: string;
}

function sanitize(msg: string): string {
  return msg.slice(0, 500).replace(/code=[^&\s]+/gi, "code=***").replace(/access_token[^&\s]*/gi, "access_token=***").replace(/refresh_token[^&\s]*/gi, "refresh_token=***").replace(/client_secret[^&\s]*/gi, "client_secret=***");
}

export async function exchangeTwitchCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<TwitchTokenResponse> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Twitch not configured");

  const fetchFn = input.fetchFn ?? fetch;
  const res = await fetchFn("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Twitch token exchange ${res.status} ${text}`));
  }
  const data = (await res.json()) as TwitchTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("Twitch token malformed");
  return data;
}

export async function refreshTwitchToken(refreshToken: string, fetchFn: typeof fetch = fetch): Promise<TwitchTokenResponse> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Twitch not configured");

  const res = await fetchFn("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Twitch refresh ${res.status} ${text}`));
  }
  const data = (await res.json()) as TwitchTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("Twitch refresh malformed");
  return data;
}

export async function getTwitchUser(accessToken: string, fetchFn: typeof fetch = fetch): Promise<{ id: string; login: string; display_name: string }> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("Twitch not configured");
  const res = await fetchFn("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`Twitch Get Users ${res.status} ${text}`));
  }
  const json = (await res.json()) as { data: Array<{ id: string; login: string; display_name: string }> };
  const u = json.data?.[0];
  if (!u?.id || !u?.login) throw new Error("Twitch user not found");
  return { id: u.id, login: u.login, display_name: u.display_name ?? u.login };
}
