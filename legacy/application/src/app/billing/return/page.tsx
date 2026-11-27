"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type OrderState = "pending" | "paid" | "failed" | "unknown";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Dodo checkout return page.
 * The redirect back is NOT proof of payment — this page polls the
 * member-scoped order-status endpoint and only reports success after the
 * order is actually paid (provisioned via webhook). Never grants access.
 */
function BillingReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [state, setState] = React.useState<OrderState>(orderId ? "pending" : "unknown");
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2 minutes of polling

    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`/api/billing/order-status?orderId=${encodeURIComponent(orderId as string)}`);
        if (!res.ok) throw new Error("status check failed");
        const data = (await res.json()) as { status?: string; expiresAt?: string | null };
        if (cancelled) return;
        if (data.status === "paid") {
          setState("paid");
          setExpiresAt(data.expiresAt ?? null);
          return;
        }
        if (data.status === "failed" || data.status === "expired") {
          setState("failed");
          return;
        }
      } catch {
        // Transient — keep polling until attempts run out
      }
      if (!cancelled && attempts < maxAttempts) {
        window.setTimeout(poll, 3000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-base">
            {state === "paid" ? "Payment successful" : state === "failed" ? "Payment did not complete" : "Confirming your payment…"}
          </CardTitle>
          <CardDescription>
            {state === "paid"
              ? "Your workspace access is now active."
              : state === "failed"
                ? "No charge was applied to your workspace. You can try again."
                : "Do not close this page. We confirm every payment with our payment provider before activating access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state === "paid" ? (
            <>
              <p className="text-muted-foreground">
                Access active{expiresAt ? ` until ${formatDate(expiresAt)}` : ""}. A receipt was sent to your email.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to workspaces
              </Link>
            </>
          ) : state === "failed" || state === "unknown" ? (
            <Link
              href="/dashboard"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Back to workspaces
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              Waiting for payment confirmation…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingReturnPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto w-full max-w-lg px-4 py-10 text-sm text-muted-foreground">Loading…</div>}>
      <BillingReturnContent />
    </React.Suspense>
  );
}
