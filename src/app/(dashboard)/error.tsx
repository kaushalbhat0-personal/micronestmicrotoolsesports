"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { mapDashboardError } from "@/lib/errors/dashboard-error";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams();
  const orgSlug = typeof params?.orgSlug === "string" ? params.orgSlug : null;
  // Customer-safe mapping only — the raw error text is never rendered.
  const view = mapDashboardError(error);
  const isAccessIssue = view.kind === "access";

  return (
    <div className="mx-auto max-w-2xl py-12">
      <ErrorState title={view.title} message={view.message} {...(view.showRetry ? { retry: reset } : {})} />
      {view.kind === "authentication" ? (
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </div>
      ) : isAccessIssue ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View plans
          </Link>
          {orgSlug ? (
            <Link
              href={`/dashboard/${orgSlug}/settings/billing`}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open Billing
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      )}
    </div>
  );
}
