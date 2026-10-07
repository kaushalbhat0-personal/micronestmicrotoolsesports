import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import type { ToolAccent } from "@/config/marketing/tools";
import { ShieldCheck, CalendarSearch, Split, Scissors, FileCheck, Swords, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Esports Tools — MicroNest Collection",
  description:
    "Explore MicroNest's subscription software for esports: Sponsorship Tracking, Prize Pool Splitter, and Draft & Ban, available now. Scrim Matchmaker, VOD Clipper, and Roster Sentinel are coming soon.",
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
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_TOOLS.map((tool, idx) => {
              const Icon = iconMap[tool.icon] ?? ShieldCheck;
              const isAvailable = tool.status === "available";
              return (
                <Card
                  key={tool.slug}
                  className={`group flex flex-col nest-reveal nest-reveal-delay-${Math.min(idx, 4)} ${
                    isAvailable
                      ? "border-primary/15 transition-transform duration-[180ms] hover:scale-[1.01] hover:border-border-strong hover:shadow-sm"
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
                      </span>
                    </div>
                    <CardTitle className="text-base mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.shortDescription}</CardDescription>
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
