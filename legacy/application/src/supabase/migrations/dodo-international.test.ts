import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readMigration(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

/** Statements only (strip -- comments): assert on code, not prose. */
function codeOf(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("dodo international V1 migrations — webhook CHECK widening", () => {
  const code = codeOf(readMigration("20251119000001_dodo_webhook_events_allow_dodo.sql"));

  it("widens provider to include dodo while preserving every historical value", () => {
    expect(code).toMatch(/constraint webhook_events_provider_check/i);
    for (const provider of ["stripe", "razorpay", "twitch", "discord", "youtube", "kick", "dodo"]) {
      expect(code).toContain(`'${provider}'`);
    }
  });

  it("widens platform to include dodo while preserving every historical value", () => {
    expect(code).toMatch(/constraint webhook_events_platform_check/i);
    for (const platform of ["twitch", "youtube", "kick", "stripe", "razorpay", "discord", "dodo"]) {
      expect(code).toContain(`'${platform}'`);
    }
  });

  it("does not weaken constraints to unconstrained text", () => {
    expect(code).not.toMatch(/drop column/i);
    expect(code).toMatch(/check \(provider in \(/i);
    expect(code).toMatch(/check \(platform in \(/i);
  });
});

describe("dodo international V1 migrations — INR/USD currency model", () => {
  const code = codeOf(readMigration("20251119000002_billing_currency_inr_usd.sql"));

  it("widens plans/orders/payments currency to INR+USD only", () => {
    expect(code).toMatch(/plans_currency_inr_usd_check/);
    expect(code).toMatch(/orders_currency_inr_usd_check/);
    expect(code).toMatch(/payments_currency_inr_usd_check/);
    const inrUsd = code.match(/check \(currency in \('INR','USD'\)\)/gi) ?? [];
    expect(inrUsd.length).toBe(3);
  });

  it("touches no unrelated currency column", () => {
    expect(code).not.toMatch(/payout/i);
    expect(code).not.toMatch(/settlement/i);
    expect(code).not.toMatch(/EUR|GBP/);
  });

  it("preserves INR defaults by not altering column defaults or rows", () => {
    expect(code).not.toMatch(/alter column .* set default/i);
    expect(code).not.toMatch(/update public\.(plans|orders|payments)/i);
  });
});

describe("dodo international V1 migrations — USD plan placeholders", () => {
  const code = codeOf(readMigration("20251119000003_sponsorship_usd_plans_placeholder.sql"));

  it("reserves exactly the two V1 USD slugs, inactive, USD, sponsor-sentinel linked", () => {
    expect(code).toContain("'sponsorship-tracking-monthly-usd'");
    expect(code).toContain("'sponsorship-tracking-yearly-usd'");
    expect(code).toContain("a1b2c3d4-1234-1234-1234-000000000013");
    expect(code).toContain("a1b2c3d4-1234-1234-1234-000000000014");
    expect(code).toContain("where slug = 'sponsor-sentinel'");
    expect(code).toMatch(/'USD'/g);
    // Inactive placeholders — can never sell
    expect(code).toMatch(/false/);
  });

  it("guards V1 scope: no other USD plan may exist", () => {
    expect(code).toMatch(/Out-of-scope USD plan detected/);
    expect(code).toMatch(/V1 international is Sponsorship Tracking only/);
  });

  it("does not duplicate tool entitlements (same sponsor-sentinel tool, distinct slugs)", () => {
    const slugs = code.match(/'sponsorship-tracking-[a-z]+-usd'/g) ?? [];
    expect(new Set(slugs).size).toBe(2);
    expect(code).not.toMatch(/is_all_access/);
    expect(code).not.toMatch(/tool_id is null|null,\s*\n?\s*'All Access/);
  });
});

describe("dodo international V1 migrations — USD commercial activation", () => {
  const code = codeOf(readMigration("20251120000001_sponsorship_usd_activation.sql"));

  it("updates (never inserts) the two USD rows with approved amounts and activation", () => {
    expect(code).toMatch(/update public\.plans/i);
    expect(code).not.toMatch(/insert into public\.plans/i);
    expect(code).toContain("'sponsorship-tracking-monthly-usd'");
    expect(code).toContain("'sponsorship-tracking-yearly-usd'");
    expect(code).toMatch(/amount_minor = 1900/);
    expect(code).toMatch(/amount_minor = 19000/);
    expect(code).toMatch(/is_active = true/);
    expect(code).toContain("a1b2c3d4-1234-1234-1234-000000000013");
    expect(code).toContain("a1b2c3d4-1234-1234-1234-000000000014");
  });

  it("fails closed on missing/duplicated rows, wrong linkage, scope drift, and INR drift", () => {
    expect(code).toMatch(/missing or duplicated/);
    expect(code).toMatch(/out-of-scope USD plan detected/);
    expect(code).toMatch(/must stay 149900 INR active/);
    expect(code).toMatch(/must stay 1499000 INR active/);
    expect(code).toMatch(/currency != 'USD'/);
  });

  it("does not touch the historical placeholder migration", () => {
    const placeholder = codeOf(readMigration("20251119000003_sponsorship_usd_plans_placeholder.sql"));
    // Placeholder rows stay inert: bare `false` values (column order is in
    // the INSERT header, so no `is_active = false` text exists) and amount 1.
    expect(placeholder).toMatch(/'USD',\n {4}false/);
    expect(placeholder).toMatch(/1,\n {4}'USD',/);
  });
});
describe("dodo international V1 migrations — history preserved", () => {
  it("does not edit historical migrations (foundation stays INR-only, sentinel stays dodo-free)", () => {
    const foundation = codeOf(readMigration("20251007000001_billing_foundation.sql"));
    expect(foundation).toMatch(/currency text not null default 'INR' check \(currency = 'INR'\)/);
    const sentinel = codeOf(readMigration("20251001000001_sponsor_sentinel_core.sql"));
    expect(sentinel).not.toContain("'dodo'");
    expect(sentinel).toMatch(/check \(provider in \('stripe','razorpay','twitch','discord','youtube','kick'\)\)/);
  });
});
