export type Platform = "twitch" | "youtube" | "kick";

export const PLATFORMS: readonly Platform[] = ["twitch", "youtube", "kick"] as const;

/** Deterministic display order for proof sections — product convention, not ranking. */
export const PLATFORM_DISPLAY_ORDER: readonly Platform[] = ["youtube", "twitch", "kick"] as const;

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}
