import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { toolIcon } from "@/components/marketing/tool-icon-map";
import { getAvailableLabTools, getLabTool, buildLabJsonLd, buildLabFaqJsonLd } from "@/lib/marketing/public-tool-content";

/**
 * BGMI Lab detail — server-rendered content shell + one dynamic client island.
 * Only "available" registry tools resolve; planned tools 404 (no thin pages).
 * The island is dynamically imported so /bgmi-lab stays lightweight.
 */
const CircleIqShell = dynamic(() =>
  import("@/features/bgmi-lab/components/circle-iq-shell").then((m) => m.CircleIqShell)
);

export async function generateStaticParams() {
  return getAvailableLabTools().map((t) => ({ slug: t.slug }));
}

// Planned drills have no pages: unknown slugs 404 at routing level.
//
// Known framework behavior (Next 15, accepted noise): each such 404 logs
// one server-side `NoFallbackError` from the route module even though the
// client correctly receives HTTP 404 with the not-found page. There is no
// narrow supported suppression — `instrumentation.onRequestError` filtering
// would be global error swallowing, and removing this flag would regress
// unknown slugs to HTTP 200. Correct status takes precedence over log
// silence; hits here are bots/typos only (no links or sitemap entries).
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getLabTool(slug);
  if (!tool || tool.status !== "available") return {};
  return {
    title: `${tool.name} — ${tool.tagline} | MicroNest BGMI Lab`,
    description: tool.description,
    alternates: { canonical: `/bgmi-lab/${tool.slug}` },
    openGraph: {
      title: `${tool.name} — ${tool.tagline}`,
      description: tool.description,
      url: `/bgmi-lab/${tool.slug}`,
      type: "website",
    },
    twitter: { card: "summary_large_image", title: tool.name, description: tool.tagline },
  };
}

export default async function BgmiLabDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getLabTool(slug);
  if (!tool || tool.status !== "available") notFound();
  const Icon = toolIcon(tool.icon);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="container-nest flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "BGMI Lab", href: "/bgmi-lab" }, { label: tool.name }]} />
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span>MicroNest · BGMI Lab</span>
              <Badge variant="success">Free</Badge>
              <Badge variant="outline">No signup</Badge>
            </p>
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] border border-border bg-surface-muted">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </span>
              <div>
                <h1 className="font-display text-3xl font-normal tracking-tight">{tool.name}</h1>
                <p className="mt-1 text-muted-foreground">{tool.tagline}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
          </div>

          {/* Interaction island — dynamically loaded, ephemeral. */}
          <section aria-label={`Try ${tool.name}`}>
            <CircleIqShell />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">How it works</CardTitle>
              <CardDescription className="leading-relaxed">{tool.methodology}</CardDescription>
            </CardHeader>
          </Card>

          <section className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl font-normal tracking-tight">How to practice</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {tool.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {tool.examples && tool.examples.length > 0 ? (
            <section className="rounded-[16px] border border-border bg-surface-muted/40 p-5 sm:p-6">
              <h2 className="text-sm font-semibold">Examples</h2>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                {tool.examples.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {tool.tournamentContext ? (
            <section className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
              <h2 className="text-sm font-semibold">Tournament context</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.tournamentContext}</p>
              {tool.relatedHubHref ? (
                <Link href={tool.relatedHubHref as Route} className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted">
                  Browse the Tournament Hub
                </Link>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-xl font-normal tracking-tight">Questions</h2>
            <div className="mt-3 space-y-3">
              {tool.faqs.map((f) => (
                <details key={f.question} className="rounded-[12px] border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed">
                  <summary className="cursor-pointer font-medium">{f.question}</summary>
                  <p className="mt-2 text-muted-foreground">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={"/bgmi-lab" as Route} className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">BGMI Lab</p>
              <p className="mt-1 text-sm font-medium">All practice drills</p>
            </Link>
            <Link href={(tool.relatedSimulatorHref ?? "/bgmi-qualification") as Route} className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Qualification Simulator</p>
              <p className="mt-1 text-sm font-medium">Plan your points target</p>
            </Link>
          </div>

          {tool.disclaimer ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{tool.disclaimer}</p>
          ) : null}
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[{ name: "Home", item: "/" }, { name: "BGMI Lab", item: "/bgmi-lab" }, { name: tool.name, item: `/bgmi-lab/${tool.slug}` }]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLabJsonLd(tool)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLabFaqJsonLd(tool)) }} />
    </div>
  );
}
