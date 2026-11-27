import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";

export function createKickBudget(limit = 300, windowMs = 60_000, remaining?: number): ProviderBudget {
  return createInMemoryBudget({ platform: "kick", limit, windowMs }, remaining);
}
