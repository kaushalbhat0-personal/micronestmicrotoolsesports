import * as React from "react";
import { Skeleton } from "@/components/ui/loading-state";

/**
 * Billing loading skeleton (RCCF-PLATFORM-NAV-LOADING-08).
 * Structural placeholder mirroring billing-client sections:
 * header, Your Tools, Available tools, Current Plan, Renewal, Billing History.
 * Non-interactive; no fake progress or billing states.
 */
export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading billing" aria-live="polite">
      <span className="sr-only">Loading billing…</span>
      <div aria-hidden="true" className="space-y-8">
        {/* Page header */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>

        {/* Your Tools */}
        <section aria-hidden="true">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-[16px] border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-3 h-3 w-40" />
                <Skeleton className="mt-3 h-9 w-28 rounded-full" />
              </div>
            ))}
          </div>
        </section>

        {/* Available tools */}
        <section aria-hidden="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-72" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-[16px] border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-3 h-3 w-48" />
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-9 w-28 rounded-full" />
                  <Skeleton className="h-9 w-36 rounded-[12px]" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Current Plan */}
        <section aria-hidden="true">
          <Skeleton className="h-6 w-32" />
          <div className="mt-4 rounded-[16px] border border-border/60 bg-card p-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-2 h-3 w-64" />
            <Skeleton className="mt-3 h-3 w-full max-w-sm" />
          </div>
        </section>

        {/* Renewal */}
        <section aria-hidden="true">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-4 w-72" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[96px] rounded-[16px]" />
            <Skeleton className="h-[96px] rounded-[16px]" />
          </div>
          <Skeleton className="mt-4 h-11 w-full rounded-full" />
        </section>

        {/* Billing History */}
        <section aria-hidden="true">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="mt-2 h-4 w-64" />
          <div className="mt-4 overflow-hidden rounded-[16px] border border-border/60">
            <Skeleton className="h-10 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
            <Skeleton className="h-12 w-full rounded-none" />
          </div>
        </section>
      </div>
    </div>
  );
}
