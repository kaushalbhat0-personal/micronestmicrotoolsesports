import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  listOpenRecruitmentPosts,
  searchPublicTeams,
} from "@/features/finder/repositories/finder";
import {
  activeTeamFilterCount,
  parseTeamSearchParams,
} from "@/features/finder/services/team-search";
import { TeamCard } from "@/features/finder/components/team-card";
import { COMPETITIVE_LEVELS } from "@/features/finder/domain/levels";
import { BGMI_ROLES } from "@/features/finder/domain/roles";

export const metadata: Metadata = {
  title: "Find BGMI Teams | MicroNest",
  description:
    "Discover BGMI teams recruiting players: filter by level, region, and role needed. Self-reported competitive context.",
  alternates: { canonical: "/find/teams" },
  openGraph: { title: "Find BGMI Teams", url: "/find/teams", type: "website" },
};

type SearchParams = { [key: string]: string | string[] | undefined };

export const dynamic = "force-dynamic";

const selectClass =
  "h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm text-foreground";
const labelClass = "mb-1 block text-[13px] font-medium";

/**
 * /find/teams — team + recruitment discovery (Phase C).
 *
 * Server-rendered GET filters (shareable URLs), masked projections
 * only, honest cold-start empty states. No scores, no fabricated
 * counts — every number shown is the real query size.
 */
export default async function FindTeamsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseTeamSearchParams(sp);
  const supabase = await createClient();
  const [teams, user] = await Promise.all([
    searchPublicTeams(supabase, filters),
    getCurrentUser(),
  ]);

  // Open roles across teams (single query, grouped in memory). Role
  // filter narrows this list; team cards below always reflect the team
  // filters above.
  const roleParam = typeof sp.role === "string" ? sp.role : undefined;
  const roleFilter = roleParam && (BGMI_ROLES as ReadonlyArray<string>).includes(roleParam)
    ? roleParam
    : undefined;
  const openPosts = await listOpenRecruitmentPosts(supabase, {
    game: "bgmi",
    ...(roleFilter ? { roleNeeded: roleFilter } : {}),
  }).catch(() => []);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const active = activeTeamFilterCount(filters) + (roleFilter ? 1 : 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Find Teams" }]} />
          <div className="mt-4">
            <PageHeader
              title="Find teams"
              description="BGMI teams looking for players. Levels and roles are self-reported — verify fit in a tryout."
            />
          </div>

          <form method="get" action="/find/teams" className="mt-6 rounded-[16px] border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="q" className={labelClass}>Search</label>
                <input
                  id="q"
                  type="search"
                  name="q"
                  defaultValue={filters.query ?? ""}
                  placeholder="Team name"
                  maxLength={60}
                  className="h-11 w-full rounded-[12px] border border-input bg-card px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="role" className={labelClass}>Role needed</label>
                <select id="role" name="role" defaultValue={roleFilter ?? ""} className={selectClass}>
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
                  <input type="checkbox" name="recruiting" value="0" className="h-5 w-5" />
                  Include non-recruiting teams
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">Apply filters</Button>
              {active > 0 && (
                <Link href={"/find/teams" as Route} className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    Clear ({active})
                  </Button>
                </Link>
              )}
            </div>
          </form>

          <div className="mt-6">
            {teams.length === 0 ? (
              <EmptyState
                title={active > 0 ? "No teams match these filters" : "No teams recruiting yet"}
                description={
                  active > 0
                    ? "Try widening the role, level, or region. New teams appear here as captains join."
                    : "The team directory is new. Create your team and post your first opening — every card here is a real team, no bots, no filler."
                }
                action={
                  user ? (
                    <Link href={"/my-team" as Route}><Button>Create my team</Button></Link>
                  ) : (
                    <Link href={"/signup" as Route}><Button>Create my team</Button></Link>
                  )
                }
                secondaryAction={
                  <Link href={"/find/players" as Route}><Button variant="outline">Browse players</Button></Link>
                }
              />
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground" role="status">
                  {teams.length} team{teams.length === 1 ? "" : "s"}
                  {active > 0 && ` · ${active} filter${active === 1 ? "" : "s"} active`}
                </p>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <TeamCard team={team} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-[18px] font-semibold">
              Open roles{roleFilter ? ` · ${roleFilter}` : ""}
            </h2>
            {openPosts.length === 0 ? (
              <Card className="mt-3">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    No open roles{roleFilter ? " for this role" : ""} right now.{" "}
                    {active > 0 ? "Try broadening your search." : "Teams post openings here as they start recruiting."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="mb-3 mt-1 text-sm text-muted-foreground" role="status">
                  {openPosts.length} open role{openPosts.length === 1 ? "" : "s"}
                </p>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {openPosts.slice(0, 24).map((post) => {
                    const team = teamsById.get(post.team_id);
                    return (
                      <li key={post.id} className="rounded-[16px] border bg-card p-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">{post.role_needed}</Badge>
                          <Badge variant="outline">
                            {post.current_level_min} → {post.target_level}
                          </Badge>
                          <Badge variant="outline">{post.region}</Badge>
                          {post.tryout_required && (
                            <Badge variant="outline">Tryout</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-sm">
                          {team ? (
                            <Link
                              href={`/teams/${team.slug}` as Route}
                              className="font-medium text-primary underline"
                            >
                              {team.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              Team profile private
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            {" "}· {post.slots} slot{post.slots === 1 ? "" : "s"}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[{ name: "Home", item: "/" }, { name: "Find Teams", item: "/find/teams" }]}
      />
    </div>
  );
}
