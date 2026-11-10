import type { BudgetCheck, BudgetConsumption, ProviderBudget } from "../types/budget";
import type { Platform } from "../types/platform";

export interface BudgetConfig {
  readonly platform: Platform;
  readonly limit: number;
  readonly windowMs: number;
}

export function createInMemoryBudget(config: BudgetConfig, initialRemaining?: number): ProviderBudget {
  let remaining = initialRemaining ?? config.limit;
  let resetAt = new Date(Date.now() + config.windowMs).toISOString();

  return {
    platform: config.platform,
    canConsume(cost: number): BudgetCheck {
      if (cost <= 0) {
        return { allowed: true, remaining, retryAfter: null, reason: null };
      }
      if (remaining >= cost) {
        return { allowed: true, remaining, retryAfter: null, reason: null };
      }
      return {
        allowed: false,
        remaining,
        retryAfter: resetAt,
        reason: `insufficient budget: need ${String(cost)}, have ${String(remaining)}`,
      };
    },
    consume(cost: number): BudgetConsumption {
      const check = this.canConsume(cost);
      if (!check.allowed) {
        return { cost, remaining, resetAt };
      }
      remaining -= cost;
      if (remaining < 0) remaining = 0;
      return { cost, remaining, resetAt };
    },
    tryConsume(cost: number): BudgetCheck & { consumed: boolean } {
      if (cost <= 0) return { allowed: true, remaining, retryAfter: null, reason: null, consumed: false };
      if (remaining >= cost) {
        remaining -= cost;
        if (remaining < 0) remaining = 0;
        return { allowed: true, remaining, retryAfter: null, reason: null, consumed: true };
      }
      return { allowed: false, remaining, retryAfter: resetAt, reason: `insufficient budget: need ${String(cost)}, have ${String(remaining)}`, consumed: false };
    },
    resetIfNeeded(nowIso: string): void {
      const now = Date.parse(nowIso);
      const reset = Date.parse(resetAt);
      if (Number.isNaN(now) || Number.isNaN(reset)) return;
      if (now >= reset) {
        remaining = config.limit;
        resetAt = new Date(now + config.windowMs).toISOString();
      }
    },
  };
}
