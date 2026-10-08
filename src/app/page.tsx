import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LogoMark } from "@/components/shared/logo";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { ProofStrip } from "@/components/marketing/proof-strip";
import { createClient } from "@/lib/supabase/server";
import { listActivePlans } from "@/server/repositories/plans";
import { ShieldCheck, Split, Swords, Scale, Users, Trophy, Clock, FileCheck, BadgeCheck, ArrowRight, Youtube, Twitch, Radio } from "lucide-react";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Sponsorship Tracking for Esports Creators & Teams | MicroNest",
  description:
    "Verify sponsor deliverables and organize proof for YouTube, Twitch and Kick creators. Plus prize splitter, draft & ban, and tie-breaker tools.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sponsorship Tracking for Esports Creators & Teams | MicroNest",
    description:
      "Verify sponsor deliverables and organize proof for YouTube, Twitch and Kick creators. Plus prize splitter, draft & ban, and tie-breaker tools.",
    type: "website",
    url: "/",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "MicroNest — Sponsorship Tracking for esports creators and teams" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sponsorship Tracking for Esports Creators & Teams | MicroNest",
    description:
      "Verify sponsor deliverables and organize proof for YouTube, Twitch and Kick creators. Plus prize splitter, draft & ban, and tie-breaker tools.",
    images: ["/opengraph-image"],
  },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Split,
  Swords,
  Scale,
};

const ORGANIZER_TOOL_SLUGS = ["prize-pool-splitter", "draft-ban", "tie-breaker"] as const;

