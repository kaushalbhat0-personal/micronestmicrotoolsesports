import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

/**
 * AccessDenied — shared customer-facing access screen.
 * Presentation only: renders when a tool page's server gate catches the
 * expected entitlement-denied condition. Never decides access, never
 * queries data, never grants anything. Access stays server-side in
 * `requireEntitlement`; unexpected errors must still throw to boundaries.
 */
export function AccessDenied({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card>
        <CardHeader className="items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted border border-border">
            <Lock className="h-5 w-5 text-muted-foreground" aria-hidden />
          </span>
          <CardTitle className="mt-3 text-base">Tool not active</CardTitle>
          <CardDescription className="leading-relaxed">
            This tool isn&apos;t active for your workspace yet. Check your plan or open Billing to activate access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View plans
          </Link>
          <Link
            href={`/dashboard/${orgSlug}/settings/billing`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open Billing
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
