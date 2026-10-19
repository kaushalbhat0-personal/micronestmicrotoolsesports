import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Esports Tools — MicroNest Collection",
  description:
    "MicroNest tools directory: the free BGMI Lab practice drills, the BGMI Tournament Hub standings, and paid operator tools for sponsorships, prize pools, drafts, standings, and payouts.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Esports Tools — MicroNest",
    description: "BGMI Lab · Tournament Hub · Paid Tools — the MicroNest collection.",
    url: "/tools",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MicroNest Tools",
    description: "BGMI Lab · Tournament Hub · Paid Tools.",
  },
};

/**
 * /tools — compatibility/discovery hub (Phase 1.6).
 * Existing /tools/:slug URLs stay canonical; this page routes visitors to
 * the three pillars instead of mixing all nine entries in one grid.
 */
const SECTIONS = [
  {
    badge: "Free · No signup",
    title: "BGMI Lab",
    description: "Short interactive practice drills — rotations, IGL decisions, endgames. Start with Circle IQ.",
    href: "/bgmi-lab",
    cta: "Enter BGMI Lab",
    links: [
      { label: "Circle IQ — available now", href: "/bgmi-lab/circle-iq" },
      { label: "More drills planned", href: "/bgmi-lab" },
    ],
  },
  {
    badge: "Free to read",
    title: "Tournament Hub",
    description: "BGMI tournament standings, match results, and history — plus the free Qualification Simulator.",
    href: "/bgmi-tournaments",
    cta: "Browse standings",
    links: [
      { label: "BGMI Tournament Hub", href: "/bgmi-tournaments" },
      { label: "Qualification Simulator", href: "/bgmi-qualification" },
    ],
  },
  {
    badge: "Starts free",
    title: "Paid Tools",
    description: "Operator workflows for sponsorships, prize pools, drafts, standings, and payouts — plus All Access.",
    href: "/paid-tools",
    cta: "View paid tools",
    links: [
      { label: "Sponsorship Tracking", href: "/tools/sponsorship-tracking" },
      { label: "Prize Pool Splitter", href: "/tools/prize-pool-splitter" },
      { label: "All Access pricing", href: "/pricing" },
    ],
  },
] as const;

export default function ToolsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-12 lg:py-16">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-3">Directory</Badge>
            <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">Tools for the business of esports</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Three places to go: practice free in the BGMI Lab, follow tournaments in the Hub, or run operations
              with paid tools. Pick a lane below.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Card key={s.title} className="group flex flex-col border-primary/15 card-interactive">
                <CardHeader className="flex-1">
                  <Badge variant="outline" className="w-fit">{s.badge}</Badge>
                  <CardTitle className="mt-3 text-base">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {s.links.map((l) => (
                      <li key={l.label}>
                        <Link href={l.href as Route} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardHeader>
                <CardContent>
                  <Link
                    href={s.href as Route}
                    className="inline-flex h-9 min-h-[44px] items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]"
                  >
                    {s.cta} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <nav aria-label="Breadcrumb" className="mt-10 text-sm text-muted-foreground">
            <Link href="/" className="rounded hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Home</Link> <span aria-hidden>·</span> Tools
          </nav>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Tools", item: "/tools" }]} />
    </div>
  );
}
