import type { Platform } from "./platform";

export interface BudgetCheck {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfter: string | null;
  readonly reason: string | null;
}

export interface BudgetConsumption {
  readonly cost: number;
  readonly remaining: number;
  readonly resetAt: string | null;
}

export interface ProviderBudget {
  readonly platform: Platform;
  canConsume(cost: number): BudgetCheck;
  consume(cost: number): BudgetConsumption;
  /** Atomic check+consume — concurrency-safe for bounded parallel channels */
  tryConsume(cost: number): BudgetCheck & { consumed: boolean };
  resetIfNeeded(nowIso: string): void;
}
