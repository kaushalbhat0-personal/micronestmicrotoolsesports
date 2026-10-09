"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Split, Calendar, CreditCard, RefreshCw, Check, AlertCircle, Infinity as InfinityIcon, ArrowRight, Swords, Scale } from "lucide-react";
import { getPurchaseGuide } from "@/lib/purchase/plan-guidance";

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
};

type AvailableCard = {
  toolSlug: string;
  displayName: string;
  description: string;
  icon: string;
  monthly: { planId: string; amountMinor: number; currency: string } | null;
  yearly: { planId: string; amountMinor: number; currency: string } | null;
};

function toolIcon(icon: string) {
  if (icon === "Swords") return Swords;
  if (icon === "Scale") return Scale;
  if (icon === "Split") return Split;
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
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
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
      const { orderId, razorpayOrderId, amountMinor, currency, keyId } = data as {
        orderId: string;
        razorpayOrderId: string;
        amountMinor: number;
        currency: string;
        keyId: string;
      };

      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(s);
        });
      }
      const selectedPlan = plans.find((p) => p.id === planId);
      const planLabel = selectedPlan ? selectedPlan.name : "MicroNest plan";
      const options = {
        key: keyId,
        amount: amountMinor,
        currency,
        name: "MicroNest",
        description: `${planLabel} \u00B7 Software subscription \u00B7 Digital service for ${organizationSlug} workspace`,
        order_id: razorpayOrderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });
            const vData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(vData.error?.message ?? "Verification failed");
            const paidPlan = plans.find((p) => p.id === planId) ?? null;
            const paidGuide = getPurchaseGuide(paidPlan?.slug);
            setPurchase({
              toolName: paidGuide?.toolName ?? paidPlan?.name ?? "MicroNest",
              toolHref: paidGuide ? paidGuide.toolRoute(organizationSlug) : `/dashboard/${organizationSlug}`,
              firstStep: paidGuide?.firstStep ?? "Open your workspace to start.",
              accessUntil: vData.expiresAt ? formatDate(vData.expiresAt) : "permanent",
            });
            setMessage(null);
            // Refresh billing state without destroying the success guidance
            router.refresh();
          } catch (err) {
            setMessage({ type: "error", text: err instanceof Error ? err.message : "Verification failed" });
          } finally {
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
        theme: { color: "#E86A1A" },
      };
      const rzp = new window.Razorpay!(options);
      rzp.open();
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
      <section>
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
              return (
                <Card key={t.toolSlug} variant="default" className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />
                      {t.displayName}
                      {t.isFree ? (
                        <Badge variant="secondary">Free plan</Badge>
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
                  <CardContent>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.status === "permanent" ? <InfinityIcon className="h-3.5 w-3.5" aria-hidden /> : <Calendar className="h-3.5 w-3.5" aria-hidden />}
                      {expiryLabel(t.expiresAt, t.status)}
                    </p>
                    {t.viaAllAccess && <p className="mt-1 text-xs text-muted-foreground">Included with All Access</p>}
                    {t.viaUserGrant && !t.isFree && <p className="mt-1 text-xs text-muted-foreground">Included with your Sponsorship access</p>}
                    {t.isFree && (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">Free Sponsorship Tracking — 1 campaign, 1 channel, 10 checks a month, 7-day history.</p>
                        <Link
                          href="/pricing"
                          className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Upgrade to Sponsorship Tracking
                        </Link>
                        <p className="mt-1 text-[11px] text-muted-foreground">Manual renewal. No AutoPay.</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Free Sponsorship Tracking claim — no payment, no order, no Razorpay */}
      {showFreeClaim ? (
        <section aria-label="Try Sponsorship Tracking free">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm">Try Sponsorship Tracking free</CardTitle>
              <CardDescription>1 campaign, 1 channel, 10 checks a month. No payment required.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="min-h-[44px]" disabled={loading} onClick={handleClaimFree}>
                Start free
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Available to Add */}
      <section>
        <h2 className="font-display text-lg font-normal tracking-tight">Available to Add</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add another tool to this workspace.</p>
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
                    <div className="space-y-1">
                      {options.map((o) => (
                        <p key={o.planId} className="font-mono text-xs text-muted-foreground">
                          {formatAmount(o.amountMinor, o.currency)} / {o.period === "monthly" ? "month" : "year"}
                        </p>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {options.map((o) => (
                        <Button key={o.planId} size="sm" className="min-h-[44px]" disabled={loading} onClick={() => handleCheckout(o.planId)}>
                          Add {o.period === "monthly" ? "monthly" : "yearly"} — {formatAmount(o.amountMinor, o.currency)}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Current Plan */}
      <section>
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
      <section>
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
            {/* Pre-checkout disclosure — must be visible BEFORE Razorpay */}
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
      <section>
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
