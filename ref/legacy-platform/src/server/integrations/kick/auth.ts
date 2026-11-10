export interface KickTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<string> | null = null;

function isExpired(entry: CachedToken): boolean {
  return Date.now() >= entry.expiresAt - 60_000;
}

export function clearKickTokenCache(): void {
  cached = null;
  pending = null;
}

export async function getKickAppToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  if (cached && !isExpired(cached)) return cached.token;
  if (pending) return pending;

  pending = (async () => {
    const res = await fetchFn("https://id.kick.com/oauth/token", {
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
      throw new Error(`Kick token error: ${res.status} ${text}`.trim());
    }
    const data = (await res.json()) as KickTokenResponse;
    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new Error("Kick token malformed response");
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
