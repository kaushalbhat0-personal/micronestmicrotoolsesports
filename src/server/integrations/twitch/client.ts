/**
 * Twitch Helix API — integration boundary.
 * Business logic must NOT call fetch Helix directly; depend on this client.
 * Keeps vendor details isolated; easy to mock.
 */

export interface TwitchClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface TwitchToken {
  access_token: string;
  expires_in: number;
  token_type: "bearer";
}

export class TwitchClient {
  constructor(private config: TwitchClientConfig) {}

  /** Obtain app access token — server-only, cached externally if needed */
  async getAppToken(): Promise<TwitchToken> {
    const res = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) throw new Error(`Twitch token error: ${res.status}`);
    return res.json() as Promise<TwitchToken>;
  }

  // Future: getVideos, getClips, etc. — add methods here as Sentinel needs them.
}

export function createTwitchClient(): TwitchClient | null {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new TwitchClient({ clientId: id, clientSecret: secret });
}
