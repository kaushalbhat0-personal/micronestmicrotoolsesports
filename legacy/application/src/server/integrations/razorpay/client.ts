/**
 * Razorpay — integration boundary (mirrors Stripe boundary).
 * Canonical config source: uses validated server env when available,
 * falls back to process.env for test environments where server env is not yet configured.
 */

import { getServerEnv } from "@/lib/env/server";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

function readRazorpayFromEnv(): RazorpayConfig | null {
  // Prefer validated server env, but allow raw process.env in tests / non-validated contexts
  let keyId: string | undefined;
  let keySecret: string | undefined;
  let webhookSecret: string | undefined;
  try {
    const env = getServerEnv();
    keyId = (env as Record<string, string | undefined>).RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID;
    keySecret = (env as Record<string, string | undefined>).RAZORPAY_KEY_SECRET ?? process.env.RAZORPAY_KEY_SECRET;
    webhookSecret = (env as Record<string, string | undefined>).RAZORPAY_WEBHOOK_SECRET ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  } catch {
    keyId = process.env.RAZORPAY_KEY_ID;
    keySecret = process.env.RAZORPAY_KEY_SECRET;
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  }
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    ...(webhookSecret !== undefined ? { webhookSecret } : {}),
  };
}

export function getRazorpayConfig(): RazorpayConfig | null {
  return readRazorpayFromEnv();
}

/**
 * Fail-fast helper for checkout/verify hot paths — throws validationError-style
 * if Razorpay is not configured. Caller should map to 400/500 as appropriate.
 */
export function requireRazorpayConfig(): RazorpayConfig {
  const cfg = readRazorpayFromEnv();
  if (!cfg) throw new Error("Razorpay not configured — missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");
  return cfg;
}
