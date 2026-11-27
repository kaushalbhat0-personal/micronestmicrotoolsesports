import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import {
  getPatch,
  listGroupedChanges,
  type ListGroupedChangesResult,
  listGames,
  listPatchEntityNames,
  listPatchEntityTypes,
} from "@/features/meta-parser/repositories/reads";
import {
  entitySearchPlaceholder,
  factsHref,
  groupsRangeLabel,
  isVersionParam,
  parseFactsQuery,
} from "../../_lib/facts";
import {
  getPresentationSection,
  getPresentationTaxonomy,
  sectionOrder,
} from "../../_lib/presentation-taxonomy";
import { resolveGameProvenance } from "../../_lib/game-provenance";
import { FactsFilters } from "../../_components/facts-filters";
import { PatchSections, type PatchSectionView } from "../../_components/patch-sections";
import { Provenance } from "../../_components/provenance";

export const revalidate = 3600;

function formatDate(iso: string | null): string {
  if (!iso) return "Date unavailable";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ game: string; version: string }>;
}): Promise<Metadata> {
  const { game, version } = await params;
  const supabase = await createClient();
  const games = await listGames(supabase).catch(() => []);
  const name = games.find((g) => g.slug === game)?.name ?? game;
  const patch = isVersionParam(version)
    ? await getPatch(supabase, game, version).catch(() => null)
    : null;
  const suffix = patch
    ? `${formatCount(patch.changeCount)} structured changes`
    : "structured patch facts";
  return {
    title: `${name} Patch ${version} — ${suffix} | MicroNest`,
    description: patch
      ? `${name} Patch ${version} as structured facts: ${formatCount(patch.changeCount)} buffs, nerfs, and adjustments with source attribution.`
      : `Structured ${name} Patch ${version} facts with source attribution.`,
    alternates: { canonical: `/meta-parser/${game}/${version}` },
    openGraph: {
      title: `${name} Patch ${version} — structured patch facts`,
      description: patch
        ? `${formatCount(patch.changeCount)} structured changes, attributable to source.`
        : "Structured patch facts with source attribution.",
      url: `/meta-parser/${game}/${version}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} Patch ${version} — structured patch facts`,
      description: patch
        ? `${formatCount(patch.changeCount)} structured changes, attributable to source.`
        : "Structured patch facts with source attribution.",
    },
  };
}

type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Patch Facts page. All data flows Page → repositories/reads.ts → RLS
 * Supabase client. Staging/failed/provisional rows resolve to `notFound()`
 * or `published: false` inside the repository — never rendered.
 */
