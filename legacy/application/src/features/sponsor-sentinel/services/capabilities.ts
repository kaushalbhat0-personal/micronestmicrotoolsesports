import type { Platform } from "../types/platform";

export interface ProviderCapabilities {
  readonly platform: Platform;
  readonly channelDiscovery: boolean;
  readonly liveState: boolean;
  readonly streamTitle: boolean;
  readonly streamDescription: boolean;
  readonly category: boolean;
  readonly tags: boolean;
  readonly tagSources: readonly string[];
  readonly vodExistence: boolean;
  readonly vodDuration: boolean;
  readonly vodDescription: boolean;
  readonly events: boolean;
}

const CAPABILITIES: Record<Platform, ProviderCapabilities> = {
  twitch: {
    platform: "twitch",
    channelDiscovery: true,
    liveState: true,
    streamTitle: true,
    streamDescription: true,
    category: true,
    tags: true,
    tagSources: ["twitch_curated"],
    vodExistence: true,
    vodDuration: true,
    vodDescription: true,
    events: true,
  },
  youtube: {
    platform: "youtube",
    channelDiscovery: true,
    liveState: true,
    streamTitle: true,
    streamDescription: true,
    category: true,
    tags: true,
    tagSources: ["youtube_freeform"],
    vodExistence: true,
    vodDuration: true,
    vodDescription: true,
    events: true,
  },
  kick: {
    platform: "kick",
    channelDiscovery: true,
    liveState: true,
    streamTitle: true,
    streamDescription: false,
    category: true,
    tags: true,
    tagSources: ["kick", "kick_custom"],
    vodExistence: false,
    vodDuration: false,
    vodDescription: false,
    events: true,
  },
};

export function getCapabilities(platform: Platform): ProviderCapabilities {
  return CAPABILITIES[platform];
}

export function isCapabilitySupported(platform: Platform, capability: keyof ProviderCapabilities): boolean {
  const caps = CAPABILITIES[platform];
  const value = caps[capability];
  if (typeof value === "boolean") return value;
  return false;
}
