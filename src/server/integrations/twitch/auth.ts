export interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: "bearer";
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<string> | null = null;

function isExpired(entry: CachedToken): boolean {
  // 60s buffer
  return Date.now() >= entry.expiresAt - 60_000;
}

export function clearTwitchTokenCache(): void {
  cached = null;
  pending = null;
}

export async function getAppAccessToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  if (cached && !isExpired(cached)) return cached.token;
  if (pending) return pending;

  pending = (async () => {
    const res = await fetchFn("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Twitch token error: ${res.status} ${text}`.trim());
    }
    const data = (await res.json()) as TwitchTokenResponse;
    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new Error("Twitch token malformed response");
    }
    cached = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

export function getCachedTokenForTests(): string | null {
  return cached?.token ?? null;
}
