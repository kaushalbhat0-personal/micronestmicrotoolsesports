import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import type { LiveStateProvider, VideoEvidenceProvider } from "@/features/sponsor-sentinel/types/provider";
import { getMockProvider, type MockProvider } from "./mock/provider";
import { TwitchClient } from "./twitch/client";
import { TwitchProvider } from "./twitch/provider";
import { createTwitchBudget } from "./twitch/budget";
import { YouTubeClient } from "./youtube/client";
import { YouTubeProvider } from "./youtube/provider";
import { createYouTubeBudget, createYouTubeSearchBudget } from "./youtube/budget";
import { KickClient } from "./kick/client";
import { KickProvider } from "./kick/provider";
import { createKickBudget } from "./kick/budget";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";

type CombinedProvider = LiveStateProvider & VideoEvidenceProvider;

export interface ProviderRegistryOptions {
  twitchClient?: TwitchClient;
  twitchBudget?: ProviderBudget;
  youtubeClient?: YouTubeClient;
  youtubeBudget?: ProviderBudget;
  youtubeSearchBudget?: ProviderBudget;
  youtubeMock?: MockProvider;
  kickClient?: KickClient;
  kickBudget?: ProviderBudget;
  kickMock?: MockProvider;
  forceMockTwitch?: boolean;
  forceMockYouTube?: boolean;
  forceMockKick?: boolean;
}

export function createProviderRegistry(opts: ProviderRegistryOptions = {}): Record<Platform, CombinedProvider> {
  const useMockTwitch = opts.forceMockTwitch ?? false;
  const useMockYouTube = opts.forceMockYouTube ?? false;

  let twitch: CombinedProvider;
  if (!useMockTwitch) {
    const client = opts.twitchClient ?? createTwitchClientFromEnv();
    if (client) {
      const budget = opts.twitchBudget ?? createTwitchBudget();
      twitch = new TwitchProvider(client, budget) as unknown as CombinedProvider;
    } else {
      twitch = getMockProvider("twitch");
    }
  } else {
    twitch = getMockProvider("twitch");
  }

  let youtube: CombinedProvider;
  if (!useMockYouTube) {
    const client = opts.youtubeClient ?? createYouTubeClientFromEnv();
    if (client) {
      const budget = opts.youtubeBudget ?? createYouTubeBudget();
      const searchBudget = opts.youtubeSearchBudget ?? createYouTubeSearchBudget();
      youtube = new YouTubeProvider(client, budget, searchBudget) as unknown as CombinedProvider;
    } else {
      youtube = opts.youtubeMock ?? getMockProvider("youtube");
    }
  } else {
    youtube = opts.youtubeMock ?? getMockProvider("youtube");
  }

  let kick: CombinedProvider;
  const useMockKick = opts.forceMockKick ?? false;
  if (!useMockKick) {
    const client = opts.kickClient ?? createKickClientFromEnv();
    if (client) {
      const budget = opts.kickBudget ?? createKickBudget();
      kick = new KickProvider(client, budget) as unknown as CombinedProvider;
    } else {
      kick = opts.kickMock ?? getMockProvider("kick");
    }
  } else {
    kick = opts.kickMock ?? getMockProvider("kick");
  }

  return {
    twitch,
    youtube,
    kick,
  };
}

function createTwitchClientFromEnv(): TwitchClient | null {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new TwitchClient({ clientId: id, clientSecret: secret });
}

function createYouTubeClientFromEnv(): YouTubeClient | null {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  return new YouTubeClient({ apiKey: key });
}

function createKickClientFromEnv(): KickClient | null {
  const id = process.env.KICK_CLIENT_ID;
  const secret = process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) return null;
  return new KickClient({ clientId: id, clientSecret: secret });
}

