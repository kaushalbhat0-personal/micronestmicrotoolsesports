import type { Evidence } from "@/types/database";
import type { Platform } from "@/features/sponsor-sentinel/types/platform";
import { PLATFORM_DISPLAY_ORDER } from "@/features/sponsor-sentinel/types/platform";

/** Pure helper — groups evidence by persisted evidence.platform. */
export function groupEvidenceByPlatform(evidence: readonly Evidence[]): ReadonlyArray<{ platform: Platform; items: Evidence[] }> {
  const byPlatform = new Map<Platform, Evidence[]>();
  for (const ev of evidence) {
    const p = ev.platform as Platform;
    // Type-safe — only known platforms, ignore unknown
    if (p !== "youtube" && p !== "twitch" && p !== "kick") continue;
    const list = byPlatform.get(p) ?? [];
    list.push(ev);
    byPlatform.set(p, list);
  }
  // Deterministic product order, only platforms with proof
  const ordered: Array<{ platform: Platform; items: Evidence[] }> = [];
  for (const p of PLATFORM_DISPLAY_ORDER) {
    const items = byPlatform.get(p);
    if (items && items.length > 0) ordered.push({ platform: p, items });
  }
  return ordered;
}
