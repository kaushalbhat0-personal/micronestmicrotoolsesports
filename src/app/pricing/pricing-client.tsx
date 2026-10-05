"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Split, Layers, Check } from "lucide-react";
import type { Route } from "next";
import type { Plan } from "@/types/database";

type BillingPeriod = "monthly" | "yearly";

function formatINR(amountMinor: number): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function periodLabel(p: BillingPeriod): string {
  return p === "monthly" ? "month" : "year";
}

function savingsLabel(monthlyMinor: number, yearlyMinor: number): string | null {
  const twelve = monthlyMinor * 12;
  if (yearlyMinor >= twelve) return null;
  const save = twelve - yearlyMinor;
  return `Save ${formatINR(save)}/year vs monthly`;
}

interface PricingClientProps {
  plans: Plan[];
}

const CARD_META: Record<string, { name: string; positioning: string; icon: React.ComponentType<{ className?: string }>; href: Route; cta: string }> = {
  "sponsorship-tracking": {
    name: "Sponsorship Tracking",
    positioning: "Verify sponsorship deliverables and keep proof organized.",
    icon: ShieldCheck,
    href: "/tools/sponsorship-tracking" as Route,
    cta: "Get Sponsorship Tracking",
  },
  "prize-pool-splitter": {
    name: "Prize Pool Splitter",
    positioning: "Calculate clear, deterministic prize distributions without spreadsheet guesswork.",
    icon: Split,
    href: "/tools/prize-pool-splitter" as Route,
    cta: "Get Prize Pool Splitter",
  },
  "all-access": {
    name: "All Access",
    positioning: "Get every currently available paid MicroNest esports tool in one plan.",
    icon: Layers,
    href: "/tools" as Route,
    cta: "Get All Access",
  },
};

export function PricingClient({ plans }: PricingClientProps) {
  const [period, setPeriod] = React.useState<BillingPeriod>("monthly");

  const bySlug = React.useMemo(() => new Map(plans.map((p) => [p.slug, p])), [plans]);

  const groups: Array<{ key: string; monthly: Plan | undefined; yearly: Plan | undefined }> = [
    { key: "sponsorship-tracking", monthly: bySlug.get("sponsorship-tracking-monthly"), yearly: bySlug.get("sponsorship-tracking-yearly") },
    { key: "prize-pool-splitter", monthly: bySlug.get("prize-pool-splitter-monthly"), yearly: bySlug.get("prize-pool-splitter-yearly") },
    { key: "all-access", monthly: bySlug.get("all-access-monthly"), yearly: bySlug.get("all-access-yearly") },
  ];

  return (
    <div>
      {/* Toggle */}
      <div className="flex justify-center">
        <div role="tablist" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-surface-muted p-1">
          <button
            role="tab"
            aria-selected={period === "monthly"}
            aria-controls="pricing-cards"
            onClick={() => setPeriod("monthly")}
            className={`min-h-[36px] rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "monthly" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Monthly
          </button>
          <button
            role="tab"
            aria-selected={period === "yearly"}
            aria-controls="pricing-cards"
            onClick={() => setPeriod("yearly")}
            className={`min-h-[36px] rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period === "yearly" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Yearly
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">Prices in INR. No automatic renewal — manual renewal only.</p>

      {/* Cards */}
      <div id="pricing-cards" className="mt-8 grid gap-6 lg:grid-cols-3">
        {groups.map(({ key, monthly, yearly }) => {
          const meta = CARD_META[key]!;
          const Icon = meta.icon;
          const plan = period === "monthly" ? monthly : yearly;
          const other = period === "monthly" ? yearly : monthly;
          const isAllAccess = key === "all-access";
          const isAvailable = Boolean(plan);
          // Yearly savings note when viewing yearly
          const savings = period === "yearly" && monthly && yearly ? savingsLabel(monthly.amount_minor, yearly.amount_minor) : null;

          return (
            <Card key={key} className={`flex flex-col ${isAllAccess ? "border-primary/30 shadow-sm" : ""} ${!isAvailable ? "opacity-60" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </span>
                  {isAllAccess ? <Badge variant="success">Best value</Badge> : <Badge variant="secondary">Focused</Badge>}
                </div>
                <CardTitle className="mt-3 text-base">{meta.name}</CardTitle>
                <CardDescription className="leading-relaxed">{meta.positioning}</CardDescription>
                {isAllAccess && <p className="mt-2 text-xs text-muted-foreground">Includes all currently available paid esports tools.</p>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                {plan ? (
                  <>
                    <div className="mt-1">
                      <p className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-normal tracking-tight">{formatINR(plan.amount_minor)}</span>
                        <span className="text-sm text-muted-foreground">/ {periodLabel(plan.billing_period as BillingPeriod)} · INR</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">Billing: {plan.billing_period} · Currency: INR · Plan: {plan.slug}</p>
                      {savings && <p className="mt-2 text-xs font-medium text-success">{savings} — calculated from published monthly/yearly prices.</p>}
                      {period === "monthly" && other && (
                        <p className="mt-1 text-xs text-muted-foreground">Yearly: {formatINR(other.amount_minor)} / year</p>
                      )}
                    </div>
                    <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                      {key === "sponsorship-tracking" && (
                        <ul className="space-y-1.5">
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Campaign requirements & proof by content</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Channel verification — YouTube / Twitch / Kick</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Workspace-scoped access</li>
                        </ul>
                      )}
                      {key === "prize-pool-splitter" && (
                        <ul className="space-y-1.5">
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Percentage / equal / ranked / custom</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Deterministic reconciliation to the last cent</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Shareable payout tables</li>
                        </ul>
                      )}
                      {key === "all-access" && (
                        <ul className="space-y-1.5">
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Sponsorship Tracking + Prize Pool Splitter</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Single plan, single workspace entitlement</li>
                          <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Manual renewal · No AutoPay</li>
                        </ul>
                      )}
                    </div>
                    <div className="mt-6">
                      <Link
                        href={`/signup?plan=${plan.slug}` as Route}
                        aria-label={`${meta.cta} — ${formatINR(plan.amount_minor)} per ${periodLabel(plan.billing_period as BillingPeriod)}`}
                        className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-6 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isAllAccess ? "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)] shadow-sm" : "bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]"}`}
                      >
                        {meta.cta}
                      </Link>
                      <p className="mt-2 text-center text-[11px] text-muted-foreground">Requires MicroNest account & workspace. You’ll pick a workspace at signup.</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Plan unavailable — please contact support.</p>
                )}
                <Link href={meta.href} className="mt-4 inline-flex text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                  Learn more →
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