export async function createProviderRegistryForOrg(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  organizationId: string,
  opts: ProviderRegistryOptions & { fetchFn?: typeof fetch } = {},
): Promise<Record<Platform, CombinedProvider>> {
  const fetchFn = opts.fetchFn ?? fetch;
  // Try org OAuth token first, then legacy credentials, then env fallback
  let twitchClient: TwitchClient | null = opts.twitchClient ?? null;
  if (!twitchClient && !opts.forceMockTwitch) {
    // OAuth path (preferred)
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase, organizationId, "twitch");
      if (tok.ok) {
        const clientId = process.env.TWITCH_CLIENT_ID ?? "";
        const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? "";
        // User token path: still need clientId for helix headers, clientSecret not needed for user token but keep for fallback
        twitchClient = new TwitchClient({ clientId: clientId || "oauth", clientSecret: clientSecret || "oauth", userAccessToken: tok.accessToken }, fetchFn);
      }
    } catch {
      // ignore, fallback to legacy
    }
    if (!twitchClient) {
      const { resolveTwitchCredentials } = await import("@/server/credentials/resolver");
      const creds = await resolveTwitchCredentials(supabase, organizationId);
      if (creds) twitchClient = new TwitchClient({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
      else twitchClient = createTwitchClientFromEnv() ? new TwitchClient({ clientId: process.env.TWITCH_CLIENT_ID!, clientSecret: process.env.TWITCH_CLIENT_SECRET! }, fetchFn) : null;
    }
  }
  let youtubeClient: YouTubeClient | null = opts.youtubeClient ?? null;
  if (!youtubeClient && !opts.forceMockYouTube) {
    // OAuth path (preferred)
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase, organizationId, "youtube");
      if (tok.ok) {
        youtubeClient = new YouTubeClient({ accessToken: tok.accessToken }, fetchFn);
      }
    } catch {
      // ignore, fallback to legacy
    }
    if (!youtubeClient) {
      const { resolveYouTubeCredentials } = await import("@/server/credentials/resolver");
      const creds = await resolveYouTubeCredentials(supabase, organizationId);
      if (creds) youtubeClient = new YouTubeClient({ apiKey: creds.apiKey }, fetchFn);
      else youtubeClient = createYouTubeClientFromEnv() ? new YouTubeClient({ apiKey: process.env.YOUTUBE_API_KEY! }, fetchFn) : null;
    }
  }
  let kickClient: KickClient | null = opts.kickClient ?? null;
  if (!kickClient && !opts.forceMockKick) {
    try {
      const { getValidAccessToken } = await import("@/server/credentials/token-service");
      const tok = await getValidAccessToken(supabase, organizationId, "kick");
      if (tok.ok) {
        const clientId = process.env.KICK_CLIENT_ID ?? "";
        const clientSecret = process.env.KICK_CLIENT_SECRET ?? "";
        kickClient = new KickClient({ clientId: clientId || "oauth", clientSecret: clientSecret || "oauth", userAccessToken: tok.accessToken }, fetchFn);
      }
    } catch {
      // ignore, fallback to legacy
    }
    if (!kickClient) {
      const { resolveKickCredentials } = await import("@/server/credentials/resolver");
      const creds = await resolveKickCredentials(supabase, organizationId);
      if (creds) kickClient = new KickClient({ clientId: creds.clientId, clientSecret: creds.clientSecret }, fetchFn);
      else kickClient = createKickClientFromEnv() ? new KickClient({ clientId: process.env.KICK_CLIENT_ID!, clientSecret: process.env.KICK_CLIENT_SECRET! }, fetchFn) : null;
    }
  }
  const registryOpts: Record<string, unknown> = { ...opts };
  if (twitchClient) registryOpts.twitchClient = twitchClient;
  if (youtubeClient) registryOpts.youtubeClient = youtubeClient;
  if (kickClient) registryOpts.kickClient = kickClient;
  return createProviderRegistry(registryOpts as never);
}

export function getProvider(platform: Platform, registry?: Record<Platform, CombinedProvider>): CombinedProvider {
  const reg = registry ?? createProviderRegistry();
  return reg[platform];
}
