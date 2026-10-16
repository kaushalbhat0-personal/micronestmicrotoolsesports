import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import type { ToolAccent } from "@/config/marketing/tools";
import { freeBadgeByMarketingSlug, freeTierByMarketingSlug } from "@/config/marketing/free-tiers";
import { META_PARSER_ENTRY, BGMI_QUALIFICATION_ENTRY } from "@/lib/marketing/toolbox-presentation";
import { ShieldCheck, CalendarSearch, Split, Scissors, FileCheck, Swords, Scale, ArrowRight, ReceiptText, ClipboardList, Newspaper, Target } from "lucide-react";

export const metadata: Metadata = {
  title: "Esports Tools — MicroNest Collection",
  description:
    "Explore MicroNest's focused esports toolbox: Sponsorship Tracking, Prize Pool Splitter, Draft & Ban, Tie-Breaker Resolver, Prize Payout Tracker, and Tournament Roster & Slot Builder — plus public Meta-Parser patch intelligence and the free BGMI Qualification Simulator. Every workspace tool can be started free; patch facts are free to read and the simulator is free to use.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Esports Tools — MicroNest",
    description: "A growing collection of focused tools for the business of esports.",
    url: "/tools",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MicroNest Tools",
    description: "Focused tools for the business of esports.",
  },
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
};

function accentClass(accent: ToolAccent): string {
  switch (accent) {
    case "terracotta":
      return "text-primary";
    case "charcoal":
      return "text-foreground";
    case "teal":
      return "text-success";
    case "beige":
      return "text-muted-foreground";
    case "amber":
      return "text-warning";
    default:
      return "text-muted-foreground";
  }
}

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-12 lg:py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3">Collection</Badge>
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">Tools for the business of esports</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
              MicroNest is a growing collection of focused microtools. Each solves one operational problem well — use what you need, skip the rest.
              Every available tool can be started free.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_TOOLS.map((tool, idx) => {
              const Icon = iconMap[tool.icon] ?? ShieldCheck;
              const isAvailable = tool.status === "available";
              const free = isAvailable ? freeTierByMarketingSlug(tool.slug) : null;
              // Canonical badge: quota-limited tiers read "Free plan".
              const badge = isAvailable ? freeBadgeByMarketingSlug(tool.slug) : null;
              return (
                <Card
                  key={tool.slug}
                  className={`group flex flex-col nest-reveal nest-reveal-delay-${Math.min(idx, 4)} ${
                    isAvailable
                      ? "border-primary/15 card-interactive"
                      : "bg-surface-muted/40"
                  }`}
                  style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
                >
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border transition-transform duration-[180ms] group-hover:translate-y-[-1px]">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`font-mono text-[11px] tracking-widest ${accentClass(tool.accent)}`}>{tool.number}</span>
                        {isAvailable ? <Badge variant="success">Available</Badge> : <Badge variant="secondary">Coming soon</Badge>}
                        {badge ? <Badge variant="outline">{badge}</Badge> : null}
                      </span>
                    </div>
                    <CardTitle className="text-base mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.shortDescription}</CardDescription>
                    {free ? (
                      <p className="mt-2 text-sm"><span className="sr-only">Free allowance: </span><span className="text-muted-foreground">Free: {free.allowance}</span></p>
                    ) : null}
                    <p className="font-mono text-[11px] tracking-wide text-muted-foreground mt-2">{tool.motif}</p>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-[180ms]"
                    >
                      {isAvailable ? "View tool" : "Preview concept"} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
            {(() => {
              const MetaIcon = iconMap[META_PARSER_ENTRY.icon] ?? Newspaper;
              return (
                <Card
                  key={META_PARSER_ENTRY.slug}
                  className="group flex flex-col border-success/20 bg-success-soft/40 card-interactive"
                >
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border transition-transform duration-[180ms] group-hover:translate-y-[-1px]">
                        <MetaIcon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="info">Public</Badge>
                        <Badge variant="outline">Free to read</Badge>
                      </span>
                    </div>
                    <CardTitle className="text-base mt-3">{META_PARSER_ENTRY.name}</CardTitle>
                    <CardDescription>{META_PARSER_ENTRY.description}</CardDescription>
                    <p className="mt-2 text-sm"><span className="text-muted-foreground">{META_PARSER_ENTRY.accessNote}</span></p>
                    <p className="font-mono text-[11px] tracking-wide text-muted-foreground mt-2">Public patch intelligence</p>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={META_PARSER_ENTRY.url as Route}
                      aria-label={META_PARSER_ENTRY.ctaAriaLabel}
                      className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-[180ms]"
                    >
                      {META_PARSER_ENTRY.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })()}
            {(() => {
              const BgmiIcon = iconMap[BGMI_QUALIFICATION_ENTRY.icon] ?? Target;
              return (
                <Card
                  key={BGMI_QUALIFICATION_ENTRY.slug}
                  className="group flex flex-col border-success/20 bg-success-soft/40 card-interactive"
                >
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border transition-transform duration-[180ms] group-hover:translate-y-[-1px]">
                        <BgmiIcon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="info">Public</Badge>
                        <Badge variant="outline">Free to use</Badge>
                      </span>
                    </div>
                    <CardTitle className="text-base mt-3">{BGMI_QUALIFICATION_ENTRY.name}</CardTitle>
                    <CardDescription>{BGMI_QUALIFICATION_ENTRY.description}</CardDescription>
                    <p className="mt-2 text-sm"><span className="text-muted-foreground">{BGMI_QUALIFICATION_ENTRY.accessNote}</span></p>
                    <p className="font-mono text-[11px] tracking-wide text-muted-foreground mt-2">Points · Target · Qualify</p>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={BGMI_QUALIFICATION_ENTRY.url as Route}
                      aria-label={BGMI_QUALIFICATION_ENTRY.ctaAriaLabel}
                      className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-[180ms]"
                    >
                      {BGMI_QUALIFICATION_ENTRY.ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/pricing" className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View pricing</Link>
            <Link href="/tools/sponsorship-tracking" className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Sponsorship Tracking</Link>
          </div>
          <nav aria-label="Breadcrumb" className="mt-10 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden>·</span> Tools
          </nav>
        </section>
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "/" },
              { "@type": "ListItem", position: 2, name: "Tools", item: "/tools" },
            ],
          }),
        }}
      />
    </div>
  );
}
