/**
 * Stripe — integration boundary.
 * Keep all Stripe SDK / API calls here so services depend on app contracts.
 *
 * Do NOT scatter `if (provider === 'stripe')` across services.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
}

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  return {
    secretKey,
    ...(webhookSecret !== undefined ? { webhookSecret } : {}),
  };
}

// Future helpers:
// export async function createCheckoutSession(...) {}
// export async function constructWebhookEvent(...) {}
// Exported from this boundary only.
