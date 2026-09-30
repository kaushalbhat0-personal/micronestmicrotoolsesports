import { createInMemoryBudget } from "@/features/sponsor-sentinel/services/budget";
import type { ProviderBudget } from "@/features/sponsor-sentinel/types/budget";

export function createYouTubeBudget(limit = 10_000, windowMs = 24 * 60 * 60 * 1000, remaining?: number): ProviderBudget {
  return createInMemoryBudget({ platform: "youtube", limit, windowMs }, remaining);
}

export function createYouTubeSearchBudget(
  limit = 100,
  windowMs = 24 * 60 * 60 * 1000,
  remaining?: number,
): ProviderBudget {
  return createInMemoryBudget({ platform: "youtube", limit, windowMs }, remaining);
}
