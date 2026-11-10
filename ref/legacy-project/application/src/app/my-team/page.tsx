import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  findTeamById,
  listMyMemberships,
  listTeamMembers,
  listTeamsForCaptain,
} from "@/features/finder/repositories/finder";
import { TeamForm } from "./team-form";
import { TeamLogoForm } from "./team-logo-form";
import { RosterList } from "./roster-list";

export const metadata: Metadata = {
  title: "My Team | MicroNest",
  description: "Create and manage your MicroNest Finder team.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /my-team — authenticated team management (Phase C).
 *
 * Create → manage identity, logo, roster. Recruitment posts live under
 * /my-team/recruitment. Private: noindex, never in the sitemap.
 */
export default async function MyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [captainTeams, memberships] = await Promise.all([
    listTeamsForCaptain(supabase, user.id),
    listMyMemberships(supabase, user.id),
  ]);

  const sp = await searchParams;
  const requested = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const activeTeam =
    (requested ? captainTeams.find((t) => t.id === requested) : undefined) ??
    captainTeams[0] ??
    null;

  // Teams the player belongs to but does not captain.
  const memberTeamIds = memberships
    .map((m) => m.team_id)
    .filter((id) => !captainTeams.some((t) => t.id === id));
  const memberTeams = (
    await Promise.all(memberTeamIds.map((id) => findTeamById(supabase, id)))
  ).filter((t) => t !== null);

  const roster = activeTeam ? await listTeamMembers(supabase, activeTeam.id) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <PageHeader
            title="My team"
            description="Your team identity, logo, and roster. Players discover you through open recruitment posts."
          />

          {captainTeams.length > 1 && (
            <nav aria-label="My teams" className="mt-4 flex flex-wrap gap-2">
              {captainTeams.map((team) => (
                <Link key={team.id} href={`/my-team?team=${team.id}` as Route}>
                  <Button
                    variant={activeTeam?.id === team.id ? "default" : "outline"}
                    size="sm"
                  >
                    {team.name}
                  </Button>
                </Link>
              ))}
            </nav>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {activeTeam ? (
              <>
                <TeamForm team={activeTeam} />
                <TeamLogoForm teamId={activeTeam.id} logoUrl={activeTeam.logo_url} />
                <Card>
                  <CardHeader>
                    <CardTitle>Roster</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RosterList
                      teamId={activeTeam.id}
                      members={roster}
                      currentUserId={user.id}
                    />
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link href={"/my-team/recruitment" as Route} className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto">Manage recruitment</Button>
                  </Link>
                  <Link
                    href={`/teams/${activeTeam.slug}` as Route}
                    className="w-full sm:w-auto"
                  >
                    <Button variant="outline" className="w-full sm:w-auto">
                      View public profile
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <EmptyState
                title="No team yet — create yours"
                description="Set your team identity, then post your first opening. New teams appear in the directory as soon as they are public and recruiting. No bots, no filler."
                action={null}
              />
            )}

            {!activeTeam && <TeamForm team={null} />}

            {memberTeams.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Teams I play for</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {memberTeams.map((team) => (
                      <li key={team.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium">{team.name}</span>
                        <Link
                          href={`/teams/${team.slug}` as Route}
                          className="text-primary underline"
                        >
                          View
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
