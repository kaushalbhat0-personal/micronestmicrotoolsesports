import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MARKETING_TOOLS, getMarketingTool } from "@/config/marketing/tools";
import { ShieldCheck, CalendarSearch, Split, Scissors, FileCheck, Check, ArrowRight } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  CalendarSearch,
  Split,
  Scissors,
  FileCheck,
};

export async function generateStaticParams() {
  return MARKETING_TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getMarketingTool(slug);
  if (!tool) return {};
  return {
    title: tool.seoTitle,
    description: tool.seoDescription,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      title: tool.seoTitle,
      description: tool.seoDescription,
      url: `/tools/${tool.slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: tool.seoTitle,
      description: tool.seoDescription,
    },
  };
}

export default async function ToolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getMarketingTool(slug);
  if (!tool) notFound();
  const Icon = iconMap[tool.icon] ?? ShieldCheck;
  const related = MARKETING_TOOLS.filter((t) => t.slug !== tool.slug).slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link> <span aria-hidden> · </span>
            <Link href="/tools" className="hover:text-foreground hover:underline">Tools</Link> <span aria-hidden> · </span>
            <span className="text-foreground">{tool.name}</span>
          </nav>

          <div className="mt-6 flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-surface-muted border border-border shrink-0">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-normal tracking-tight">{tool.name}</h1>
                {tool.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="secondary">Coming soon</Badge>}
              </div>
              <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">{tool.longDescription}</p>
            </div>
          </div>

          {/* AEO: What is / Who for / How it works */}
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What is {tool.name}?</CardTitle>
                <CardDescription className="leading-relaxed">{tool.shortDescription}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Who is it for?</CardTitle>
                <CardDescription className="leading-relaxed">{tool.audience.join(", ")}.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Why a focused tool?</CardTitle>
                <CardDescription className="leading-relaxed">Focused tools remove repetitive work without forcing a giant platform.</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Features / How it works */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-normal tracking-tight">How it works</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tool.features.map((f, i) => (
                <div key={f} className="flex gap-3 rounded-[12px] border border-border bg-card p-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">{i + 1}</span>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Honest status */}
          <section className="mt-10">
            {tool.status === "available" ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Check className="h-4 w-4 text-success" /> Available now</CardTitle>
                  <CardDescription>Try {tool.name} in your workspace — create a workspace and get started.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[hsl(24_90%_48%)] min-h-[44px]">Get started</Link>
                  <Link href="/dashboard" className="inline-flex h-10 items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted min-h-[44px]">Go to dashboard</Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-surface-muted/40">
                <CardHeader>
                  <CardTitle className="text-sm">Coming soon</CardTitle>
                  <CardDescription>{tool.name} is in development. The concept and positioning are shared here to show where MicroNest is going — functionality will be enabled when ready.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/tools" className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Back to tools</Link>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Related knowledge — only for sponsorship-tracking cluster */}
          {tool.slug === "sponsorship-tracking" && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold">Learn more about sponsorships</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Link href="/guides/esports-sponsorship-deliverables" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                  <p className="mt-1 text-sm font-medium">Sponsorship Deliverables Checklist</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">What sponsors actually expect and how to make it measurable.</p>
                </Link>
                <Link href="/guides/proving-sponsored-content" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                  <p className="mt-1 text-sm font-medium">How to Prove Sponsored Content</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">From requirement to proof — the workflow.</p>
                </Link>
                <Link href="/glossary/proof-of-performance" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Glossary</p>
                  <p className="mt-1 text-sm font-medium">Proof of Performance</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">What counts as proof for sponsors.</p>
                </Link>
                <Link href="/use-cases/esports-organizations" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Use case</p>
                  <p className="mt-1 text-sm font-medium">For Esports Organizations</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Keep sponsorship campaigns auditable.</p>
                </Link>
              </div>
            </section>
          )}

          {/* Prize Pool Splitter — authority cluster */}
          {tool.slug === "prize-pool-splitter" && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold">Learn more about prize pools</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Link href="/guides/esports-prize-pool-distribution" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                  <p className="mt-1 text-sm font-medium">Prize Pool Distribution — Overview</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Percentage, equal, ranked and custom with Top 3–Top 10.</p>
                </Link>
                <Link href="/guides/esports-prize-pool-percentage-split" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                  <p className="mt-1 text-sm font-medium">How to Split by Percentage</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">₹100,000 — 50/30/20 walkthrough and validation.</p>
                </Link>
                <Link href="/guides/esports-prize-pool-rounding" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                  <p className="mt-1 text-sm font-medium">How to Handle Rounding</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Largest-remainder reconciliation for exact totals.</p>
                </Link>
                <Link href="/glossary/prize-pool" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Glossary</p>
                  <p className="mt-1 text-sm font-medium">Prize Pool</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">What a prize pool is in esports.</p>
                </Link>
                <Link href="/glossary/prize-pool-distribution" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Glossary</p>
                  <p className="mt-1 text-sm font-medium">Prize Pool Distribution</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">How distribution differs from pool size and payout.</p>
                </Link>
                <Link href="/use-cases/tournament-organizers" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Use case</p>
                  <p className="mt-1 text-sm font-medium">For Tournament Organizers</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">Define, validate, and communicate payouts.</p>
                </Link>
              </div>
            </section>
          )}

          {/* Related tools */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold">Related tools</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/tools/${r.slug}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-muted min-h-[44px]">
                  {r.name} <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </section>
        </section>
      </main>
      <Footer />
      {/* Structured data: SoftwareApplication + Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: tool.name,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: tool.seoDescription,
            url: `/tools/${tool.slug}`,
            isPartOf: { "@type": "WebSite", name: "MicroNest", url: "/" },
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: tool.status === "available" ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "/" },
              { "@type": "ListItem", position: 2, name: "Tools", item: "/tools" },
              { "@type": "ListItem", position: 3, name: tool.name, item: `/tools/${tool.slug}` },
            ],
          }),
        }}
      />
    </div>
  );
}
