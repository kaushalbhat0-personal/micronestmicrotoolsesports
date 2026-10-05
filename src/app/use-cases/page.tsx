import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { USE_CASES } from "@/config/content/use-cases";

export const metadata: Metadata = {
  title: "Use Cases — Esports Organizations | MicroNest",
  description: "How esports organizations keep sponsorship campaigns auditable with MicroNest.",
  alternates: { canonical: "/use-cases" },
};

export default function UseCasesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-10 lg:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Use Cases" }]} />
          <h1 className="font-display mt-4 text-3xl font-normal tracking-tight">Use cases</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">
            Real workflows for the people who run sponsorships — not persona pages with swapped words.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {USE_CASES.map((u) => (
              <Link key={u.slug} href={`/use-cases/${u.slug}` as never} className="group">
                <Card className="h-full hover:bg-surface-muted/50 transition-colors">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Use case</p>
                    <CardTitle className="text-base mt-1 group-hover:text-primary transition-colors">{u.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{u.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <BreadcrumbJsonLd items={[{ name: "Home", item: "/" }, { name: "Use Cases", item: "/use-cases" }]} />
    </div>
  );
}
