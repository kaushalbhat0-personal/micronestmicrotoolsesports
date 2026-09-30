import type { Platform } from "./platform";

export type TagSource = "twitch_curated" | "youtube_freeform" | "kick" | "kick_custom";

export interface CanonicalTag {
  readonly value: string;
  readonly source: TagSource;
  readonly platform: Platform;
  readonly label: string;
}

export function isTagSource(value: unknown): value is TagSource {
  return (
    value === "twitch_curated" ||
    value === "youtube_freeform" ||
    value === "kick" ||
    value === "kick_custom"
  );
}
