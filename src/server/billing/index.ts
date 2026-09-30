/**
 * Billing factory — resolves provider without scattering if/provider checks.
 */
import type { BillingProvider, BillingProviderName } from "./provider";

// Future implementations will live in server/integrations/{stripe,razorpay}/provider.ts
// and be returned here. Stub for foundation.

export function getBillingProvider(name: BillingProviderName): BillingProvider {
  throw new Error(`Billing provider ${name} not yet implemented — foundation stub`);
}

export type { BillingProvider, BillingProviderName };
