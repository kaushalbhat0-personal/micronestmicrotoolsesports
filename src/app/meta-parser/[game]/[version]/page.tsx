import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import {
  getPatch,
  listChanges,
  listGames,
  type PublishedChange,
} from "@/features/meta-parser/repositories/reads";
import {
  CHANGE_TYPE_OPTIONS,
  changeTypeBadgeVariant,
  changeTypeLabel,
  entityTypeLabel,
  factsHref,
  factsRangeLabel,
  isVersionParam,
  parseFactsQuery,
} from "../../_lib/facts";
import { resolveGameProvenance } from "../../_lib/game-provenance";
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

function Transition({ change }: { change: PublishedChange }) {
  const numeric =
    change.oldNumeric !== null &&
    change.oldNumeric !== undefined &&
    change.newNumeric !== null &&
    change.newNumeric !== undefined;
  const textual =
    !numeric &&
    change.oldText !== null &&
    change.oldText !== undefined &&
    change.oldText !== "" &&
    change.newText !== null &&
    change.newText !== undefined &&
    change.newText !== "";
  if (numeric) {
    const unit = change.unit ? ` ${change.unit}` : "";
    return (
      <p className="mt-2 font-mono text-[13px] text-foreground" aria-label={`Changed from ${change.oldNumeric} to ${change.newNumeric}`}>
        <span className="text-muted-foreground line-through decoration-destructive/60">{String(change.oldNumeric)}{unit}</span>
        <span aria-hidden> → </span>
        <span className="font-semibold">{String(change.newNumeric)}{unit}</span>
      </p>
    );
  }
  if (textual) {
    return (
      <p className="mt-2 text-[13px] text-foreground">
        <span className="text-muted-foreground">{change.oldText}</span>
        <span aria-hidden> → </span>
        <span className="font-medium">{change.newText}</span>
      </p>
    );
  }
  return null;
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

  let result;
  try {
    result = await listChanges(supabase, patch.id, filters, {
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    // Invalid filter values are rejected by the repository (closed
    // change_type enum, generic entity shape guards); surface them as
    // "no matching filters", never as a crash.
    if (error instanceof AppError && error.code === "VALIDATION_ERROR") {
      result = { published: true, changes: [], limit: query.limit, offset: query.offset, hasMore: false };
    } else {
      throw error;
    }
  }
  if (!result.published) notFound();

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
            {patch.changeCount === 1 ? "change" : "changes"} · Revision {patch.revision}
          </p>

          <section aria-label="Filter changes" className="mt-8 rounded-[16px] border border-border bg-card p-4 sm:p-5">
            <form method="get" action={basePath} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="facts-entity-type" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Entity type
                </label>
                <input
                  id="facts-entity-type"
                  name="entity_type"
                  type="search"
                  defaultValue={query.entityType ?? ""}
                  placeholder="e.g. hero, champion, weapon"
                  autoComplete="off"
                  className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="facts-change-type" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Change type
                </label>
                <select
                  id="facts-change-type"
                  name="change_type"
                  defaultValue={query.changeType ?? ""}
                  className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All changes</option>
                  {CHANGE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="facts-entity" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Entity
                </label>
                <input
                  id="facts-entity"
                  name="entity"
                  type="search"
                  defaultValue={query.entity ?? ""}
                  placeholder="Search entity name"
                  autoComplete="off"
                  className="min-h-[44px] rounded-[10px] border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
                >
                  Apply filters
                </button>
                {hasFilters ? (
                  <Link
                    href={basePath as Route}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>
            </form>
          </section>

          <section aria-label="Patch changes" className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-xl font-normal tracking-tight">
                {hasFilters ? "Matching changes" : "All changes"}
              </h2>
              <p className="text-sm text-muted-foreground" role="status">
                {hasFilters
                  ? `Showing ${formatCount(result.changes.length)} matching ${result.changes.length === 1 ? "change" : "changes"} · Page ${query.page}${result.hasMore ? "+" : ""}`
                  : `${factsRangeLabel(query.offset, result.changes.length, patch.changeCount)} · Page ${query.page}`}
              </p>
            </div>

            {patch.changeCount === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No structured changes were recorded for this patch."
                  description="The patch is published, but its structured change set is empty."
                />
              </div>
            ) : result.changes.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No changes match these filters."
                  description="Try removing a filter or clearing the entity search."
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
              <ol className="mt-4 space-y-3">
                {result.changes.map((change) => (
                  <li key={change.id}>
                    <article className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{change.entityName}</h3>
                        <Badge variant={changeTypeBadgeVariant(change.changeType)}>
                          {changeTypeLabel(change.changeType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {entityTypeLabel(change.entityType)}
                          {change.category ? ` · ${change.category}` : ""}
                          {change.attribute ? ` · ${change.attribute}` : ""}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {change.description}
                      </p>
                      <Transition change={change} />
                    </article>
                  </li>
                ))}
              </ol>
            )}

            {(prevHref || nextHref) && result.changes.length > 0 ? (
              <nav aria-label="Change pages" className="mt-6 flex items-center justify-between gap-3">
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
