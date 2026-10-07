import type { SupabaseClient } from "@supabase/supabase-js";
import { listActivePlans } from "@/server/repositories/plans";

/**
 * Plan context — server-validated purchase intent for the signup →
 * workspace → billing journey. The plan catalog is authoritative:
 * unknown, inactive, or non-INR slugs resolve to null and callers
 * must fall back to normal (plan-free) behavior with human copy.
 */

export interface PlanContext {
  readonly slug: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly billingPeriod: string;
}

export async function getPlanContext(supabase: SupabaseClient, slug: string | null | undefined): Promise<PlanContext | null> {
  if (!slug || typeof slug !== "string") return null;
  try {
    const plans = await listActivePlans(supabase);
    const plan = plans.find((p) => p.slug === slug && p.currency === "INR" && p.is_active);
    if (!plan) return null;
    return {
      slug: plan.slug,
      name: plan.name,
      amountMinor: plan.amount_minor,
      currency: plan.currency,
      billingPeriod: plan.billing_period,
    };
  } catch {
    return null;
  }
}
