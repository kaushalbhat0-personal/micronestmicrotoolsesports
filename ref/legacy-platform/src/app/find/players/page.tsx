import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { searchPublicPlayers } from "@/features/finder/repositories/finder";
import { parsePlayerSearchParams, activeFilterCount } from "@/features/finder/services/player-search";
import { PlayerCard } from "@/features/finder/components/player-card";
import { COMPETITIVE_LEVELS } from "@/features/finder/domain/levels";
import { BGMI_ROLES } from "@/features/finder/domain/roles";

/**
 * /find/players — first Finder discovery surface.
 *
 * Server-rendered GET filters (no client state, shareable URLs), masked
 * projection only, honest empty state. No match scores, no fabricated
 * counts — the result count shown is the real query size.
 */

export const metadata: Metadata = {
  title: "Find BGMI Players | MicroNest",
  description:
    "Discover BGMI players looking for a team: filter by role, level, region, and availability. Self-reported competitive context.",
  alternates: { canonical: "/find/players" },
  openGraph: { title: "Find BGMI Players", url: "/find/players", type: "website" },
};

type SearchParams = { [key: string]: string | string[] | undefined };

export const dynamic = "force-dynamic";

const selectClass =
  "h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm text-foreground";
const labelClass = "mb-1 block text-[13px] font-medium";

export default async function FindPlayersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parsePlayerSearchParams(sp);
  const supabase = await createClient();
  const players = await searchPublicPlayers(supabase, filters);
  const user = await getCurrentUser();
  const active = activeFilterCount(filters);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Find Players" }]} />
          <div className="mt-4">
            <PageHeader
              title="Find players"
              description="BGMI players looking for a team. Levels and roles are self-reported — verify fit in a tryout."
            />
          </div>

          <form method="get" action="/find/players" className="mt-6 rounded-[16px] border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="q" className={labelClass}>Search</label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={filters.query ?? ""}
                  placeholder="Handle or display name"
                  maxLength={40}
                  className="h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="role" className={labelClass}>Role</label>
                <select id="role" name="role" defaultValue={filters.role ?? ""} className={selectClass}>
                  <option value="">Any role</option>
                  {BGMI_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="current_level" className={labelClass}>Current level</label>
                <select id="current_level" name="current_level" defaultValue={filters.currentLevel ?? ""} className={selectClass}>
                  <option value="">Any level</option>
                  {COMPETITIVE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="target_level" className={labelClass}>Target level</label>
                <select id="target_level" name="target_level" defaultValue={filters.targetLevel ?? ""} className={selectClass}>
                  <option value="">Any target</option>
                  {COMPETITIVE_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="region" className={labelClass}>Region</label>
                <input
                  id="region"
                  type="text"
                  name="region"
                  defaultValue={filters.region ?? ""}
                  placeholder="e.g. IN-North"
                  maxLength={40}
                  className="h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" name="open_to_tryout" value="1" defaultChecked={filters.openToTryout} className="h-5 w-5" />
                  Open to tryout only
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">Apply filters</Button>
              {active > 0 && (
                <Link href={"/find/players" as Route} className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Clear ({active})
                  </Button>
                </Link>
              )}
            </div>
          </form>

          <div className="mt-6">
            {players.length === 0 ? (
              <EmptyState
                title={active > 0 ? "No players match these filters" : "No players here yet — be the first"}
                description={
                  active > 0
                    ? "Try widening the role, level, or region. New profiles appear here as players join."
                    : "The Finder is new. Create your player profile to appear here, and check back as teams and players join. No bots, no filler — every card is a real player."
                }
                action={
                  user ? (
                    <Link href={"/me" as Route}><Button>Create my profile</Button></Link>
                  ) : (
                    <Link href={"/signup" as Route}><Button>Create my profile</Button></Link>
                  )
                }
                secondaryAction={
                  <Link href={"/bgmi-tournaments" as Route}><Button variant="outline">Browse tournaments</Button></Link>
                }
              />
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground" role="status">
                  {players.length} player{players.length === 1 ? "" : "s"} looking for a team
                  {active > 0 && ` · ${active} filter${active === 1 ? "" : "s"} active`}
                </p>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {players.map((player) => (
                    <li key={player.handle}>
                      <PlayerCard player={player} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[{ name: "Home", item: "/" }, { name: "Find Players", item: "/find/players" }]}
      />
    </div>
  );
}
