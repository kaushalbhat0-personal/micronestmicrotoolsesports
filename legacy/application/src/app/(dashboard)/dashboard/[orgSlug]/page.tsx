import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { createClient } from "@/lib/supabase/server";
import { getAccessibleToolSlugs } from "@/lib/auth/require-entitlement";
import { getPlanContext } from "@/server/billing/plan-context";
import { coveredToolSlugs, formatPlanPrice, getPurchaseGuide, periodLabel } from "@/lib/purchase/plan-guidance";
import { getBillingToolSections } from "@/server/services/billing-service";
import { toCatalogTools } from "@/lib/workspace/catalog-tools";
import {
  formatActivityDate,
  getWorkspaceRecentActivity,
  getWorkspaceSponsorshipStrip,
} from "@/server/services/workspace-activity";
import { ToolCatalogCard } from "@/components/workspace/tool-catalog-card";
import { ShieldCheck, Scale, Swords, ReceiptText, Compass, CreditCard, Sparkles, ArrowRight } from "lucide-react";

/**
 * Toolbox workspace home (RCCF-FIRST-VALUE-FIX-03 F3). Answers
 * "What can I use here?": all released tools with Free status, recent
 * activity across tools, and a compact sponsorship presence. Full
 * sponsorship detail lives in Sponsorship Tracking — this page no longer
 * defines the workspace by it.
 */
export default async function OrgDashboardPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams?: Promise<{ plan?: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const supabase = await createClient();
  const sp = searchParams ? await searchParams : undefined;
  const plan = await getPlanContext(supabase, sp?.plan);
  const guide = getPurchaseGuide(plan?.slug);
  const covered = coveredToolSlugs(plan?.slug);
  const accessible = covered.length > 0 ? await getAccessibleToolSlugs(ctx.organization.id).catch(() => [] as string[]) : [];
  const planReady = covered.length > 0 && covered.every((s) => accessible.includes(s));

  const [sections, activity, strip] = await Promise.all([
    getBillingToolSections(supabase, ctx.organization.id, ctx.user.id).catch(() => ({ yourTools: [], availableToAdd: [] })),
    getWorkspaceRecentActivity(supabase, orgSlug, ctx.organization.id).catch(() => []),
    getWorkspaceSponsorshipStrip(supabase, ctx.organization.id).catch(() => null),
  ]);
  const tools = toCatalogTools(sections.yourTools, sections.availableToAdd);

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="space-y-2">
        <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] sm:text-[32px]">{ctx.organization.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          What can you use here? Open a tool below — every released tool starts free.
        </p>
      </div>

      {plan && guide ? (
        <section aria-label="Purchase progress" className="rounded-[16px] border border-primary/20 bg-primary/5 p-4 sm:p-5">
          {planReady ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Your {guide.toolName} is ready.</p>
                <p className="mt-1 text-xs text-muted-foreground">{guide.firstStep}</p>
              </div>
              <Link
                href={guide.toolRoute(orgSlug) as Route}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open {guide.toolName}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Continue getting {guide.toolName} — {formatPlanPrice(plan.amountMinor, plan.currency)} / {periodLabel(plan.billingPeriod)}.</p>
                <p className="mt-1 text-xs text-muted-foreground">You&apos;ll pay in Billing. Access starts right after payment.</p>
              </div>
              <Link
                href={`/dashboard/${orgSlug}/settings/billing?plan=${plan.slug}` as Route}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CreditCard className="mr-2 h-4 w-4" aria-hidden /> Continue to Billing
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* Tools — every released tool, Free status inline */}
      <section className="space-y-4" aria-labelledby="workspace-tools-heading">
        <SectionHeader
          title="Tools"
          description="Open what you have, start the rest free. Stateless tools never ask for setup."
          icon={<Compass className="h-4 w-4" />}
          action={
            <Link href={`/dashboard/${orgSlug}/tools` as Route} className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary hover:underline">
              All tools <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCatalogCard key={tool.toolSlug} tool={tool} orgSlug={orgSlug} />
          ))}
        </div>
      </section>

      {/* Recent activity across tools */}
      <section className="space-y-3" aria-labelledby="recent-activity-heading">
        <SectionHeader
          title="Recent activity"
          description="Latest work across Tie-Breaker, Draft & Ban, and Payout Tracker."
          icon={<Sparkles className="h-4 w-4" />}
        />
        {activity.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Nothing here yet"
            description="Open a tool above to run your first draft, resolve a tie, or publish a payout list."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60" aria-label="Recent activity">
                {activity.map((item) => {
                  const Icon = item.kind === "competition" ? Scale : item.kind === "match" ? Swords : ReceiptText;
                  return (
                    <li key={`${item.kind}-${item.href}`} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-surface-muted border border-border" aria-hidden>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.detail} · {formatActivityDate(item.at)}
                          </p>
                        </div>
                      </div>
                      <Link href={item.href as Route} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                        View <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Sponsorship presence — compact; full detail lives in Sponsorship Tracking */}
      {strip ? (
        <section className="space-y-3" aria-labelledby="sponsorship-strip-heading">
          <SectionHeader
            title="Sponsorship Tracking"
            description="Proof-of-performance for sponsors — open it for campaigns, checks, and proof."
            icon={<ShieldCheck className="h-4 w-4" />}
            action={
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route} className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open Sponsorship Tracking <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <Card variant="muted">
            <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {strip.activeCampaigns} of {strip.campaignsTotal} campaigns active · {strip.connectedChannels} channels connected
                {strip.lastCheckAt ? ` · last check ${formatActivityDate(strip.lastCheckAt)}${strip.lastCheckPlatform ? ` (${strip.lastCheckPlatform})` : ""}` : " · no checks yet"}
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
