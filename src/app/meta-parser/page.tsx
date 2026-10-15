import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import {
  getPatch,
  listGames,
  listPatches,
} from "@/features/meta-parser/repositories/reads";
import { resolveGameProvenance } from "./_lib/game-provenance";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Meta-Parser — Structured Esports Patch Facts | MicroNest",
  description:
    "Meta-Parser turns competitive-game patch notes into structured, searchable facts — every buff, nerf, and adjustment, attributable to its source.",
  alternates: { canonical: "/meta-parser" },
  openGraph: {
    title: "Meta-Parser — Structured Esports Patch Facts",
    description:
      "Esports patch intelligence, without the noise. Structured, searchable patch facts with source attribution.",
    url: "/meta-parser",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Meta-Parser — Structured Esports Patch Facts",
    description: "Esports patch intelligence, without the noise.",
  },
};

/**
 * Public Meta-Parser discovery page. Catalog-driven: games, latest patches,
 * and counts all come from `repositories/reads.ts` — nothing hardcoded.
 */
export default async function MetaParserPage() {
  const supabase = await createClient();
  const games = await listGames(supabase);
  const overviews = await Promise.all(
    games.map(async (game) => {
      const patches = await listPatches(supabase, game.slug);
      const latest = patches[0] ?? null;
      const latestHeader = latest ? await getPatch(supabase, game.slug, latest.patchVersion) : null;
      return {
        game,
        patches,
        patchCount: patches.length,
        latest,
        latestChangeCount: latestHeader?.changeCount ?? null,
      };
    })
  );
  const coverage = overviews
    .filter((o) => o.patches.length > 0)
    .map((o) => {
      const versions = o.patches.map((p) => p.patchVersion);
      return `${o.game.name} patches ${versions[versions.length - 1]} through ${versions[0]}`;
    });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-10 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden> · </span>
            <span className="text-foreground">Meta-Parser</span>
          </nav>

          <div className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest">
            <span className="text-primary">META-PARSER</span>
            <span className="text-border" aria-hidden>·</span>
            <span className="text-muted-foreground">PATCH FACTS</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">
            Esports patch intelligence, without the noise.
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Meta-Parser turns competitive-game patch notes into structured, searchable facts —
            every buff, nerf, and adjustment, attributable to its source. Facts first; interpretation later.
          </p>

          <section aria-label="Supported games" className="mt-10">
            <h2 className="font-display text-xl font-normal tracking-tight">Supported games</h2>
            {overviews.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No games published yet"
                  description="Patch facts will appear here as soon as the first game catalogue is published."
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {overviews.map(({ game, patchCount, latest, latestChangeCount }) => (
                  <Card key={game.slug}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-lg">{game.name}</CardTitle>
                        <Badge variant="success">Facts live</Badge>
                      </div>
                      <CardDescription>
                        {patchCount === 0
                          ? "No published patches yet."
                          : latest
                            ? `Latest: Patch ${latest.patchVersion}${
                                latestChangeCount !== null
                                  ? ` · ${latestChangeCount.toLocaleString("en-US")} changes`
                                  : ""
                              } · ${patchCount} published ${patchCount === 1 ? "patch" : "patches"}`
                            : `${patchCount} published ${patchCount === 1 ? "patch" : "patches"}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link
                        href={`/meta-parser/${game.slug}` as Route}
                        aria-label={`Browse ${game.name} patch facts`}
                        className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Browse {game.name} facts
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Coverage note" className="mt-10 rounded-[16px] border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-sm font-semibold text-foreground">Current coverage</h2>
            <p className="mt-2">
              {coverage.length === 0
                ? "No patch catalogue is published yet."
                : `The public dataset currently covers ${coverage.join("; ")}. Additional games will appear here when their catalogues are published — nothing on this page implies broader coverage than exists.`}
            </p>
            {overviews.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {overviews.map(({ game }) => {
                  const provenance = resolveGameProvenance(game);
                  return (
                    <li key={game.slug}>
                      {game.name}: {provenance.sourceLabel}
                      {provenance.datasetLabel !== null
                        ? ` · ${provenance.datasetLabel}${provenance.license !== null ? ` (${provenance.license})` : ""}`
                        : ""}
                      .
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
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
              { "@type": "ListItem", position: 2, name: "Meta-Parser", item: "/meta-parser" },
            ],
          }),
        }}
      />
    </div>
  );
}
