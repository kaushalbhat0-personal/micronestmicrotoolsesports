export interface YouTubeTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

function sanitize(msg: string): string {
  return msg
    .slice(0, 500)
    .replace(/code=[^&\s]+/gi, "code=***")
    .replace(/access_token[^&\s]*/gi, "access_token=***")
    .replace(/refresh_token[^&\s]*/gi, "refresh_token=***")
    .replace(/client_secret[^&\s]*/gi, "client_secret=***");
}

export async function exchangeYouTubeCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<YouTubeTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("YouTube not configured");

  const fetchFn = input.fetchFn ?? fetch;
  const res = await fetchFn("https://oauth2.googleapis.com/token", {
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
    throw new Error(sanitize(`YouTube token exchange ${res.status} ${text}`));
  }
  const data = (await res.json()) as YouTubeTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("YouTube token malformed");
  return data;
}

export async function refreshYouTubeToken(refreshToken: string, fetchFn: typeof fetch = fetch): Promise<YouTubeTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("YouTube not configured");

  const res = await fetchFn("https://oauth2.googleapis.com/token", {
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
    throw new Error(sanitize(`YouTube refresh ${res.status} ${text}`));
  }
  const data = (await res.json()) as YouTubeTokenResponse;
  if (!data.access_token || typeof data.expires_in !== "number") throw new Error("YouTube refresh malformed");
  return data;
}

export async function getYouTubeChannelForToken(accessToken: string, fetchFn: typeof fetch = fetch): Promise<{ id: string; title: string; customUrl?: string }> {
  const res = await fetchFn("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(sanitize(`YouTube channels.list mine=true ${res.status} ${text}`));
  }
  const json = (await res.json()) as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string } }> };
  const item = json.items?.[0];
  if (!item?.id) throw new Error("YouTube channel not found");
  const result: { id: string; title: string; customUrl?: string } = { id: item.id, title: item.snippet.title };
  if (item.snippet.customUrl) result.customUrl = item.snippet.customUrl;
  return result;
}
