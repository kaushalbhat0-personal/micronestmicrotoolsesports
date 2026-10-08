/**
 * Server-side OAuth provider availability.
 *
 * The ONLY signal for whether a "Connect {provider}" action may be shown.
 * Reads the same client ID/secret variables the OAuth start/callback
 * routes require — never trust client input, never fake availability.
 */

export type OAuthAvailability = {
  twitch: boolean;
  youtube: boolean;
  kick: boolean;
};

function hasPair(id: string | undefined, secret: string | undefined): boolean {
  return !!id && id.length > 0 && !!secret && secret.length > 0;
}

export function getOAuthAvailability(): OAuthAvailability {
  return {
    twitch: hasPair(process.env.TWITCH_CLIENT_ID, process.env.TWITCH_CLIENT_SECRET),
    youtube: hasPair(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET),
    kick: hasPair(process.env.KICK_CLIENT_ID, process.env.KICK_CLIENT_SECRET),
  };
}

/**
 * YouTube platform API-key fallback for manual channel lookup.
 * Genuinely usable only when the server key the YouTube client reads is set.
 */
export function isYouTubePlatformKeyUsable(): boolean {
  return !!process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.length > 0;
}
