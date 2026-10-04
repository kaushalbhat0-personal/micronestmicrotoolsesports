import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { ShieldCheck, CalendarSearch, Split, Scissors, FileCheck, ArrowRight, Users, Trophy, Video, Layers } from "lucide-react";

export const metadata: Metadata = {
  title: "MicroNest — Focused Tools for the Business of Esports",
  description:
    "Sponsorships. Scrims. Prizes. Content. Rosters. MicroNest is a growing collection of focused tools designed to remove repetitive work behind competitive gaming.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MicroNest — Focused Tools for the Business of Esports",
    description:
      "A growing collection of focused tools for the business of esports. Sponsorship Tracking, Scrim Matchmaker, Prize Pool Splitter, VOD Clipper, Roster Sentinel.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "MicroNest — Focused Tools for the Business of Esports",
    description: "Focused tools for the business of esports. Sponsorships. Scrims. Prizes. Content. Rosters.",
  },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
};

export default function MarketingPage() {
  const featured = MARKETING_TOOLS.find((t) => t.slug === "sponsorship-tracking")!;
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero — collection framing */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Focused tools for the business of esports
            </Badge>
            <h1 className="font-display text-balance text-4xl font-normal tracking-tight sm:text-5xl">
              Sponsorships. <span className="text-primary">Scrims. Prizes.</span> Content. Rosters.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              MicroNest is a growing collection of focused microtools for the business of esports — designed to remove
              repetitive work behind competitive gaming. Start with one tool, add more as you need them.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/tools/sponsorship-tracking"
                className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] shadow-sm"
              >
                Try Sponsorship Tracking
              </Link>
              <Link
                href="/tools"
                className="inline-flex h-11 items-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted"
              >
                Explore the tools
              </Link>
            </div>
          </div>
        </section>

        {/* Tool Collection */}
        <section id="tools" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">A collection of focused tools</h2>
            <p className="mt-2 text-muted-foreground">Each tool solves one operational problem well — without platform bloat.</p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_TOOLS.map((tool) => {
              const Icon = iconMap[tool.icon] ?? ShieldCheck;
              return (
                <Card key={tool.slug} className={tool.status === "available" ? "border-primary/20" : "opacity-90"}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      {tool.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="secondary">Coming soon</Badge>}
                    </div>
                    <CardTitle className="text-base mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.shortDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tool.status === "available" ? (
                      <Link
                        href={`/tools/${tool.slug}`}
                        className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)]"
                      >
                        Learn more
                      </Link>
                    ) : (
                      <span className="inline-flex h-8 items-center rounded-full bg-secondary px-4 text-sm font-medium text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Why Focused Tools */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-normal tracking-tight text-center">Why focused tools?</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              <div className="rounded-[16px] border border-border bg-card p-5">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">One problem, well solved</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Each tool does one job with care — no giant suite to learn.</p>
              </div>
              <div className="rounded-[16px] border border-border bg-card p-5">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">Start with what you need</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Use Sponsorship Tracking today, add Scrim or Prize tools when you need them.</p>
              </div>
              <div className="rounded-[16px] border border-border bg-card p-5">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">Built for esports operations</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Creator channels, campaigns, checks and proof — modeled for how esports actually works.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Who it is for</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-left">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Creators & Teams</h3>
                <p className="mt-1 text-sm text-muted-foreground">Verify sponsor work, organize proof, and save time before reporting to partners.</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-left">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4" /> Organizations & Managers</h3>
                <p className="mt-1 text-sm text-muted-foreground">Keep campaigns, rosters and operations clear without spreadsheet chaos.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Tool — Sponsorship Tracking */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="rounded-[20px] border border-primary/20 bg-card p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <Badge variant="success" className="mb-3">Featured • Available now</Badge>
                <h2 className="font-display text-2xl font-normal tracking-tight">{featured.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{featured.longDescription}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {featured.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex gap-3">
                  <Link href="/tools/sponsorship-tracking" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)]">
                    Explore Sponsorship Tracking <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link href="/signup" className="inline-flex h-10 items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted">
                    Get started
                  </Link>
                </div>
              </div>
              <div className="flex-1 lg:max-w-sm">
                <div className="rounded-[16px] border border-border bg-surface-muted p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Video className="h-4 w-4" /> How it works
                  </div>
                  <ol className="mt-3 space-y-2 text-sm leading-relaxed">
                    <li className="flex gap-2"><span className="font-semibold text-primary">1.</span> Create a sponsor campaign with requirements.</li>
                    <li className="flex gap-2"><span className="font-semibold text-primary">2.</span> Connect creator channels.</li>
                    <li className="flex gap-2"><span className="font-semibold text-primary">3.</span> Run checks — proof is organized by content.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-[20px] border border-border bg-surface-muted/40 p-8 text-center">
            <h2 className="font-display text-2xl font-normal tracking-tight">Start with one tool</h2>
            <p className="mt-2 text-muted-foreground">Create a workspace and try Sponsorship Tracking — no bloat, no lock-in.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/signup" className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)]">
                Get started
              </Link>
              <Link href="/tools" className="inline-flex h-11 items-center rounded-full border border-border bg-card px-8 text-sm font-medium hover:bg-muted">
                View all tools
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
            description: "A growing collection of focused tools for the business of esports.",
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
            description: "Focused tools for the business of esports.",
            potentialAction: {
              "@type": "SearchAction",
              target: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/tools?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
    </div>
  );
}
