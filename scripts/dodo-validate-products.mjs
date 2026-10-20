#!/usr/bin/env node
/**
 * Dodo product diagnostic — read-only, never creates products.
 *
 * Dodo products are dashboard-created and explicitly mapped via
 * DODO_PRODUCT_* env vars. This script validates the mapping against the
 * Dodo API (existence, one-time semantics, currency, amount) WITHOUT
 * touching the database or provisioning anything.
 *
 * Usage:
 *   DODO_PAYMENTS_API_KEY=... DODO_PAYMENTS_ENVIRONMENT=test_mode \
 *     node scripts/dodo-validate-products.mjs [--expect VAR=CURRENCY:AMOUNT ...]
 *
 * Examples:
 *   node scripts/dodo-validate-products.mjs
 *   node scripts/dodo-validate-products.mjs \
 *     --expect DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY=INR:149900 \
 *     --expect DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD=USD:1999
 *
 * Exit codes: 0 = all checks pass, 1 = mismatch found, 2 = misconfigured.
 * NEVER prints secrets (only product ids, currencies, amounts — catalog data).
 */
import DodoPayments from "dodopayments";

const PRODUCT_ENV_VARS = [
  "DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY",
  "DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY",
  "DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD",
  "DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD",
  "DODO_PRODUCT_PRIZE_POOL_SPLITTER_MONTHLY",
  "DODO_PRODUCT_PRIZE_POOL_SPLITTER_YEARLY",
  "DODO_PRODUCT_DRAFT_BAN_MONTHLY",
  "DODO_PRODUCT_DRAFT_BAN_YEARLY",
  "DODO_PRODUCT_TIE_BREAKER_MONTHLY",
  "DODO_PRODUCT_TIE_BREAKER_YEARLY",
  "DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_MONTHLY",
  "DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_YEARLY",
  "DODO_PRODUCT_ALL_ACCESS_MONTHLY",
  "DODO_PRODUCT_ALL_ACCESS_YEARLY",
];

function parseExpectArgs(argv) {
  const expects = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--expect=")) continue;
    const rest = arg.slice("--expect=".length);
    const [envVar, spec] = rest.split("=");
    if (!envVar || !spec) {
      console.error(`Invalid --expect (want VAR=CURRENCY:AMOUNT): ${rest}`);
      process.exit(2);
    }
    const [currency, amountRaw] = spec.split(":");
    const amount = Number(amountRaw);
    if (!currency || !Number.isInteger(amount) || amount <= 0) {
      console.error(`Invalid --expect spec (want VAR=CURRENCY:AMOUNT): ${rest}`);
      process.exit(2);
    }
    expects.set(envVar, { currency, amount });
  }
  return expects;
}

async function main() {
  const expects = parseExpectArgs(process.argv.slice(2));
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
  if (!apiKey) {
    console.error("MISCONFIGURED: DODO_PAYMENTS_API_KEY is not set (no network call made).");
    process.exit(2);
  }

  const client = new DodoPayments({ bearerToken: apiKey, environment });
  let failures = 0;

  for (const envVar of PRODUCT_ENV_VARS) {
    const productId = (process.env[envVar] ?? "").trim();
    if (!productId) {
      console.log(`SKIP ${envVar}: not configured (checkout for that plan fails closed)`);
      continue;
    }
    let product;
    try {
      product = await client.products.retrieve(productId);
    } catch (err) {
      console.error(`FAIL ${envVar} (${productId}): product not found or not accessible`);
      failures += 1;
      continue;
    }
    const price = product?.price ?? {};
    const checks = {
      exists: !!product && product.product_id === productId,
      oneTime: product?.is_recurring === false && price.type === "one_time_price",
      fixedPrice: price.pay_what_you_want !== true,
      currency: typeof price.currency === "string" ? price.currency : "?",
      amount: typeof price.price === "number" ? price.price : "?",
    };
    const expected = expects.get(envVar);
    let match = true;
    if (expected) {
      match = checks.currency === expected.currency && checks.amount === expected.amount;
    }
    const ok = checks.exists && checks.oneTime && checks.fixedPrice && match;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${envVar} (${productId}): ` +
        `type=${price.type ?? "?"} recurring=${String(product?.is_recurring)} ` +
        `currency=${checks.currency} amount=${checks.amount}` +
        (expected ? ` expected=${expected.currency}:${expected.amount}` : "")
    );
  }

  if (failures > 0) {
    console.error(`${failures} product check(s) failed — do not enable checkout for those plans.`);
    process.exit(1);
  }
  console.log("All configured Dodo products validated (one-time, fixed price).");
}

main().catch((err) => {
  console.error(`Diagnostic failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
