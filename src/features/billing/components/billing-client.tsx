"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Split, Calendar, CreditCard, RefreshCw, Check, AlertCircle, Infinity as InfinityIcon } from "lucide-react";

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
  const d = new Date(expiresAt);
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
  entitlements,
  plans,
  history,
  currentPlan,
}: {
  organizationId: string;
  organizationSlug: string;
  entitlements: EntitlementView[];
  plans: Plan[];
  history: HistoryEntry[];
  currentPlan: Plan | null;
}) {
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(currentPlan?.id ?? null);
  const [showRenew, setShowRenew] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const activePlans = plans.filter((p) => p.slug.includes("monthly") || p.slug.includes("yearly"));
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
            setMessage({ type: "success", text: `Payment successful — access active until ${vData.expiresAt ? formatDate(vData.expiresAt) : "permanent"}.` });
            // Refresh to show updated billing state
            window.location.reload();
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

  return (
    <div className="space-y-8">
      {/* Current Access */}
      <section>
        <h2 className="font-display text-lg font-normal tracking-tight">Current Access</h2>
        <p className="mt-1 text-sm text-muted-foreground">What this workspace can currently access.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {entitlements.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <p className="text-sm text-muted-foreground">No active entitlements.</p>
              </CardContent>
            </Card>
          ) : (
            entitlements.map((e) => (
              <Card key={`${e.isAllAccess ? "all" : e.toolSlug}`} variant={e.status === "expired" ? "default" : "default"} className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {e.isAllAccess ? <ShieldCheck className="h-4 w-4 text-primary" /> : <Split className="h-4 w-4 text-primary" />}
                    {e.displayName}
                    {e.isAllAccess && <Badge variant="success">All Access</Badge>}
                    {e.status === "permanent" && <Badge variant="secondary">Permanent</Badge>}
                    {e.status === "active" && <Badge variant="success">Active</Badge>}
                    {e.status === "expiring_soon" && <Badge variant="warning">Expiring soon</Badge>}
                    {e.status === "expired" && <Badge variant="destructive">Expired</Badge>}
                  </CardTitle>
                  <CardDescription className="text-xs">{e.description || (e.isAllAccess ? "All current and future tools" : "")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {e.status === "permanent" ? <InfinityIcon className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                    {expiryLabel(e.expiresAt, e.status)}
                  </p>
                  {e.isAllAccess && <p className="mt-1 text-xs text-muted-foreground">Includes Sponsorship Tracking and Prize Pool Splitter.</p>}
                </CardContent>
              </Card>
            ))
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
                <p className="mt-1 text-xs text-muted-foreground">All current and future tools — {formatAmount(upgradePlans.find((p) => p.billing_period === "monthly")?.amount_minor ?? 249900, "INR")} / month</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {upgradePlans.map((p) => (
                    <Button key={p.id} variant={selectedPlanId === p.id ? "default" : "outline"} size="sm" onClick={() => setSelectedPlanId(p.id)}>
                      {p.billing_period === "monthly" ? "Monthly ₹2,499" : "Yearly ₹24,990"}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                disabled={!selectedPlanId || loading}
                onClick={() => selectedPlanId && handleCheckout(selectedPlanId)}
                className="min-h-[44px] flex-1"
              >
                {loading ? "Processing…" : "Continue to checkout"}
              </Button>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setShowRenew(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Digital software subscription — workspace access is provided after payment verification. Renews until cancelled; manage in Settings → Billing.
            </p>
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
