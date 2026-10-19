import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { toolIcon } from "@/components/marketing/tool-icon-map";
import { getLabTools } from "@/lib/marketing/public-tool-content";

export const metadata: Metadata = {
  title: "BGMI Lab — Free BGMI Practice Drills | MicroNest",
  description:
    "BGMI Lab is MicroNest's free practice space for BGMI players: short interactive drills for rotations, IGL decisions, and endgames. No signup. Start with Circle IQ.",
  alternates: { canonical: "/bgmi-lab" },
  openGraph: {
    title: "BGMI Lab — Free BGMI Practice Drills",
    description: "Short free BGMI drills: rotations, decisions, endgames. No signup.",
    url: "/bgmi-lab",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BGMI Lab — Free BGMI Practice Drills",
    description: "Short free BGMI drills: rotations, decisions, endgames. No signup.",
  },
};

export default function BgmiLabPage() {
  const tools = getLabTools();
  const available = tools.filter((t) => t.status === "available");
  const planned = tools.filter((t) => t.status === "planned");
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "BGMI Lab" }]} />
          <div className="mt-4 max-w-3xl">
            <Badge variant="success" className="mb-3">Free · No signup</Badge>
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">BGMI Lab — practice the plays that win matches.</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Short interactive BGMI drills for rotations, IGL decisions, and endgames. Each drill takes a minute,
              explains every answer, and never asks for an account. New drills open here as they are ready.
            </p>
          </div>

          <h2 className="mt-10 text-sm font-semibold">Available now</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((tool) => {
              const Icon = toolIcon(tool.icon);
              return (
                <Card key={tool.slug} className="group flex flex-col border-primary/15 card-interactive">
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant="success">Available</Badge>
                        <Badge variant="outline">Free</Badge>
                      </span>
                    </div>
                    <CardTitle className="mt-3 text-base">{tool.name}</CardTitle>
                    <CardDescription>{tool.tagline}</CardDescription>
                    <p className="mt-2 text-sm text-muted-foreground">{tool.description}</p>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/bgmi-lab/${tool.slug}` as Route}
                      className="inline-flex h-9 min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Start drill
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <h2 className="mt-12 text-sm font-semibold">Coming soon to the Lab</h2>
          <p className="mt-1 text-sm text-muted-foreground">Planned drills — listed here so the roadmap is honest. No pages, no signup, no waiting list.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {planned.map((tool) => {
              const Icon = toolIcon(tool.icon);
              return (
                <Card key={tool.slug} className="flex flex-col bg-surface-muted/40">
                  <CardHeader className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </span>
                      <Badge variant="secondary">Planned</Badge>
                    </div>
                    <CardTitle className="mt-3 text-base">{tool.name}</CardTitle>
                    <CardDescription>{tool.tagline}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            <Link href="/bgmi-tournaments" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Tournament Hub</p>
              <p className="mt-1 text-sm font-medium">See how real teams handle zones</p>
              <p className="mt-1 text-xs text-muted-foreground">Standings, match results, and history — free to read.</p>
            </Link>
            <Link href="/bgmi-qualification" className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Qualification Simulator</p>
              <p className="mt-1 text-sm font-medium">Know what your team needs to qualify</p>
              <p className="mt-1 text-xs text-muted-foreground">Free points planner — no signup.</p>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "BGMI Lab", item: "/bgmi-lab" }]} />
    </div>
  );
}
