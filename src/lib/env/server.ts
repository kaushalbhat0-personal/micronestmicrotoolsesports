import { serverSchema } from "./schema";

/**
 * Validated server environment.
 * Import this only in server contexts (Server Components, Route Handlers, Server Actions).
 * Never import in client components.
 *
 * Fails fast with a readable error if required vars are missing.
 */

let cached: ReturnType<typeof serverSchema.parse> | null = null;

function getServerEnv() {
  if (cached) return cached;

  const parsed = serverSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY,
    DODO_PAYMENTS_WEBHOOK_KEY: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
    DODO_PAYMENTS_ENVIRONMENT: process.env.DODO_PAYMENTS_ENVIRONMENT,
    DODO_PAYMENTS_RETURN_URL: process.env.DODO_PAYMENTS_RETURN_URL,
    DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY: process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY,
    DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY: process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY,
    DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD: process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD,
    DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD: process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD,
    DODO_PRODUCT_PRIZE_POOL_SPLITTER_MONTHLY: process.env.DODO_PRODUCT_PRIZE_POOL_SPLITTER_MONTHLY,
    DODO_PRODUCT_PRIZE_POOL_SPLITTER_YEARLY: process.env.DODO_PRODUCT_PRIZE_POOL_SPLITTER_YEARLY,
    DODO_PRODUCT_DRAFT_BAN_MONTHLY: process.env.DODO_PRODUCT_DRAFT_BAN_MONTHLY,
    DODO_PRODUCT_DRAFT_BAN_YEARLY: process.env.DODO_PRODUCT_DRAFT_BAN_YEARLY,
    DODO_PRODUCT_TIE_BREAKER_MONTHLY: process.env.DODO_PRODUCT_TIE_BREAKER_MONTHLY,
    DODO_PRODUCT_TIE_BREAKER_YEARLY: process.env.DODO_PRODUCT_TIE_BREAKER_YEARLY,
    DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_MONTHLY: process.env.DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_MONTHLY,
    DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_YEARLY: process.env.DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_YEARLY,
    DODO_PRODUCT_ALL_ACCESS_MONTHLY: process.env.DODO_PRODUCT_ALL_ACCESS_MONTHLY,
    DODO_PRODUCT_ALL_ACCESS_YEARLY: process.env.DODO_PRODUCT_ALL_ACCESS_YEARLY,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID,
    YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET,
    KICK_CLIENT_ID: process.env.KICK_CLIENT_ID,
    KICK_CLIENT_SECRET: process.env.KICK_CLIENT_SECRET,
    TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
    YOUTUBE_WEBSUB_VERIFY_TOKEN: process.env.YOUTUBE_WEBSUB_VERIFY_TOKEN,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
    CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY,
    BILLING_LIVE_TEST_ENABLED: process.env.BILLING_LIVE_TEST_ENABLED,
    BILLING_LIVE_TEST_ORG_ID: process.env.BILLING_LIVE_TEST_ORG_ID,
    BILLING_LIVE_TEST_USER_EMAIL: process.env.BILLING_LIVE_TEST_USER_EMAIL,
    NODE_ENV: process.env.NODE_ENV,
  });

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    const message = `Invalid server environment variables: ${JSON.stringify(details, null, 2)}`;
    // In production, fail loudly so deployment doesn't silently misbehave.
    throw new Error(message);
  }

  cached = parsed.data;
  return cached;
}

/**
 * Lazy accessor — validates on first use, not on import.
 * Prevents build-time failures when env is not yet configured (e.g., CI without secrets).
 * Use `getServerEnv()` in server contexts.
 */
export function getServerEnvSafe() {
  return getServerEnv();
}

// Backwards-compat alias — deprecated, prefer getServerEnvSafe()
export const serverEnv = {
  get SUPABASE_URL() {
    return getServerEnv().SUPABASE_URL;
  },
  get SUPABASE_ANON_KEY() {
    return getServerEnv().SUPABASE_ANON_KEY;
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  },
  get CRON_SECRET() {
    return getServerEnv().CRON_SECRET;
  },
} as ReturnType<typeof getServerEnv>;

// For testing — reset cache
export function __resetServerEnvCache() {
  cached = null;
}

export { getServerEnv };
