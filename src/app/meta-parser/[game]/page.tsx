import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import {
  getPatch,
  listGames,
  listPatches,
} from "@/features/meta-parser/repositories/reads";

export const revalidate = 3600;

function formatDate(iso: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string }>;
}): Promise<Metadata> {
  const { game } = await params;
  const supabase = await createClient();
  const games = await listGames(supabase).catch(() => []);
  const name = games.find((g) => g.slug === game)?.name ?? game;
  return {
    title: `${name} Patch Notes & Meta Facts — Meta-Parser | MicroNest`,
    description: `Structured ${name} patch facts — every buff, nerf, and adjustment across published patches, attributable to its source.`,
    alternates: { canonical: `/meta-parser/${game}` },
    openGraph: {
      title: `${name} Patch Notes & Meta Facts`,
      description: `Structured ${name} patch facts with source attribution.`,
      url: `/meta-parser/${game}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} Patch Notes & Meta Facts`,
      description: `Structured ${name} patch facts with source attribution.`,
    },
  };
}

/**
 * Game Facts index. Fully catalog-driven: game existence, patch list, and
 * per-patch counts all come from `repositories/reads.ts`. Future patches
 * appear automatically — no version list is hardcoded.
 */
export default async function GameFactsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game: gameSlug } = await params;
  const supabase = await createClient();
  const games = await listGames(supabase);
  const game = games.find((g) => g.slug === gameSlug);
  if (!game) notFound();

  const patches = await listPatches(supabase, gameSlug);
  const headers = await Promise.all(
    patches.map((patch) => getPatch(supabase, gameSlug, patch.patchVersion))
  );
  const rows = patches.map((patch, i) => ({ patch, header: headers[i] ?? null }));
  const latest = rows[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-10 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden> · </span>
            <Link href={"/meta-parser" as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Meta-Parser</Link> <span aria-hidden> · </span>
            <span className="text-foreground">{game.name}</span>
          </nav>

          <div className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest">
            <span className="text-primary">META-PARSER</span>
            <span className="text-border" aria-hidden>·</span>
            <span className="text-muted-foreground">FACTS</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">
            {game.name} patch facts
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Structured {game.name} patch notes — buffs, nerfs, and adjustments as searchable
            facts, each attributable to its source. Facts only; no analysis, no predictions.
          </p>

          {latest && latest.header ? (
            <section aria-label="Latest patch" className="mt-10 rounded-[20px] border border-border bg-card p-5 sm:p-6">
              <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Latest patch <Badge variant="success">Published</Badge>
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-display text-2xl font-normal tracking-tight">
                  Patch {latest.header.patchVersion}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatDate(latest.header.sourcePublishedAt)} ·{" "}
                  {latest.header.changeCount.toLocaleString("en-US")} changes
                </p>
              </div>
              <Link
                href={`/meta-parser/${gameSlug}/${latest.header.patchVersion}` as Route}
                aria-label={`Read Patch ${latest.header.patchVersion} facts`}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Read Patch {latest.header.patchVersion} facts
              </Link>
            </section>
          ) : null}

          <section aria-label="Patch history" className="mt-10">
            <h2 className="font-display text-xl font-normal tracking-tight">Patch history</h2>
            {rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No published patches yet"
                  description={`Patch facts for ${game.name} will appear here as soon as the first catalogue is published.`}
                />
              </div>
            ) : (
              <ol className="mt-4 divide-y divide-border rounded-[16px] border border-border bg-card">
                {rows.map(({ patch, header }) => (
                  <li key={patch.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <h3 className="font-medium">
                        <Link
                          href={`/meta-parser/${gameSlug}/${patch.patchVersion}` as Route}
                          className="hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          Patch {patch.patchVersion}
                        </Link>
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatDate(patch.sourcePublishedAt)}
                        {header ? ` · ${header.changeCount.toLocaleString("en-US")} changes` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/meta-parser/${gameSlug}/${patch.patchVersion}` as Route}
                      aria-label={`Read Patch ${patch.patchVersion} facts`}
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                    >
                      Read facts
                    </Link>
                  </li>
                ))}
              </ol>
            )}
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
              { "@type": "ListItem", position: 3, name: game.name, item: `/meta-parser/${gameSlug}` },
            ],
          }),
        }}
      />
    </div>
  );
}
