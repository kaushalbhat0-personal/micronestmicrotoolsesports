"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Split, Calendar, CreditCard, RefreshCw, Check, AlertCircle, Infinity as InfinityIcon, ArrowRight, Swords, Scale, ReceiptText, ClipboardList } from "lucide-react";
import { FreePlanBadge } from "@/components/freemium/free-plan-badge";
import { UpgradeCTA } from "@/components/freemium/upgrade-cta";
import {
  claimFreeSponsorshipBillingAction,
  claimFreePrizeSplitterBillingAction,
  claimFreeDraftBanBillingAction,
  claimFreeTieBreakerBillingAction,
  claimFreePayoutTrackerBillingAction,
  claimFreeRosterBuilderBillingAction,
} from "../actions/claim-actions";

type BillingFreeInfo = {
  badge: "Free forever" | "Free plan";
  allowance: string;
  details: string;
};

type ToolCard = {
  toolSlug: string;
  displayName: string;
  description: string;
  icon: string;
  status: "permanent" | "active" | "expiring_soon" | "expired" | "none";
  expiresAt: string | null;
  viaAllAccess: boolean;
  viaUserGrant: boolean;
  isFree?: boolean;
  /** Canonical Free presentation (server-built from FREE_TIERS). */
  free: BillingFreeInfo | null;
  /** Whether current access is Free, paid, or via All Access. */
  accessKind: "free" | "paid" | "all-access";
  /** True when an active paid plan exists (upgrade may be offered). */
  hasPaidPlans: boolean;
};

type AvailableCard = {
  toolSlug: string;
  displayName: string;
  description: string;
  icon: string;
  monthly: { planId: string; amountMinor: number; currency: string } | null;
  yearly: { planId: string; amountMinor: number; currency: string } | null;
  /** International (USD) offers — server-set, Sponsorship Tracking only in V1. */
  usdMonthly?: { planId: string; amountMinor: number; currency: string } | null;
  usdYearly?: { planId: string; amountMinor: number; currency: string } | null;
  /** Canonical Free presentation (server-built from FREE_TIERS). */
  free: BillingFreeInfo | null;
  /** True when the workspace may self-claim Free. */
  claimable: boolean;
};

/**
 * Server-bound Free-claim actions by canonical tool slug. The client only
 * supplies the workspace slug at call time; each action binds its tool
 * slug server-side, so client input never drives authorization.
 */
const claimActionFor: Record<string, (orgSlug: string) => Promise<{ ok?: boolean; error?: string }>> = {
  "sponsor-sentinel": claimFreeSponsorshipBillingAction,
  "prize-splitter": claimFreePrizeSplitterBillingAction,
  "draft-ban": claimFreeDraftBanBillingAction,
  "tie-breaker": claimFreeTieBreakerBillingAction,
  "payout-tracker": claimFreePayoutTrackerBillingAction,
  "roster-builder": claimFreeRosterBuilderBillingAction,
};

function toolIcon(icon: string) {
  if (icon === "Swords") return Swords;
  if (icon === "Scale") return Scale;
  if (icon === "Split") return Split;
  if (icon === "ReceiptText") return ReceiptText;
  if (icon === "ClipboardList") return ClipboardList;
  return ShieldCheck;
}

type EntitlementView = {
  toolSlug: string | null;
  displayName: string;
  description: string;
  isAllAccess: boolean;
  source: string;
  expiresAt: string | null;
  status: "permanent" | "active" | "expiring_soon" | "expired" | "none";
};

type Plan = {
  id: string;
  name: string;
  slug: string;
  billing_period: string;
  amount_minor: number;
  currency: string;
  tool_id: string | null;
};

type HistoryEntry = {
  id: string;
  date: string;
  planName: string;
  planSlug: string;
  billingPeriod: string;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayPaymentId: string | null;
};

function formatAmount(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  // Locale follows the authoritative currency (INR → en-IN, USD → en-US).
  // Currency itself always comes from the server-resolved plan/order.
  const locale = currency === "USD" ? "en-US" : "en-IN";
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function expiryLabel(expiresAt: string | null, status: string): string {
  if (status === "permanent" || !expiresAt) return "Permanent access";
  if (status === "expired") return `Expired on ${formatDate(expiresAt)}`;
  if (status === "expiring_soon") return `Expiring soon — ${formatDate(expiresAt)}`;
  return `Active until ${formatDate(expiresAt)}`;
}

/**
 * FreeBlock — Free-first presentation for a tool card. Badge + canonical
 * allowance + details, all server-supplied. Nothing is hardcoded here.
 */
function FreeBlock({ free }: { free: BillingFreeInfo }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-wide text-foreground">
        <FreePlanBadge label={free.badge} /> <span className="sr-only">Free tier:</span>
      </p>
      <p className="text-xs text-muted-foreground">Free — {free.allowance}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{free.details}</p>
    </div>
  );
}

