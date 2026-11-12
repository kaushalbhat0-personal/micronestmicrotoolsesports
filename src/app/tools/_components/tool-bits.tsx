// Shared tool presentation bits. Functional clarity, not dashboard chrome:
// category kicker, availability marker, compatibility marker. No metrics,
// no scores, no endorsements, no verification badges.

import {
  toolCategoryLabel,
  type ToolAvailability,
  type ToolCategory,
} from "@/features/tools/catalog";
import { getGameByKey } from "@/lib/game-catalog/catalog";

const availabilityStyles: Record<ToolAvailability, string> = {
  available: "bg-emerald-100 text-emerald-900",
  "coming-soon": "bg-slate-100 text-slate-600",
};

export function ToolAvailabilityBadge({ availability }: { availability: ToolAvailability }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${availabilityStyles[availability]}`}
    >
      {availability === "available" ? "Available now" : "Coming soon"}
    </span>
  );
}

export function ToolCategoryBadge({ category }: { category: ToolCategory }) {
  return (
    <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-white uppercase">
      {toolCategoryLabel(category)}
    </span>
  );
}

export function toolCompatibilityLabel(gameKeys: ReadonlyArray<string> | null): string {
  if (gameKeys === null) {
    return "Platform-wide";
  }
  const names = gameKeys.map((key) => getGameByKey(key)?.shortName ?? key);
  return names.join(", ");
}
