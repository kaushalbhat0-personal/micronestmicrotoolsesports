/**
 * Billing — provider-agnostic contracts.
 * Application depends on BillingProvider, not Stripe/Razorpay specifics.
 */

export type BillingProviderName = "stripe" | "razorpay";

export interface BillingProvider {
  readonly name: BillingProviderName;
  createCheckoutSession(params: { organizationId: string; toolSlug?: string; allAccess?: boolean }): Promise<{ url: string }>;
  verifyWebhook(payload: string, signature: string): Promise<{ eventId: string; type: string; data: unknown }>;
}

export interface EntitlementGrant {
  organizationId: string;
  toolSlug?: string; // omit for all-access
  isAllAccess: boolean;
  subscriptionId?: string;
  expiresAt?: Date | null;
}
