import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import { ShieldCheck, CalendarSearch, Split, Scissors, FileCheck, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Esports Tools — MicroNest Collection",
  description:
    "Explore MicroNest's focused tools for esports: Sponsorship Tracking, Scrim Matchmaker, Prize Pool Splitter, VOD Clipper, Roster Sentinel. One growing collection.",
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
};

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3">Collection</Badge>
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">Tools for the business of esports</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">
              MicroNest is a growing collection of focused microtools. Each solves one operational problem well — use what you need, skip the rest.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MARKETING_TOOLS.map((tool) => {
              const Icon = iconMap[tool.icon] ?? ShieldCheck;
              return (
                <Card key={tool.slug} className="flex flex-col">
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      {tool.status === "available" ? <Badge variant="success">Available</Badge> : <Badge variant="secondary">Coming soon</Badge>}
                    </div>
                    <CardTitle className="text-base mt-3">{tool.name}</CardTitle>
                    <CardDescription>{tool.shortDescription}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="inline-flex h-9 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted min-h-[44px]"
                    >
                      View tool <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <nav aria-label="Breadcrumb" className="mt-10 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline">Home</Link> <span aria-hidden>·</span> Tools
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
