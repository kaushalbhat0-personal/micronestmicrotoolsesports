import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getTournament } from "@/features/bgmi-tournaments";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ tournament: string }> }): Promise<Metadata> {
  const { tournament: slug } = await params;
  const supabase = await createClient();
  const tournament = await getTournament(supabase, slug).catch(() => null);
  // Never echo an unvalidated slug into metadata: unknown slugs 404.
  const name = tournament?.name ?? "Tournament";
  return {
    title: `${name} — Standings & Results | MicroNest BGMI Tournament Hub`,
    description: `See ${name} standings, stages, and match results — updated after completed matches. Source: Liquipedia.`,
    alternates: { canonical: `/bgmi-tournaments/${slug}` },
    openGraph: {
      title: `${name} — Standings & Results`,
      description: `Updated after completed matches. Source: Liquipedia.`,
      url: `/bgmi-tournaments/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Standings & Results`,
      description: `Updated after completed matches. Source: Liquipedia.`,
    },
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "To be confirmed";
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Tournament page: identity, format, stages, attribution.
 * Standings live on the stage page — this page stays lean.
 */
export default async function BgmiTournamentPage({ params }: { params: Promise<{ tournament: string }> }) {
  const { tournament: slug } = await params;
  const supabase = await createClient();
  const tournament = await getTournament(supabase, slug).catch(() => null);
  if (!tournament) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main id="main-content" className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Home</Link> <span aria-hidden> · </span>
            <Link href={"/bgmi-tournaments" as Route} className="hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Tournament Hub</Link> <span aria-hidden> · </span>
            <span className="text-foreground">{tournament.shortName}</span>
          </nav>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-normal tracking-tight">{tournament.name}</h1>
            {tournament.status === "ongoing" ? (
              <Badge variant="success">Ongoing</Badge>
            ) : tournament.status === "upcoming" ? (
              <Badge variant="warning">Upcoming</Badge>
            ) : (
              <Badge variant="secondary">Completed</Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDate(tournament.startsOn)} – {formatDate(tournament.endsOn)}
            {tournament.organizer ? ` · Organized by ${tournament.organizer}` : ""}
          </p>

          <section aria-label="Stages" className="mt-8">
            <h2 className="font-display text-xl font-normal tracking-tight">Stages</h2>
            <div className="mt-4 grid gap-4">
              {tournament.stages.map((stage) => (
                <Card key={stage.slug}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{stage.name}</CardTitle>
                      {stage.status === "ongoing" ? (
                        <Badge variant="success">Ongoing</Badge>
                      ) : stage.status === "upcoming" ? (
                        <Badge variant="warning">Upcoming</Badge>
                      ) : (
                        <Badge variant="secondary">Final</Badge>
                      )}
                      {stage.smashRule ? <Badge variant="outline">Smash Rule ending</Badge> : null}
                    </div>
                    <CardDescription>
                      {stage.completedMatches}/{stage.totalMatches} matches completed · {stage.teamsCount} teams
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/bgmi-tournaments/${tournament.slug}/${stage.slug}` as Route}
                      className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View standings &amp; results
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section aria-label="Tournament information" className="mt-8 rounded-[16px] border border-border bg-card p-5 text-sm leading-relaxed">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tournament information</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Season</dt>
                <dd>{tournament.seasonYear ?? "To be confirmed"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">Organizer</dt>
                <dd>{tournament.organizer ?? "To be confirmed"}</dd>
              </div>
              {tournament.rulebookUrl ? (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">Rulebook</dt>
                  <dd>
                    <a href={tournament.rulebookUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
                      Official rulebook
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Source:{" "}
            <a href={tournament.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              Liquipedia
            </a>{" "}
            (CC BY-SA). Tournament data is updated after completed matches.
            {tournament.sourceRevision ? ` Source revision ${tournament.sourceRevision}.` : ""}
          </p>
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
            ],
          }),
        }}
      />
    </div>
  );
}
