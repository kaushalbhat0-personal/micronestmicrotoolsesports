/**
 * Razorpay — integration boundary (mirrors Stripe boundary).
 */

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return {
    keyId,
    keySecret,
    ...(webhookSecret !== undefined ? { webhookSecret } : {}),
  };
}
