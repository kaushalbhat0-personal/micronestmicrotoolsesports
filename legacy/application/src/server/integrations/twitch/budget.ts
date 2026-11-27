import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";

export function createTwitchBudget(limit = 800, windowMs = 60_000, remaining?: number): ProviderBudget {
  return createInMemoryBudget({ platform: "twitch", limit, windowMs }, remaining);
}