/**
 * ClaimButton — per-card "Start free" for a claimable tool. Calls the
 * server-bound action for its slug with the workspace slug only, then
 * refreshes Billing state. No tool identity travels from client to server
 * beyond selecting which pre-bound action runs.
 */
function ClaimButton({ toolSlug, displayName, organizationSlug }: { toolSlug: string; displayName: string; organizationSlug: string }) {
  const router = useRouter();
  const [claiming, setClaiming] = React.useState(false);
  const [claimError, setClaimError] = React.useState<string | null>(null);
  const action = claimActionFor[toolSlug];
  if (action === undefined) return null;
  async function onClaim() {
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await action?.(organizationSlug);
      if (res?.error) throw new Error(res.error);
      router.refresh();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Could not start free access");
    } finally {
      setClaiming(false);
    }
  }
  return (
    <div>
      <Button size="sm" className="min-h-[44px]" disabled={claiming} loading={claiming} onClick={onClaim} aria-label={`Start ${displayName} free`}>
        Start free
      </Button>
      {claimError ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {claimError}
        </p>
      ) : null}
    </div>
  );
}

export function BillingClient({
  organizationId,
  organizationSlug,
  organizationName,
  entitlements,
  yourTools = [],
  availableToAdd = [],
  plans,
  history,
  currentPlan,
  hintedPlanSlug,
  showFreeClaim = false,
  freeClaimCopy = null,
}: {
  organizationId: string;
  organizationSlug: string;
  organizationName?: string;
  entitlements: EntitlementView[];
  yourTools: ToolCard[];
  availableToAdd: AvailableCard[];
  plans: Plan[];
  history: HistoryEntry[];
  currentPlan: Plan | null;
  hintedPlanSlug?: string | null;
  showFreeClaim?: boolean;
  /** Canonical Sponsorship Free copy for the standalone claim card. */
  freeClaimCopy?: BillingFreeInfo | null;
}) {
  const displayOrgName = organizationName ?? organizationSlug;
  const initialHintedPlanId = React.useMemo(() => {
    if (!hintedPlanSlug) return null;
    const p = plans.find((x) => x.slug === hintedPlanSlug && x.currency === "INR");
    return p?.id ?? null;
  }, [hintedPlanSlug, plans]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(initialHintedPlanId ?? currentPlan?.id ?? null);
  const [showRenew, setShowRenew] = React.useState(Boolean(initialHintedPlanId));
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [purchase, setPurchase] = React.useState<{ toolName: string; toolHref: string; firstStep: string; accessUntil: string } | null>(null);
  const router = useRouter();

  // Keep selected plan in sync if hint arrives after mount (client navigation)
  React.useEffect(() => {
    if (initialHintedPlanId && !selectedPlanId) {
      setSelectedPlanId(initialHintedPlanId);
      setShowRenew(true);
    }
  }, [initialHintedPlanId, selectedPlanId]);

  const hasPermanent = entitlements.some((e) => e.status === "permanent");
  const hasFinite = entitlements.some((e) => e.status === "active" || e.status === "expiring_soon");
  const hasAllAccess = entitlements.some((e) => e.isAllAccess);

  // Determine renewal family: if currentPlan exists, use its tool family, else use first entitlement or default to all-access
  const renewalFamily = React.useMemo(() => {
    if (currentPlan?.tool_id) {
      // Find tool slug for current plan's tool_id via plans
      const toolId = currentPlan.tool_id;
      // Group by tool_id
      return plans.filter((p) => p.tool_id === toolId);
    }
    if (hasAllAccess) return plans.filter((p) => p.tool_id === null);
    // Fallback: show sponsorship-tracking monthly/yearly as default
    return plans.filter((p) => p.slug.includes("sponsorship-tracking"));
  }, [currentPlan, plans, hasAllAccess]);

  const upgradePlans = React.useMemo(() => {
    if (hasAllAccess) return [];
    return plans.filter((p) => p.tool_id === null);
  }, [plans, hasAllAccess]);

  async function handleCheckout(planId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, organizationId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Checkout failed");
      const { orderId, checkoutUrl, amountMinor, currency } = data as {
        orderId: string;
        checkoutUrl?: string;
        amountMinor: number;
        currency: string;
      };
      if (!checkoutUrl) throw new Error("Checkout unavailable — please try again");

      // Dodo hosted checkout: full redirect. Provisioning happens via webhook;
      // the return page polls order status and never claims success itself.
      setMessage({ type: "success", text: `Opening secure checkout for ${formatAmount(amountMinor, currency)}…` });
      window.location.href = checkoutUrl;
      void orderId;
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Checkout failed" });
      setLoading(false);
    }
  }

  async function handleClaimFree() {
    setLoading(true);
    setMessage(null);
    try {
      const { claimFreeSponsorshipAction } = await import("@/features/sponsor-sentinel/actions/free-tier-actions");
      const res = await claimFreeSponsorshipAction(organizationSlug);
      if (res?.error) throw new Error(res.error);
      router.refresh();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not start free access" });
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {purchase ? (
        <section aria-label="Purchase complete" className="rounded-[16px] border border-success/30 bg-success-soft/40 p-4 sm:p-5" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-4 w-4" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold">Your {purchase.toolName} access is ready.</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Payment successful — access active until {purchase.accessUntil}.</p>
          <p className="mt-1 text-sm text-muted-foreground">{purchase.firstStep}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              href={purchase.toolHref as never}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open {purchase.toolName} <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setPurchase(null)}>
              Back to Billing
            </Button>
          </div>
        </section>
      ) : null}
      {/* Your Tools */}
      <section aria-label="Your tools">
        <h2 className="font-display text-lg font-normal tracking-tight">Your Tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tools currently active in this workspace.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {yourTools.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">No active access yet.</p>
              </CardContent>
            </Card>
          ) : (
            yourTools.map((t) => {
              const Icon = toolIcon(t.icon);
              const isFreeAccess = t.accessKind === "free";
              return (
                <Card key={t.toolSlug} variant="default" className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                      {t.displayName}
                      {isFreeAccess && t.free ? (
                        <FreePlanBadge label={t.free.badge} />
                      ) : (
                        <>
                          {t.status === "permanent" && <Badge variant="secondary">Permanent</Badge>}
                          {t.status === "active" && <Badge variant="success">Active</Badge>}
                          {t.status === "expiring_soon" && <Badge variant="warning">Expiring soon</Badge>}
                        </>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">{t.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isFreeAccess && t.free ? (
                      <FreeBlock free={t.free} />
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t.status === "permanent" ? <InfinityIcon className="h-3.5 w-3.5" aria-hidden /> : <Calendar className="h-3.5 w-3.5" aria-hidden />}
                        {expiryLabel(t.expiresAt, t.status)}
                      </p>
                    )}
                    {!isFreeAccess && t.free ? (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">Free baseline included — {t.free.allowance}</p>
                    ) : null}
                    {t.viaAllAccess && <p className="mt-1 text-xs text-muted-foreground">Included with All Access</p>}
                    {t.viaUserGrant && t.accessKind !== "free" && <p className="mt-1 text-xs text-muted-foreground">Included with your Sponsorship access</p>}
                    {isFreeAccess && t.hasPaidPlans ? (
                      <div>
                        <UpgradeCTA href="/pricing" label={`Upgrade to ${t.displayName}`} />
                        <p className="mt-1 text-[11px] text-muted-foreground">Manual renewal. No AutoPay.</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Free Sponsorship Tracking claim — no payment, no order, no Razorpay.
          Copy comes from the canonical FREE_TIERS entry via props. Hidden
          when Sponsorship already has its own Start-free card below. */}
      {showFreeClaim && freeClaimCopy && !availableToAdd.some((t) => t.toolSlug === "sponsor-sentinel") ? (
        <section aria-label="Try Sponsorship Tracking free">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm">Try Sponsorship Tracking free</CardTitle>
              <CardDescription>{freeClaimCopy.allowance}. No payment required.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="min-h-[44px]" disabled={loading} onClick={handleClaimFree}>
                Start free
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Available tools — free-first: every tool shows its Free tier.
          Paid Add buttons appear only where active paid plans exist. */}
      <section aria-label="Available tools">
        <h2 className="font-display text-lg font-normal tracking-tight">Available tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start free or add a paid plan — every tool includes a Free tier.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {availableToAdd.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">Everything available is already active in this workspace.</p>
              </CardContent>
            </Card>
          ) : (
            availableToAdd.map((t) => {
              const Icon = toolIcon(t.icon);
              const options = [t.monthly ? { ...t.monthly, period: "monthly" as const } : null, t.yearly ? { ...t.yearly, period: "yearly" as const } : null].filter(
                (o): o is { planId: string; amountMinor: number; currency: string; period: "monthly" | "yearly" } => o !== null
              );
              const hasPaid = options.length > 0;
              // International (USD) offers: separate, explicitly labeled market.
              // Server-authoritative planIds flow into the same hardened
              // checkout endpoint; currency always comes from the plan.
              const usdOptions = [t.usdMonthly ? { ...t.usdMonthly, period: "monthly" as const } : null, t.usdYearly ? { ...t.usdYearly, period: "yearly" as const } : null].filter(
                (o): o is { planId: string; amountMinor: number; currency: string; period: "monthly" | "yearly" } => o !== null
              );
              return (
                <Card key={t.toolSlug} variant="default" className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                      {t.displayName}
                    </CardTitle>
                    <CardDescription className="text-xs">{t.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {t.free ? <FreeBlock free={t.free} /> : null}
                    <div className="flex flex-wrap gap-2">
                      {t.claimable ? (
                        <ClaimButton toolSlug={t.toolSlug} displayName={t.displayName} organizationSlug={organizationSlug} />
                      ) : null}
                    </div>
                    {hasPaid ? (
                      <>
                        <div className="space-y-1">
                          {options.map((o) => (
                            <p key={o.planId} className="font-mono text-xs text-muted-foreground">
                              {formatAmount(o.amountMinor, o.currency)} / {o.period === "monthly" ? "month" : "year"}
                            </p>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {options.map((o) => (
                            <Button key={o.planId} size="sm" variant="outline" className="min-h-[44px]" disabled={loading} onClick={() => handleCheckout(o.planId)} aria-label={`Add ${t.displayName} ${o.period} — ${formatAmount(o.amountMinor, o.currency)}`}>
                              Add {o.period === "monthly" ? "monthly" : "yearly"} — {formatAmount(o.amountMinor, o.currency)}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {usdOptions.length > 0 ? (
                      <div className="space-y-1 border-t border-border/40 pt-3">
                        <p className="text-xs font-medium text-foreground">International (USD)</p>
                        <div className="flex flex-wrap gap-2">
                          {usdOptions.map((o) => (
                            <Button key={o.planId} size="sm" variant="outline" className="min-h-[44px]" disabled={loading} onClick={() => handleCheckout(o.planId)} aria-label={`Add ${t.displayName} ${o.period} international — ${formatAmount(o.amountMinor, o.currency)} USD`}>
                              Add {o.period === "monthly" ? "monthly" : "yearly"} — {formatAmount(o.amountMinor, o.currency)} USD
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Current Plan */}
      <section aria-label="Current plan">
        <h2 className="font-display text-lg font-normal tracking-tight">Current Plan</h2>
        {currentPlan ? (
          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> {currentPlan.name}
              </CardTitle>
              <CardDescription>
                {currentPlan.billing_period === "monthly" ? "Monthly" : "Yearly"} · {formatAmount(currentPlan.amount_minor, currentPlan.currency)} / {currentPlan.billing_period} · {currentPlan.currency}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Purchased plan for this workspace. Renewal extends access via the same billing period.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">No paid plan</CardTitle>
              <CardDescription>This workspace has no paid plan associated with a recent order. Access may be permanent manual provisioning.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      {/* Renewal */}
      <section aria-label="Renewal">
        <h2 className="font-display text-lg font-normal tracking-tight">Renewal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasPermanent ? "You have permanent access. You can still purchase a paid plan for renewal or upgrade." : hasFinite ? "Renew your access before it expires." : "Choose a plan to get access."}
        </p>
        {!showRenew ? (
          <Button onClick={() => setShowRenew(true)} className="mt-4 min-h-[44px]" variant="default">
            <RefreshCw className="h-4 w-4" /> Renew
          </Button>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {renewalFamily.map((plan) => (
                <Card key={plan.id} className={`cursor-pointer border-2 ${selectedPlanId === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`} onClick={() => setSelectedPlanId(plan.id)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{plan.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {formatAmount(plan.amount_minor, plan.currency)} / {plan.billing_period}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={selectedPlanId === plan.id ? "success" : "secondary"}>{plan.billing_period}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
            {upgradePlans.length > 0 && (
              <div className="rounded-[12px] border border-border bg-card p-4">
                <p className="text-sm font-medium">Upgrade to All Access</p>
                {(() => {
                  const monthlyPlan = upgradePlans.find((p) => p.billing_period === "monthly") ?? null;
                  const yearlyPlan = upgradePlans.find((p) => p.billing_period === "yearly") ?? null;
                  const headline = monthlyPlan
                    ? `All currently available tools — ${formatAmount(monthlyPlan.amount_minor, monthlyPlan.currency)} / month.`
                    : yearlyPlan
                      ? `All currently available tools — ${formatAmount(yearlyPlan.amount_minor, yearlyPlan.currency)} / year.`
                      : "All currently available tools.";
  return (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {headline} Covers only the tools available at the time of purchase; future tools are not automatically included.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {upgradePlans.map((p) => (
                          <Button key={p.id} variant={selectedPlanId === p.id ? "default" : "outline"} size="sm" onClick={() => setSelectedPlanId(p.id)}>
                            {p.billing_period === "monthly" ? "Monthly" : "Yearly"} {formatAmount(p.amount_minor, p.currency)}
                          </Button>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {/* Pre-checkout disclosure — must be visible BEFORE hosted checkout */}
            {selectedPlanId &&
              (() => {
                const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
                if (!selectedPlan) return null;
                return (
                  <Card className="border-primary/20 bg-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Purchase summary</CardTitle>
                      <CardDescription>Review exactly what you will pay before continuing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid gap-2 rounded-[12px] border border-border bg-surface-muted/30 p-4">
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Plan</span>
                          <span className="font-medium text-foreground">{selectedPlan.name}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Billing period</span>
                          <span className="font-medium capitalize">{selectedPlan.billing_period}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Price</span>
                          <span className="font-medium font-mono">
                            {formatAmount(selectedPlan.amount_minor, selectedPlan.currency)} / {selectedPlan.billing_period === "monthly" ? "month" : "year"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Currency</span>
                          <span className="font-medium">{selectedPlan.currency}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">Workspace</span>
                          <span className="font-medium">{displayOrgName}</span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-foreground">Manual renewal only. No automatic renewal or recurring charge is enabled.</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Payments are non-refundable after access has been provisioned, subject to investigation of duplicate or erroneous charges.{" "}
                        <a href="/refund" className="underline underline-offset-4 hover:text-foreground">
                          Refund Policy
                        </a>
                        .
                      </p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        By continuing, you agree to the{" "}
                        <a href="/terms" className="underline underline-offset-4 hover:text-foreground">
                          Terms
                        </a>{" "}
                        and acknowledge the{" "}
                        <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                          Privacy Policy
                        </a>{" "}
                        and{" "}
                        <a href="/refund" className="underline underline-offset-4 hover:text-foreground">
                          Refund Policy
                        </a>
                        .
                      </p>
                      <Link href="/pricing" className="inline-flex text-xs font-medium text-primary hover:underline">
                        Change plan — View pricing →
                      </Link>
                    </CardContent>
                  </Card>
                );
              })()}
            <div className="flex gap-2">
              <Button
                disabled={!selectedPlanId || loading}
                onClick={() => selectedPlanId && handleCheckout(selectedPlanId)}
                className="min-h-[44px] flex-1"
              >
                {loading
                  ? "Processing…"
                  : (() => {
                      const sp = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) : null;
                      return sp ? `Pay ${formatAmount(sp.amount_minor, sp.currency)} — Continue to payment` : "Continue to payment";
                    })()}
              </Button>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setShowRenew(false)}>
                Cancel
              </Button>
            </div>
            {message && (
              <p className={`flex items-center gap-1.5 text-xs ${message.type === "success" ? "text-success" : "text-destructive"}`}>
                {message.type === "success" ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {message.text}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Billing History */}
      <section aria-label="Billing history">
        <h2 className="font-display text-lg font-normal tracking-tight">Billing History</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recent orders and payments for this workspace.</p>
        <Card className="mt-4 overflow-hidden">
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Plan</th>
                    <th className="px-4 py-2.5 font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No billing history yet.
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{formatDate(h.date)}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-xs">{h.planName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{h.billingPeriod}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatAmount(h.amountMinor, h.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={h.status === "paid" || h.status === "captured" ? "success" : h.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                            {h.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Mobile card list */}
          <div className="divide-y divide-border/40 sm:hidden">
            {history.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No billing history yet.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">{h.planName}</p>
                    <Badge variant={h.status === "paid" || h.status === "captured" ? "success" : h.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                      {h.status}
                    </Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {formatAmount(h.amountMinor, h.currency)} · {h.billingPeriod} · {formatDate(h.date)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
