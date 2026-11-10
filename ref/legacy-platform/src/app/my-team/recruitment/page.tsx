import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  listApplicationsForPost,
  listRecruitmentPostsForTeam,
  listTeamsForCaptain,
  type FinderApplicationRow,
} from "@/features/finder/repositories/finder";
import { PostForm } from "./post-form";
import { PostManager } from "./post-manager";

export const metadata: Metadata = {
  title: "Recruitment | MicroNest",
  description: "Manage your team's recruitment openings and review applications.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /my-team/recruitment — captain recruitment management (Phase C).
 * Post CRUD + application review (shortlist/accept/decline). Private.
 */
export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const captainTeams = await listTeamsForCaptain(supabase, user.id);

  if (captainTeams.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main id="main-content" className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
            <PageHeader
              title="Recruitment"
              description="Post openings and review applications."
            />
            <div className="mt-6">
              <EmptyState
                title="Create a team first"
                description="Recruitment posts belong to a team. Create your team, then post your first opening."
                action={
                  <Link href={"/my-team" as Route}>
                    <Button>Create my team</Button>
                  </Link>
                }
              />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const sp = await searchParams;
  const requested = Array.isArray(sp.team) ? sp.team[0] : sp.team;
  const fallbackTeam = captainTeams[0];
  if (!fallbackTeam) redirect("/my-team" as Route);
  const activeTeam =
    (requested ? captainTeams.find((t) => t.id === requested) : undefined) ??
    fallbackTeam;

  const posts = await listRecruitmentPostsForTeam(supabase, activeTeam.id);
  const applicationsByPost = new Map<string, FinderApplicationRow[]>();
  await Promise.all(
    posts.map(async (post) => {
      const applications = await listApplicationsForPost(supabase, post.id).catch(
        () => [],
      );
      applicationsByPost.set(post.id, applications);
    }),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <PageHeader
            title="Recruitment"
            description={`Openings and applications for ${activeTeam.name}. Only you (captain) can see applications.`}
          />

          {captainTeams.length > 1 && (
            <nav aria-label="My teams" className="mt-4 flex flex-wrap gap-2">
              {captainTeams.map((team) => (
                <Link key={team.id} href={`/my-team/recruitment?team=${team.id}` as Route}>
                  <Button
                    variant={activeTeam.id === team.id ? "default" : "outline"}
                    size="sm"
                  >
                    {team.name}
                  </Button>
                </Link>
              ))}
            </nav>
          )}

          <div className="mt-6 flex flex-col gap-4">
            <PostForm teamId={activeTeam.id} post={null} />

            {posts.length === 0 ? (
              <EmptyState
                title="No openings yet"
                description="Post your first opening above: role needed, level window, region, and whether a tryout is required."
              />
            ) : (
              posts.map((post) => (
                <PostManager
                  key={post.id}
                  post={post}
                  teamName={activeTeam.name}
                  applications={applicationsByPost.get(post.id) ?? []}
                />
              ))
            )}

            <Card>
              <CardHeader>
                <CardTitle>How applications work</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                Players apply to open posts. You can shortlist, accept (the player
                joins your roster immediately), or decline. Players can withdraw
                while their application is active. Nobody else can see these
                applications — not other players, not other teams.
              </CardContent>
            </Card>

            <Link href={"/my-team" as Route} className="text-sm text-primary underline">
              Back to team management
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
