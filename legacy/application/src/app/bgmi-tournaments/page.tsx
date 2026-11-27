import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { listTournaments } from "@/features/bgmi-tournaments";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BGMI Tournament Hub — Standings, Match Results & History | MicroNest",
  description:
    "See BGMI tournament standings, match results, and tournament history — updated after completed matches. Free to read, sourced from Liquipedia.",
  alternates: { canonical: "/bgmi-tournaments" },
  openGraph: {
    title: "BGMI Tournament Hub — Standings & Results",
    description: "Where does the team currently stand? Updated after completed matches.",
    url: "/bgmi-tournaments",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BGMI Tournament Hub — Standings & Results",
    description: "Where does the team currently stand? Updated after completed matches.",
  },
};

function formatDateRange(startsOn: string | null, endsOn: string | null): string {
  if (!startsOn && !endsOn) return "Dates to be confirmed";
  const format = (iso: string): string => {
    const date = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  };
  if (startsOn && endsOn) return `${format(startsOn)} – ${format(endsOn)}`;
  return format(startsOn ?? endsOn ?? "");
}

/**
 * Public BGMI Tournament Hub index. Editorial, lightweight — ongoing
 * tournaments first, then history. No dashboard, no entitlement, no
 * gaming-dashboard aesthetic.
 */
export default async function BgmiTournamentsPage() {
  const supabase = await createClient();
  const tournaments = await listTournaments(supabase).catch(() => []);
  const ongoing = tournaments.filter((t) => t.status === "ongoing");
  const past = tournaments.filter((t) => t.status !== "ongoing");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main id="main-content" className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-3xl space-y-2">
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            MicroNest · BGMI Tournament Hub
          </p>
          <h1 className="font-display text-3xl font-normal tracking-tight sm:text-4xl">
            Where does the team currently stand?
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Tournament standings, match results, and history — updated after completed matches. Pair it with the{" "}
            <Link href="/bgmi-qualification" className="underline underline-offset-4 hover:text-foreground">
              BGMI Qualification Simulator
            </Link>{" "}
            to see what a team needs next.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-3xl space-y-8">
          <section aria-label="Ongoing tournaments">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ongoing</h2>
            {ongoing.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="No tournament running right now"
                  description="Completed tournaments are listed below. New standings appear here after completed matches."
                />
              </div>
            ) : (
              <div className="mt-3 grid gap-4">
                {ongoing.map((t) => (
                  <TournamentCard
                    key={t.slug}
                    slug={t.slug}
                    name={t.name}
                    shortName={t.shortName}
                    dateLine={formatDateRange(t.startsOn, t.endsOn)}
                    status="ongoing"
                    stages={t.stages}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-label="Past tournaments">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Past tournaments</h2>
            {past.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title="History is on its way"
                  description="The first verified tournament dataset is being published. Check back soon."
                />
              </div>
            ) : (
              <div className="mt-3 grid gap-4">
                {past.map((t) => (
                  <TournamentCard
                    key={t.slug}
                    slug={t.slug}
                    name={t.name}
                    shortName={t.shortName}
                    dateLine={formatDateRange(t.startsOn, t.endsOn)}
                    status="completed"
                    stages={t.stages}
                  />
                ))}
              </div>
            )}
          </section>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Standings are updated after completed matches — never second-by-second. Source: Liquipedia (CC BY-SA).
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
            ],
          }),
        }}
      />
    </div>
  );
}

function TournamentCard({
  slug,
  name,
  shortName,
  dateLine,
  status,
  stages,
}: {
  slug: string;
  name: string;
  shortName: string;
  dateLine: string;
  status: "ongoing" | "completed";
  stages: readonly { slug: string; name: string; status: string }[];
}) {
  const featured = stages[0];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          {status === "ongoing" ? <Badge variant="success">Ongoing</Badge> : <Badge variant="secondary">Completed</Badge>}
        </div>
        <CardDescription>
          {shortName} · {dateLine}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {featured ? (
          <p className="text-sm text-muted-foreground">
            {featured.name} · {featured.status === "ongoing" ? "Ongoing" : "Final"} · Updated after completed matches
          </p>
        ) : null}
        <Link
          href={`/bgmi-tournaments/${slug}` as Route}
          className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View tournament
        </Link>
      </CardContent>
    </Card>
  );
}
