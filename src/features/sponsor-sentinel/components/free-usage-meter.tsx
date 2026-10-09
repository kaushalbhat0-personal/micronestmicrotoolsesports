import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  resolveSponsorshipLimits,
  getFreeUsage,
  FREE_HISTORY_WINDOW_DAYS,
  FREE_MONTHLY_CHECK_LIMIT,
} from "@/server/services/sponsorship-limits";

/**
 * Free-tier usage meter for Sponsorship Tracking pages (server component).
 * Renders only for free-tier users; paid users see nothing (no limits).
 * Customer language only — no internal terminology, no "trial".
 */
export async function FreeUsageMeter({
  userId,
  organizationId,
  orgSlug,
}: {
  userId: string;
  organizationId: string;
  orgSlug: string;
}) {
  const supabase = await createClient();
  let show = false;
  let activeCampaigns = 0;
  let drafts = 0;
  let connectedChannels = 0;
  let checksRemaining = FREE_MONTHLY_CHECK_LIMIT;
  try {
    const limits = await resolveSponsorshipLimits(supabase, { userId, organizationId });
    if (limits.level !== "free") return null;
    show = true;
    const usage = await getFreeUsage(supabase, userId);
    activeCampaigns = usage.activeCampaigns;
    drafts = usage.drafts;
    connectedChannels = usage.connectedChannels;
    checksRemaining = usage.checksRemainingThisMonth;
  } catch {
    return null;
  }
  if (!show) return null;

  const billingHref = `/dashboard/${orgSlug}/settings/billing` as Route;
  return (
    <div className="rounded-[16px] border border-border bg-card p-4" role="status" aria-label="Free plan usage">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Free Sponsorship Tracking</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeCampaigns} of 1 active campaign in use
            {drafts > 0 ? ` · ${drafts} of 1 draft in use` : ""} · {connectedChannels} of 1 channel connected ·{" "}
            {checksRemaining} of {FREE_MONTHLY_CHECK_LIMIT} checks left this month · {FREE_HISTORY_WINDOW_DAYS}-day history
          </p>
        </div>
        <Link
          href={billingHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Upgrade to Sponsorship Tracking
        </Link>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Manual renewal. No AutoPay.</p>
    </div>
  );
}