export default async function PatchFactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string; version: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { game: gameSlug, version } = await params;
  const sp = await searchParams;
  if (!isVersionParam(version)) notFound();

  const supabase = await createClient();
  const games = await listGames(supabase);
  const game = games.find((g) => g.slug === gameSlug);
  if (!game) notFound();

  const patch = await getPatch(supabase, gameSlug, version);
  if (!patch) notFound();

  const query = parseFactsQuery(sp);
  const basePath = `/meta-parser/${gameSlug}/${version}`;
  const filters = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.changeType ? { changeType: query.changeType } : {}),
    ...(query.entity ? { entityNormalized: query.entity } : {}),
  };
  const hasFilters = Object.keys(filters).length > 0;

  let result: ListGroupedChangesResult;
  let entityTypes: readonly string[] = [];
  let entityNames: readonly string[] = [];
  try {
    [result, entityTypes, entityNames] = await Promise.all([
      listGroupedChanges(supabase, patch.id, filters, {
        groupLimit: query.groupLimit,
        groupOffset: query.groupOffset,
      }),
      listPatchEntityTypes(supabase, patch.id),
      listPatchEntityNames(supabase, patch.id),
    ]);
  } catch (error) {
    // Invalid filter values are rejected by the repository (closed
    // change_type enum, generic entity shape guards); surface them as
    // "no matching filters", never as a crash.
    if (error instanceof AppError && error.code === "VALIDATION_ERROR") {
      result = {
        published: true,
        groups: [],
        groupLimit: query.groupLimit,
        groupOffset: query.groupOffset,
        groupTotal: 0,
        changeTotal: 0,
        entityTypeTotals: {},
        hasMore: false,
      };
    } else {
      throw error;
    }
  }
  if (!result.published) notFound();

  // Group-then-paginate order: the reader returns whole entity groups in
  // first-stable_key order; the page only applies the presentation taxonomy
  // (section order, stable within sections) before rendering.
  const taxonomy = getPresentationTaxonomy(gameSlug);
  const orderedGroups = [...result.groups].sort(
    (a, b) => sectionOrder(gameSlug, a.entityType) - sectionOrder(gameSlug, b.entityType)
  );
  const sections: PatchSectionView[] = [];
  for (const section of taxonomy.sections) {
    const sectionGroups = orderedGroups.filter(
      (group) => getPresentationSection(gameSlug, group.entityType).key === section.key
    );
    if (sectionGroups.length === 0) continue;
    let sectionChangeCount = 0;
    let sectionGroupCount = 0;
    for (const [entityType, totals] of Object.entries(result.entityTypeTotals)) {
      if (getPresentationSection(gameSlug, entityType).key !== section.key) continue;
      sectionGroupCount += totals.groups;
      sectionChangeCount += totals.changes;
    }
    const representative = section.entityTypes[0];
    sections.push({
      key: section.key,
      label: section.label,
      changeCount: sectionChangeCount,
      groupCount: sectionGroupCount,
      filterHref:
        query.entityType || representative === undefined
          ? null
          : factsHref(basePath, {
              entityType: representative,
              changeType: query.changeType,
              entity: query.entity,
            }),
      groups: sectionGroups,
    });
  }

  const prevHref =
    query.page > 1
      ? factsHref(basePath, {
          entityType: query.entityType,
          changeType: query.changeType,
          entity: query.entity,
          page: query.page - 1,
        })
      : null;
  const nextHref = result.hasMore
    ? factsHref(basePath, {
        entityType: query.entityType,
        changeType: query.changeType,
        entity: query.entity,
        page: query.page + 1,
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <section className="container-nest py-10 lg:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden> · </span>
            <Link href={"/meta-parser" as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Meta-Parser</Link> <span aria-hidden> · </span>
            <Link href={`/meta-parser/${gameSlug}` as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{game.name}</Link> <span aria-hidden> · </span>
            <span className="text-foreground">{version}</span>
          </nav>

          <div className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-widest">
            <span className="text-primary">{game.name.toUpperCase()}</span>
            <span className="text-border" aria-hidden>·</span>
            <span className="text-muted-foreground">PATCH FACTS</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-normal tracking-tight sm:text-4xl">
            Patch {patch.patchVersion}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {formatDate(patch.sourcePublishedAt)} · {formatCount(patch.changeCount)}{" "}
            {patch.changeCount === 1 ? "change" : "changes"}
          </p>

          <section aria-label="Filter changes" className="mt-8 rounded-[16px] border border-border bg-card p-4 sm:p-5">
            <FactsFilters
              basePath={basePath}
              gameSlug={gameSlug}
              entityType={query.entityType}
              changeType={query.changeType}
              entity={query.entity}
              entityTypes={entityTypes}
              entityNames={entityNames}
              searchPlaceholder={entitySearchPlaceholder(entityTypes)}
              hasFilters={hasFilters}
            />
          </section>

          <section aria-label="Patch changes" className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-xl font-normal tracking-tight">
                {hasFilters ? "Matching changes" : "All changes in this patch"}
              </p>
              <p className="text-sm text-muted-foreground" role="status">
                {`${groupsRangeLabel(query.groupOffset, result.groups.length, result.groupTotal, result.changeTotal)} · Page ${query.page}`}
              </p>
            </div>

            {patch.changeCount === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No structured changes were recorded for this patch."
                  description="The patch is published, but its structured change set is empty."
                />
              </div>
            ) : result.groups.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No changes match these filters."
                  description="Try removing a filter or clearing the search."
                  action={
                    <Link
                      href={basePath as Route}
                      className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Clear filters
                    </Link>
                  }
                />
              </div>
            ) : (
              <PatchSections sections={sections} />
            )}

            {(prevHref || nextHref) && result.groups.length > 0 ? (
              <nav aria-label="Entity group pages" className="mt-6 flex items-center justify-between gap-3">
                {prevHref ? (
                  <Link
                    href={prevHref as Route}
                    rel="prev"
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span aria-hidden className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-5 text-sm text-muted-foreground/50">
                    ← Previous
                  </span>
                )}
                <p className="text-sm text-muted-foreground" aria-live="polite">Page {query.page}</p>
                {nextHref ? (
                  <Link
                    href={nextHref as Route}
                    rel="next"
                    className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Next →
                  </Link>
                ) : (
                  <span aria-hidden className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-5 text-sm text-muted-foreground/50">
                    Next →
                  </span>
                )}
              </nav>
            ) : null}
          </section>

          <div className="mt-10">
            <Provenance
              sourceUrl={patch.sourceUrl}
              patchVersion={patch.patchVersion}
              gameName={game.name}
              provenance={resolveGameProvenance(game)}
              revision={patch.revision}
            />
          </div>
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
              { "@type": "ListItem", position: 4, name: `Patch ${version}`, item: `/meta-parser/${gameSlug}/${version}` },
            ],
          }),
        }}
      />
    </div>
  );
}
