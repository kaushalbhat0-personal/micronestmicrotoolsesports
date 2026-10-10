import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { createClient } from "@/lib/supabase/server";
import { listActivePlans } from "@/server/repositories/plans";
import { PricingClient } from "./pricing-client";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Pricing — MicroNest MicroTools",
  description: "Simple INR pricing for focused esports tools, each with a Free forever tier. Choose Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, or All Access. Monthly and yearly plans, manual renewal only.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing — MicroNest MicroTools",
      description: "Simple INR pricing for focused esports tools. Choose Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, or All Access.",
    url: "/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — MicroNest MicroTools",
      description: "Simple INR pricing for focused esports tools — Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, All Access.",
  },
  robots: { index: true, follow: true },
};

export default async function PricingPage() {
  let plans: Awaited<ReturnType<typeof listActivePlans>> = [];
  let loadError: string | null = null;
  try {
    const supabase = await createClient();
    const all = await listActivePlans(supabase);
    // Only INR active plans (expected), filter defensively
    plans = all.filter((p) => p.currency === "INR" && p.is_active);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unable to load pricing";
  }

  const hasPlans = plans.length >= 10;
  // Verify expected slugs present (fail safely, don't silently show stale)
  const expectedSlugs = [
    "sponsorship-tracking-monthly",
    "sponsorship-tracking-yearly",
    "prize-pool-splitter-monthly",
    "prize-pool-splitter-yearly",
    "draft-ban-monthly",
    "draft-ban-yearly",
    "tie-breaker-monthly",
    "tie-breaker-yearly",
    "all-access-monthly",
    "all-access-yearly",
  ] as const;
  const slugSet = new Set(plans.map((p) => p.slug));
  const missing = expectedSlugs.filter((s) => !slugSet.has(s));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        {/* Hero */}
        <section className="container-nest py-12 sm:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
          <div className="mx-auto max-w-3xl text-center">
            <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Simple pricing. Focused tools.</p>
            <h1 className="font-display mt-2 text-3xl font-normal tracking-tight sm:text-4xl">Choose the tools your esports operation needs.</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground leading-relaxed">Use currently available tools for sponsorships, prize pools, match drafts, and tied standings — without paying for software you don’t need.</p>
          </div>

          {loadError && (
            <div className="mx-auto mt-8 max-w-3xl rounded-[12px] border border-destructive/20 bg-destructive-soft p-4 text-sm text-destructive-foreground">
              Pricing is temporarily unavailable — please try again or contact <a href="mailto:info.micronest@gmail.com" className="underline">info.micronest@gmail.com</a>. ({loadError})
            </div>
          )}
          {missing.length > 0 && !loadError && (
            <div className="mx-auto mt-8 max-w-3xl rounded-[12px] border border-warning/20 bg-warning-soft p-4 text-sm">
              Pricing catalog incomplete — missing: {missing.join(", ")}. Contact <a href="mailto:info.micronest@gmail.com" className="underline">info.micronest@gmail.com</a>.
            </div>
          )}

          <div className="mt-10">
            {hasPlans ? (
              <PricingClient plans={plans} />
            ) : (
              !loadError && (
                <Card className="mx-auto max-w-2xl">
                  <CardHeader>
                    <CardTitle className="text-sm">Pricing unavailable</CardTitle>
                    <CardDescription>No active INR plans were found. Please contact support.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link href="/contact" className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Contact support</Link>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </section>

        {/* Comparison */}
        <section className="container-nest py-10">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display text-xl font-normal tracking-tight text-center">Compare plans</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">Focused — only what each plan actually includes.</p>
            <div className="mt-6 overflow-x-auto rounded-[16px] border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface-muted/60 text-left text-xs tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Capability</th>
                    <th className="px-4 py-3 font-semibold">Sponsorship Tracking</th>
                    <th className="px-4 py-3 font-semibold">Prize Pool Splitter</th>
                    <th className="px-4 py-3 font-semibold">Draft & Ban</th>
                    <th className="px-4 py-3 font-semibold">Tie-Breaker Resolver</th>
                    <th className="px-4 py-3 font-semibold">All Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-4 py-3 font-medium">Sponsorship proof & requirements</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Prize pool calculations</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Match draft room & official records</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Tied standings & official records</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Currently available esports tools</td>
                    <td className="px-4 py-3">1</td>
                    <td className="px-4 py-3">1</td>
                    <td className="px-4 py-3">1</td>
                    <td className="px-4 py-3">1</td>
                    <td className="px-4 py-3">All</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Manual renewal</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3">✓</td>
                    <td className="px-4 py-3">✓</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Access scope</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">One workspace</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">One workspace</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">One workspace</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">One workspace</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">All currently available paid tools · one workspace</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How pricing works */}
        <section className="container-nest py-10">
          <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-card p-6 sm:p-8">
            <h2 className="font-display text-xl font-normal tracking-tight">How pricing works</h2>
            <ol className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground list-decimal pl-5">
              <li>Choose a tool or All Access — each pricing card maps to a server-authoritative plan (slug + billing period).</li>
              <li>Create or sign into your MicroNest workspace — purchase is attached to the organization/workspace you select at checkout.</li>
              <li>Complete payment through the secure checkout flow — you’ll see plan name, amount in INR, currency, and billing period before confirming.</li>
              <li>Access is provisioned for the purchased billing period — check Dashboard → Settings → Billing for “Active until”.</li>
              <li><span className="font-medium text-foreground">Renewal is manual.</span> No automatic renewal. You renew manually when you want to continue access.</li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">Prices are shown in INR. “₹1,499 / month” and “₹14,990 / year” include billing period. No AutoPay, no recurring mandate, no automatic charge.</p>
          </div>
        </section>

        {/* Trust / disclosure */}
        <section className="container-nest py-10">
          <div className="mx-auto max-w-3xl rounded-[16px] border border-border bg-surface-muted/40 p-6 text-sm leading-relaxed">
            <h2 className="text-sm font-semibold">Trust & billing notes</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Prices are shown in INR. Renewal is manual; no automatic renewal is enabled.</li>
              <li>Payments are non-refundable after access has been provisioned, subject to investigation of duplicate or erroneous charges — see <Link href="/refund" className="underline underline-offset-4 hover:text-foreground">Refund Policy</Link>.</li>
              <li>MicroNest is currently not registered for GST.</li>
              <li>Support: <a href="mailto:info.micronest@gmail.com" className="underline">info.micronest@gmail.com</a> · Pune, Maharashtra, India</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link>
              <span aria-hidden>·</span>
              <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy</Link>
              <span aria-hidden>·</span>
              <Link href="/refund" className="underline underline-offset-4 hover:text-foreground">Refund & Cancellation</Link>
              <span aria-hidden>·</span>
              <Link href="/digital-delivery" className="underline underline-offset-4 hover:text-foreground">Digital Delivery</Link>
              <span aria-hidden>·</span>
              <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">Contact</Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container-nest pb-16">
          <div className="mx-auto max-w-3xl text-center text-sm text-muted-foreground">
            <p>Already have a workspace? <Link href="/dashboard" className="font-medium text-primary hover:underline">Go to dashboard →</Link></p>
            <p className="mt-2">New here? <Link href="/tools" className="underline hover:text-foreground">Explore tools</Link> or <Link href="/contact" className="underline hover:text-foreground">contact support</Link>.</p>
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Pricing", item: "/pricing" }]} />
      {/* Structured data — Product/AggregateOffer for pricing */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "MicroNest MicroTools — Pricing",
              description: "Simple INR pricing for focused esports tools — Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, All Access. Monthly and yearly, manual renewal only.",
            brand: { "@type": "Brand", name: "MicroNest" },
            offers: plans
              .filter((p) => p.currency === "INR")
              .map((p) => ({
                "@type": "Offer",
                name: p.name,
                price: (p.amount_minor / 100).toString(),
                priceCurrency: "INR",
                availability: "https://schema.org/InStock",
                priceValidUntil: undefined,
                sku: p.slug,
                category: p.billing_period,
              })),
          }),
        }}
      />
    </div>
  );
}