function formatINR(amountMinor: number): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default async function MarketingPage() {
  const featured = MARKETING_TOOLS.find((t) => t.slug === "sponsorship-tracking")!;
  const organizerTools = MARKETING_TOOLS.filter((t) => t.status === "available" && (ORGANIZER_TOOL_SLUGS as readonly string[]).includes(t.slug));

  // Pricing teaser from the authoritative catalog — never hardcoded.
  // Graceful fallback: teaser renders without a price if catalog is unreachable.
  let startingAt: string | null = null;
  try {
    const supabase = await createClient();
    const plans = await listActivePlans(supabase);
    const monthly = plans.find((p) => p.slug === "sponsorship-tracking-monthly" && p.currency === "INR" && p.is_active);
    if (monthly) startingAt = `${formatINR(monthly.amount_minor)}/month`;
  } catch {
    startingAt = null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        {/* Hero — product promise */}
        <section className="container-nest py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 flex justify-center">
              <LogoMark size={80} priority className="!size-14 sm:!size-[72px] lg:!size-[80px]" />
            </div>
            <p className="mb-4 text-sm tracking-widest text-muted-foreground">The toolbox behind esports</p>
            <h1 className="font-display text-balance text-4xl font-normal tracking-tight sm:text-5xl">
              Prove every sponsor deliverable. <span className="text-primary">Without the spreadsheet chaos.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              MicroNest checks your creators&apos; content against sponsor requirements and organizes the proof, so reporting to brands takes
              minutes, not hours.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup?plan=sponsorship-tracking-monthly"
                className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try Sponsorship Tracking
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>

        {/* Product proof */}
        <section className="container-nest py-8 sm:py-12" aria-label="How Sponsorship Tracking works">
          <div className="mx-auto max-w-4xl">
            <ProofStrip />
          </div>
        </section>

        {/* Featured — Sponsorship Tracking */}
        <section className="container-nest py-12">
          <div className="rounded-[20px] border border-primary/20 bg-card p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <Badge variant="success" className="mb-3">Featured • Available now</Badge>
                <h2 className="font-display text-2xl font-normal tracking-tight">Sponsorship Tracking</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Know if every creator posted what the sponsor paid for.</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {featured.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/signup?plan=sponsorship-tracking-monthly"
                    className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Try Sponsorship Tracking <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/tools/sponsorship-tracking"
                    className="inline-flex h-10 items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Learn more
                  </Link>
                </div>
              </div>
              <div className="flex-1 lg:max-w-sm">
                <div className="rounded-[16px] border border-border bg-surface-muted p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BadgeCheck className="h-4 w-4" aria-hidden /> What you get
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                    <li className="flex gap-2"><span className="font-semibold text-primary" aria-hidden>1.</span> Sponsor requirements, written once.</li>
                    <li className="flex gap-2"><span className="font-semibold text-primary" aria-hidden>2.</span> Connected creator channels.</li>
                    <li className="flex gap-2"><span className="font-semibold text-primary" aria-hidden>3.</span> Automated checks on new content.</li>
                    <li className="flex gap-2"><span className="font-semibold text-primary" aria-hidden>4.</span> Proof organized for every sponsor report.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Customer outcomes */}
        <section className="container-nest py-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-normal tracking-tight text-center">Reporting sponsors shouldn&apos;t take all week</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              <div className="rounded-[16px] border border-border bg-card p-5">
                <Clock className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">Save hours on sponsor reporting</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Requirements, checks, and proof live in one place — no hunting through chats and sheets.</p>
              </div>
              <div className="rounded-[16px] border border-border bg-card p-5">
                <FileCheck className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">Never lose proof of deliverables</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Every check keeps its evidence attached, ready whenever a brand asks.</p>
              </div>
              <div className="rounded-[16px] border border-border bg-card p-5">
                <BadgeCheck className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-3 text-sm font-semibold">Look professional in front of brands</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Send organized proof reports instead of screenshots and promises.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Who it is for */}
        <section className="container-nest py-12">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Who it is for</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[12px] border border-primary/20 bg-card p-4 text-left">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" aria-hidden /> Creators and teams with sponsors</h3>
                <p className="mt-1 text-sm text-muted-foreground">Verify sponsor work and organize proof before reporting to partners.</p>
                <p className="mt-2 text-xs text-muted-foreground">Example: tracking 12 creators across 5 campaigns.</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-left">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4" aria-hidden /> Tournament organizers and operators</h3>
                <p className="mt-1 text-sm text-muted-foreground">Run prize splits, pick/ban drafts, and tied standings with records both sides can trust.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Also for tournament organizers */}
        <section className="container-nest py-12" aria-label="Also for tournament organizers">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Also for tournament organizers</h2>
            <p className="mt-2 text-muted-foreground">Focused tools for match operations, each sold separately.</p>
          </div>
          <div className="mx-auto mt-8 grid max-w-4xl gap-5 sm:grid-cols-3">
            {organizerTools.map((tool) => {
              const Icon = iconMap[tool.icon] ?? ShieldCheck;
              return (
                <Card key={tool.slug} className="border-border/60">
                  <CardHeader>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border">
                      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                    </span>
                    <CardTitle className="text-base mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.shortDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="inline-flex h-8 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-[180ms]"
                    >
                      Learn more
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Supported platforms */}
        <section className="container-nest py-8" aria-label="Supported platforms">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-xl font-normal tracking-tight">Supported platforms</h2>
            <p className="mt-1 text-sm text-muted-foreground">Connect creator channels where your sponsors already are.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2" role="list" aria-label="Supported platforms">
              <span role="listitem" className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Youtube className="h-4 w-4 text-muted-foreground" aria-hidden /> YouTube
              </span>
              <span role="listitem" className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Twitch className="h-4 w-4 text-muted-foreground" aria-hidden /> Twitch
              </span>
              <span role="listitem" className="inline-flex items-center gap-1.5 text-sm font-medium">
                <Radio className="h-4 w-4 text-muted-foreground" aria-hidden /> Kick
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Kick live and channel checks are supported; Kick recorded-video (VOD) checks aren&apos;t supported yet.</p>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="container-nest py-12">
          <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-surface-muted/40 p-8 text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Start with Sponsorship Tracking</h2>
            <p className="mt-2 text-muted-foreground">
              {startingAt ? (
                <>Starting at {startingAt}. </>
              ) : null}
              Manual renewal only — no automatic charges. <Link href="/pricing" className="font-medium text-primary hover:underline">View pricing</Link> before you decide.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/signup?plan=sponsorship-tracking-monthly" className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Try Sponsorship Tracking
              </Link>
              <Link href="/pricing" className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                View pricing
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">Built in Pune for the Indian esports scene.</p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container-nest py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Prove it. Send it. Get renewed.</h2>
            <p className="mt-2 text-muted-foreground">Create a workspace and connect your first creator channel today.</p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/signup?plan=sponsorship-tracking-monthly" className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Try Sponsorship Tracking
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring self-center">
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "MicroNest",
            alternateName: "MicroNest Esports",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            description: "Sponsorship Tracking for esports creators and teams.",
            sameAs: [],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "MicroNest",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            description: "Verify sponsor deliverables and organize proof for esports creators.",
          }),
        }}
      />
    </div>
  );
}
