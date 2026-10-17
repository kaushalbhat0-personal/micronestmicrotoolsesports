import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getStageDetail } from "@/features/bgmi-tournaments";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tournament: string; stage: string }>;
}): Promise<Metadata> {
  const { tournament: tournamentSlug, stage: stageSlug } = await params;
  const supabase = await createClient();
  const detail = await getStageDetail(supabase, tournamentSlug, stageSlug).catch(() => null);
  const title = detail ? `${detail.tournament.name} — ${detail.stage.name}` : `${tournamentSlug} ${stageSlug}`;
  return {
    title: `${title} Standings & Match Results | MicroNest BGMI Tournament Hub`,
    description: `See ${title} standings, per-map results, and last-updated source revision — updated after completed matches. Source: Liquipedia.`,
    alternates: { canonical: `/bgmi-tournaments/${tournamentSlug}/${stageSlug}` },
    openGraph: {
      title: `${title} — Standings & Results`,
      description: `Updated after completed matches. Source: Liquipedia.`,
      url: `/bgmi-tournaments/${tournamentSlug}/${stageSlug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Standings & Results`,
      description: `Updated after completed matches. Source: Liquipedia.`,
    },
  };
}

function formatInstant(iso: string | null): string {
  if (!iso) return "Date to be confirmed";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function simulatorHref(totalPoints: number, updatedAt: string | null): Route {
  const params = new URLSearchParams({ current: String(totalPoints) });
  if (updatedAt) params.set("updated", updatedAt);
  return `/bgmi-qualification?${params.toString()}` as Route;
}

/**
 * Stage page: standings + match results on one page (no separate
 * /standings or /matches SEO pages by design).
 */
export default async function BgmiStagePage({
  params,
}: {
  params: Promise<{ tournament: string; stage: string }>;
}) {
  const { tournament: tournamentSlug, stage: stageSlug } = await params;
  const supabase = await createClient();
  const detail = await getStageDetail(supabase, tournamentSlug, stageSlug).catch(() => null);
  if (!detail) notFound();
  const { tournament, stage, standings, matches } = detail;

  const completedMatches = matches.filter((m) => m.status === "completed");
  const scheduledMatches = matches.filter((m) => m.status !== "completed");
  const lastUpdated = stage.publishedAt ?? tournament.sourceLastUpdatedAt;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main id="main-content" className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden> · </span>
            <Link href={"/bgmi-tournaments" as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Tournament Hub</Link> <span aria-hidden> · </span>
            <Link href={`/bgmi-tournaments/${tournament.slug}` as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">{tournament.shortName}</Link> <span aria-hidden> · </span>
            <span className="text-foreground">{stage.name}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-normal tracking-tight">
              {tournament.name} — {stage.name}
            </h1>
            {stage.status === "ongoing" ? (
              <Badge variant="success">Ongoing</Badge>
            ) : stage.status === "upcoming" ? (
              <Badge variant="warning">Upcoming</Badge>
            ) : (
              <Badge variant="secondary">Final</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {stage.formatNote ?? `${standings.length} teams`} · Updated after completed matches
          </p>
          {stage.smashRule ? (
            <p className="mt-3 rounded-[12px] border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              This stage ended with a Smash Rule (match-point) format
              {stage.matchPointThreshold ? ` — the match-point threshold was ${stage.matchPointThreshold} points` : ""}.
              The table below shows the points race; final positions were decided by the match-point rule, not by points
              alone.
            </p>
          ) : null}

          <section aria-label="Standings" className="mt-8">
            <h2 className="font-display text-xl font-normal tracking-tight">Standings</h2>
            {standings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Standings will appear here after the first completed match.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-[16px] border border-border bg-card">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                      <th scope="col" className="px-4 py-3 font-medium">Team</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right" title="Chicken dinners (match wins)">WWCD</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Placement</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Finishes</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Total</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Matches</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">
                        <span className="sr-only">Analyze qualification</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => (
                      <tr key={row.teamCanonical} className="border-b border-border/60 last:border-0 tabular-nums">
                        <td className="px-4 py-3 font-semibold">{row.rank}</td>
                        <td className="px-4 py-3 font-medium">{row.displayName}</td>
                        <td className="px-4 py-3 text-right">{row.wins}</td>
                        <td className="px-4 py-3 text-right">{row.placementPoints}</td>
                        <td className="px-4 py-3 text-right">{row.finishes}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.totalPoints}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{row.matchesPlayed}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={simulatorHref(row.totalPoints, lastUpdated)}
                            aria-label={`Analyze qualification for ${row.displayName} with ${row.totalPoints} points`}
                            className="inline-flex min-h-[44px] items-center rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Analyze qualification
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Ranked by total points, then match wins (WWCD), then placement points, finishes, and the most recent
              match. Totals include starting (carried-over) points where a previous stage fed this one.
            </p>
          </section>

          <section aria-label="Match results" className="mt-10">
            <h2 className="font-display text-xl font-normal tracking-tight">Match results</h2>
            {completedMatches.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No completed matches yet. Scheduled maps appear below.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {completedMatches.map((match) => (
                  <li key={match.matchNumber} className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-medium">
                        Match {match.matchNumber}
                        {match.mapName ? ` · ${match.mapName}` : ""}
                      </h3>
                      <p className="text-xs text-muted-foreground">{formatInstant(match.scheduledAt)}</p>
                      {match.vodUrl ? (
                        <a href={match.vodUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-4 hover:text-foreground">
                          VOD
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted-foreground">
                            <th scope="col" className="py-1 pr-3 font-medium">#</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Team</th>
                            <th scope="col" className="py-1 pr-3 font-medium text-right">Place</th>
                            <th scope="col" className="py-1 pr-3 font-medium text-right">Fin.</th>
                            <th scope="col" className="py-1 font-medium text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {match.results.map((result) => (
                            <tr key={result.teamCanonical} className="tabular-nums">
                              <td className="py-1 pr-3 text-muted-foreground">{result.rank}</td>
                              <td className="py-1 pr-3">{result.displayName}</td>
                              <td className="py-1 pr-3 text-right">{result.placement}</td>
                              <td className="py-1 pr-3 text-right">{result.finishes}</td>
                              <td className="py-1 text-right font-medium">{result.totalPoints}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {scheduledMatches.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-medium">Schedule</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {scheduledMatches.map((match) => (
                    <li key={match.matchNumber}>
                      Match {match.matchNumber}
                      {match.mapName ? ` · ${match.mapName}` : ""} · {formatInstant(match.scheduledAt)} ·{" "}
                      <span className="font-medium">Not yet completed</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-label="Last updated" className="mt-10 rounded-[16px] border border-border bg-card p-5 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Last updated</h2>
            <p className="mt-2">
              {lastUpdated ? formatInstant(lastUpdated) : "Update time unavailable"} · Source:{" "}
              <a href={tournament.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                Liquipedia
              </a>{" "}
              (CC BY-SA)
              {tournament.sourceRevision ? ` · Source revision ${tournament.sourceRevision}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Standings are updated after completed matches. KRAFTON/BGMI names and marks belong to their owners; this
              page is an independent summary with attribution, not an official standings feed.
            </p>
          </section>
        </div>
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
              { "@type": "ListItem", position: 2, name: "BGMI Tournament Hub", item: "/bgmi-tournaments" },
              { "@type": "ListItem", position: 3, name: tournament.name, item: `/bgmi-tournaments/${tournament.slug}` },
              {
                "@type": "ListItem",
                position: 4,
                name: `${tournament.name} ${stage.name}`,
                item: `/bgmi-tournaments/${tournament.slug}/${stage.slug}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
