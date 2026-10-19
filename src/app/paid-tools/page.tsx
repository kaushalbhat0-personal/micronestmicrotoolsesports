import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { toolIcon } from "@/components/marketing/tool-icon-map";
import { getAllAccessEntry, getPaidProductEntries } from "@/lib/marketing/paid-products";
import { freeBadgeByMarketingSlug, freeTierByMarketingSlug } from "@/config/marketing/free-tiers";
import { TOOL_PLAN_PREFIX, buildOffers } from "@/lib/marketing/tool-offers";
import { createClient } from "@/lib/supabase/server";
import { listActivePlans } from "@/server/repositories/plans";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Paid Tools — Operator Workflows for Esports | MicroNest",
  description:
    "MicroNest paid tools: Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, and Prize Payout Tracker — plus All Access. Every tool starts free.",
  alternates: { canonical: "/paid-tools" },
  openGraph: {
    title: "Paid Tools — MicroNest",
    description: "Focused operator tools for sponsorships, prize pools, drafts, standings, and payouts.",
    url: "/paid-tools",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Paid Tools — MicroNest",
    description: "Focused operator tools for esports. Every tool starts free.",
  },
};

/** Monthly teaser price from the server-authoritative plan catalog — never hardcoded. */
async function monthlyTeaser(prefix: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const plans = await listActivePlans(supabase);
    const monthly = plans.find((p) => p.slug === `${prefix}-monthly` && p.currency === "INR" && p.is_active);
    if (!monthly) return null;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
      monthly.amount_minor / 100
    );
  } catch {
    return null;
  }
}

export default async function PaidToolsPage() {
  const entries = getPaidProductEntries();
  const allAccess = getAllAccessEntry();
  const teasers = new Map<string, string | null>();
  for (const e of entries) teasers.set(e.marketingSlug, await monthlyTeaser(e.planPrefix));

  let offerCount = 0;
  try {
    const supabase = await createClient();
    const plans = await listActivePlans(supabase);
    offerCount = buildOffers(plans.filter((p) => p.currency === "INR" && p.is_active), "available").offers
      ? plans.length
      : 0;
  } catch {
    offerCount = 0;
  }
  void offerCount;
  void TOOL_PLAN_PREFIX;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Paid Tools" }]} />
          <div className="mt-4 max-w-3xl">
            <Badge variant="secondary" className="mb-3">Operator tools</Badge>
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">Paid tools for esports operations.</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Five focused tools for sponsorships, prize pools, drafts, standings, and payouts. Every tool starts
              free — pay only when you need the full allowance. Or take All Access and use everything.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => {
              const Icon = toolIcon(e.tool.icon);
              const badge = freeBadgeByMarketingSlug(e.marketingSlug);
              const free = freeTierByMarketingSlug(e.marketingSlug);
              const teaser = teasers.get(e.marketingSlug);
              return (
                <Card key={e.marketingSlug} className="group flex flex-col border-primary/15 card-interactive">
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="success">Available</Badge>
                        {badge ? <Badge variant="outline">{badge}</Badge> : null}
                      </span>
                    </div>
                    <CardTitle className="mt-3 text-base">{e.tool.name}</CardTitle>
                    <CardDescription>{e.tool.shortDescription}</CardDescription>
                    {free ? (
                      <p className="mt-2 text-sm text-muted-foreground">Free: {free.allowance}</p>
                    ) : null}
                    {teaser ? <p className="mt-1 text-sm font-medium">{teaser} / month</p> : null}
                    <p className="mt-2 font-mono text-[11px] tracking-wide text-muted-foreground">{e.tool.motif}</p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Link
                      href={`/tools/${e.marketingSlug}` as Route}
                      className="inline-flex h-9 min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted"
                    >
                      View tool
                    </Link>
                    <Link href="/pricing" className="inline-flex h-9 min-h-[44px] items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                      View pricing
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="flex flex-col border-primary/25 bg-primary/[0.04]">
              <CardHeader className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card font-display text-sm">A</span>
                  <Badge variant="success">Best value</Badge>
                </div>
                <CardTitle className="mt-3 text-base">All Access</CardTitle>
                <CardDescription>
                  Every paid tool in one bundle: {allAccess.coveredMarketingSlugs.length} tools, one workspace, manual renewal.
                </CardDescription>
                <p className="mt-2 text-sm text-muted-foreground">Covers {allAccess.coveredMarketingSlugs.join(" · ")}</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link href="/pricing" className="inline-flex h-9 min-h-[44px] items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
                  View All Access pricing
                </Link>
              </CardContent>
            </Card>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/pricing" className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">
              Compare all plans
            </Link>
            <Link href={"/bgmi-lab" as Route} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted">
              Try the free BGMI Lab
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Paid Tools", item: "/paid-tools" }]} />
    </div>
  );
}
