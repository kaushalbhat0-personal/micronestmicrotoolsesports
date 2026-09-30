import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TOOLS } from "@/config/app/tools";

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Multi-tenant • Micro-SaaS • Esports
            </Badge>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              Narrow tools, <span className="text-primary">outsized impact</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              MicroNest hosts independent microtools for esports organizations. Subscribe to what you need —
              or unlock everything with All-Access.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/signup" className="inline-flex h-10 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Start free
              </Link>
              <Link href="#tools" className="inline-flex h-10 items-center rounded-md border px-8 text-sm font-medium hover:bg-muted">
                Explore tools
              </Link>
            </div>
          </div>
        </section>

        {/* Tools */}
        <section id="tools" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">Microtools</h2>
            <p className="mt-2 text-muted-foreground">Each tool is independently valuable. Add them without platform bloat.</p>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <Card key={tool.slug} className={tool.comingSoon ? "opacity-90" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tool.name}</CardTitle>
                    {tool.comingSoon ? (
                      <Badge variant="secondary">Soon</Badge>
                    ) : (
                      <Badge variant="success">Live</Badge>
                    )}
                  </div>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {tool.comingSoon ? (
                    <Button variant="secondary" size="sm" disabled>
                      Coming soon
                    </Button>
                  ) : (
                    <Link href="/dashboard" className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                      Open tool
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <h2 className="text-xl font-semibold">Simple, per-tool pricing</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Subscribe to individual tools or get All-Access. Multi-tenant by design — one account, many organizations.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/signup" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Create organization</Link>
              <Link href="/dashboard" className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium">Go to dashboard</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
