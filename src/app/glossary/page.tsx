import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { GLOSSARY } from "@/config/content/glossary";

export const metadata: Metadata = {
  title: "Esports Glossary | MicroNest",
  description: "Definitions for sponsorship, proof, and campaign concepts used across MicroNest.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Glossary" }]} />
          <h1 className="font-display mt-4 text-3xl font-normal tracking-tight">Glossary</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">
            Short, useful definitions for the concepts behind sponsorships, campaigns, and proof.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {GLOSSARY.map((g) => (
              <Link key={g.slug} href={`/glossary/${g.slug}` as never} className="group">
                <Card className="h-full hover:bg-surface-muted/50 transition-colors">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Glossary</p>
                    <CardTitle className="text-base mt-1 group-hover:text-primary transition-colors">{g.term}</CardTitle>
                    <CardDescription className="line-clamp-2">{g.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Glossary", item: "/glossary" }]} />
    </div>
  );
}
