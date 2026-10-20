import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getBillingExceptions } from "@/server/admin/billing-exceptions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RepairForm } from "@/components/admin/RepairForm";
import { expireStuckOrderAction, replayPaymentCompletionAction } from "@/server/admin/superadmin-actions";
import { FreeRevokeClient } from "./free-revoke-client";
import { AlertTriangle, Receipt, CreditCard, Webhook, Scale } from "lucide-react";

export const dynamic = "force-dynamic";

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function BillingExceptionsPage() {
  await requireSuperAdmin();
  const data = await getBillingExceptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Billing Exceptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Actionable exception states only — stuck orders, replayable payments, failed webhooks, amount mismatches. Three audited repairs.
        </p>
      </div>

      {/* 1. Stuck created orders */}
      <section aria-labelledby="stuck-orders-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span id="stuck-orders-heading">Stuck created orders ({data.stuckOrders.length})</span>
            </CardTitle>
            <CardDescription>status = created, older than 24h. Repair: expire → expired (idempotent).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.stuckOrdersError ? (
              <p className="text-sm text-destructive">{data.stuckOrdersError}</p>
            ) : data.stuckOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stuck orders — nothing to repair.</p>
            ) : (
              data.stuckOrders.map((o) => (
                <div key={o.id} className="rounded-[12px] border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{o.organizationName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{o.dodoSessionId ?? o.razorpayOrderId ?? o.id.slice(0, 8)} · {formatDate(o.createdAt)} · {o.ageHours}h old</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{formatMinor(o.amountMinor, o.currency)}</span>
                      <Badge variant="secondary">{o.status}</Badge>
                    </div>
                  </div>
                  <div className="mt-3">
                    <RepairForm id={o.id} idLabel="Order" actionLabel="Expire order" destinationPreview="created → expired" action={expireStuckOrderAction} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* 2. Replay candidates */}
      <section aria-labelledby="replay-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span id="replay-heading">Captured payments needing completion ({data.replayCandidates.length})</span>
            </CardTitle>
            <CardDescription>payment captured/authorized but order not paid. Repair: replay canonical completion (idempotent, never duplicates).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.replayError ? (
              <p className="text-sm text-destructive">{data.replayError}</p>
            ) : data.replayCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No replay candidates — completions are consistent.</p>
            ) : (
              data.replayCandidates.map((c) => (
                <div key={c.paymentId} className="rounded-[12px] border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{c.organizationName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        payment {c.dodoPaymentId ?? c.razorpayPaymentId ?? c.paymentId.slice(0, 8)} · order {c.orderStatus}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{formatMinor(c.amountMinor, c.currency)}</span>
                      <Badge variant={c.amountMatch === false ? "destructive" : "secondary"}>
                        {c.amountMatch === false ? "amount mismatch" : c.paymentStatus}
                      </Badge>
                    </div>
                  </div>
                  {c.amountMatch === false ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Amount mismatch — manual review required, replay blocked.
                    </p>
                  ) : c.orderStatus === "order-not-found" ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Order not found — manual review required, replay blocked.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <RepairForm id={c.paymentId} idLabel="Payment" actionLabel="Replay completion" destinationPreview={`${c.orderStatus} → paid (idempotent)`} action={replayPaymentCompletionAction} />
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* 3. Orphan webhooks */}
      <section aria-labelledby="orphan-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Webhook className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span id="orphan-heading">Failed Razorpay webhooks ({data.orphanWebhooks.length})</span>
            </CardTitle>
            <CardDescription>Order-not-found / processing failures. Read-only signal — repair via the payment replay above.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.webhooksError ? (
              <p className="text-sm text-destructive">{data.webhooksError}</p>
            ) : data.orphanWebhooks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed Razorpay webhooks.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.orphanWebhooks.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{w.providerEventId.slice(0, 24)}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.eventType ?? "—"} · {formatDate(w.createdAt)}
                      </p>
                    </div>
                    <Badge variant="destructive">{w.status ?? "failed"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 4. Amount mismatches */}
      <section aria-labelledby="mismatch-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span id="mismatch-heading">Amount mismatches ({data.amountMismatches.length})</span>
            </CardTitle>
            <CardDescription>payment vs order amount/currency divergence. Read-only — manual review, never auto-repaired.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.mismatchError ? (
              <p className="text-sm text-destructive">{data.mismatchError}</p>
            ) : data.amountMismatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No amount mismatches in the recent window.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Amount mismatches</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organization</th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payment</th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Order</th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.amountMismatches.map((m) => (
                      <tr key={m.paymentId} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3 font-medium">{m.organizationName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatMinor(m.paymentAmountMinor, m.paymentCurrency)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{formatMinor(m.orderAmountMinor, m.orderCurrency)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.paymentStatus} / {m.orderStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Free-grant revocation</CardTitle>
          <CardDescription>
            Repair for erroneous auto-provisioned Free grants only — source=free, org-scoped, released tool. Paid, subscription, manual, promo,
            All Access, and user-scoped sponsorship grants are rejected. Enter the entitlement ID from Customer 360 or Entitlements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FreeRevokeClient />
        </CardContent>
      </Card>
    </div>
  );
}
