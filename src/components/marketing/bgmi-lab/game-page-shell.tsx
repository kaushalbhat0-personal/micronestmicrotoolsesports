import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { toolIcon } from "@/components/marketing/tool-icon-map";
import type { BgmiLabTool } from "@/config/public/bgmi-lab";
import { buildLabFaqJsonLd, buildLabJsonLd, labAbsoluteUrl } from "@/lib/marketing/public-tool-content";
import { AdSafeGameLayout } from "./ad-safe-game-layout";
import { AnswerBlock } from "./answer-block";
import { GameFaq } from "./game-faq";
import { RelatedLabGames } from "./related-lab-games";

/**
 * GamePageShell — reusable server-rendered structure for every BGMI Lab
 * game detail page.
 *
 * Owns: hero, answer block, game island boundary, methodology, practice
 * steps, scenario attribution, examples, FAQ, related content, disclaimer,
 * and JSON-LD. Contains no game state, no Supabase client, no billing or
 * entitlement logic, and no game-specific branching beyond registry data.
 *
 * Section order is AdSense-deliberate: the game island is followed by a
 * full explanation section before any future ad-safe region, so a future
 * ad slot can never sit adjacent to gameplay controls.
 */
export function GamePageShell({ tool, island }: { tool: BgmiLabTool; island: ReactNode }) {
  const Icon = toolIcon(tool.icon);
  const scenarioLabel = tool.scenarioKind === "tournament-derived" ? "Tournament-derived" : "Practice scenario";
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
              <Badge variant="secondary">{scenarioLabel}</Badge>
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

          {tool.answer ? <AnswerBlock answer={tool.answer} /> : null}

          {/* Interaction island — dynamically loaded, ephemeral. */}
          <AdSafeGameLayout label={`Try ${tool.name}`}>{island}</AdSafeGameLayout>

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
              {tool.scenarioRef?.sourceRevision ? (
                <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Source revision {tool.scenarioRef.sourceRevision}
                </p>
              ) : null}
              {tool.relatedHubHref ? (
                <Link
                  href={tool.relatedHubHref as Route}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Browse the Tournament Hub
                </Link>
              ) : null}
            </section>
          ) : null}

          <GameFaq tool={tool} />

          <RelatedLabGames tool={tool} />

          {tool.disclaimer ? <p className="text-xs leading-relaxed text-muted-foreground">{tool.disclaimer}</p> : null}
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: labAbsoluteUrl("/") },
          { name: "BGMI Lab", item: labAbsoluteUrl("/bgmi-lab") },
          { name: tool.name, item: labAbsoluteUrl(`/bgmi-lab/${tool.slug}`) },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLabJsonLd(tool)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLabFaqJsonLd(tool)) }} />
    </div>
  );
}
