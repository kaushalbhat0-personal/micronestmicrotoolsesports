import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { GUIDES } from "@/config/content/guides";

export const metadata: Metadata = {
  title: "Esports Sponsorship Guides | MicroNest",
  description: "Practical guides for esports sponsorships — deliverables, proof, and reporting without the spreadsheet chaos.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-10 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />
          <h1 className="font-display mt-4 text-3xl font-normal tracking-tight">Guides</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">
            Practical, product-informed guides for running sponsorships in esports — from requirements to proof.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}` as never} className="group">
                <Card className="h-full hover:bg-surface-muted/50 transition-colors">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Guide</p>
                    <CardTitle className="text-base mt-1 group-hover:text-primary transition-colors">{g.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{g.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Guides", item: "/guides" }]} />
    </div>
  );
}
