import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Breadcrumbs, BreadcrumbJsonLd } from "@/components/marketing/content/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  findFinderProfileByUserId,
  findGameProfileByUserAndGame,
  findPublicTeamBySlug,
  listMyApplications,
  listOpenPostsForTeam,
  listTeamMembers,
} from "@/features/finder/repositories/finder";
import { isCompetitiveLevel } from "@/features/finder/domain/levels";
import { buildFitReasons } from "@/features/finder/services/fit-reasons";
import { VerificationBadge } from "@/features/finder/components/verification-badge";
import { FitReasons } from "@/features/finder/components/fit-reasons";
import { ApplyButton } from "./apply-button";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const team = await findPublicTeamBySlug(supabase, slug);
  if (!team) return {};
  return {
    title: `${team.name} — BGMI Team | MicroNest`,
    description: `BGMI team ${team.name}: ${team.current_level} aiming for ${team.target_level}, ${team.region}. ${team.recruiting ? "Recruiting players." : ""} Self-reported competitive context.`,
    alternates: { canonical: `/teams/${team.slug}` },
    robots: { index: false, follow: true },
    openGraph: {
      title: `${team.name}`,
      description: `BGMI team · ${team.current_level} → ${team.target_level}${team.recruiting ? " · Recruiting" : ""}`,
      url: `/teams/${team.slug}`,
      type: "profile",
    },
  };
}

/**
 * Public team profile — masked projection only (finder_public_teams).
 * Never exposes external_link, captain identity, user ids, reports,
 * or applications. Roster shows only when readable (member session);
 * otherwise it stays honestly private.
 */
export default async function TeamProfilePage({ params }: Params) {
  const { slug } = await params;
  const supabase = await createClient();
  const team = await findPublicTeamBySlug(supabase, slug);
  if (!team) notFound();

  const [openPosts, user] = await Promise.all([
    listOpenPostsForTeam(supabase, team.id).catch(() => []),
    getCurrentUser(),
  ]);

  const [profile, gameProfile, myApplications, roster] = await Promise.all([
    user ? findFinderProfileByUserId(supabase, user.id) : Promise.resolve(null),
    user ? findGameProfileByUserAndGame(supabase, user.id, "bgmi") : Promise.resolve(null),
    user ? listMyApplications(supabase, user.id).catch(() => []) : Promise.resolve([]),
    listTeamMembers(supabase, team.id).catch(() => null),
  ]);

  const appliedPostIds = new Set(myApplications.map((a) => a.post_id));

  const playerLevel =
    profile && isCompetitiveLevel(profile.current_level) ? profile.current_level : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Find Teams", href: "/find/teams" },
              { label: team.name },
            ]}
          />
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {team.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={team.logo_url}
                    alt={`${team.name} logo`}
                    className="h-16 w-16 rounded-[16px] border border-border object-cover"
                  />
                )}
                <div>
                  <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] text-foreground">
                    {team.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">/teams/{team.slug}</p>
                </div>
              </div>
              {team.recruiting ? (
                <Badge variant="info">Recruiting</Badge>
              ) : (
                <Badge variant="secondary">Not recruiting</Badge>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Team context</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Current level</dt><dd className="font-medium">{team.current_level} (self-reported)</dd></div>
                  <div><dt className="text-muted-foreground">Target level</dt><dd className="font-medium">{team.target_level} (self-reported)</dd></div>
                  <div><dt className="text-muted-foreground">Region</dt><dd className="font-medium">{team.region}</dd></div>
                  <div><dt className="text-muted-foreground">Game</dt><dd className="font-medium">{team.game.toUpperCase()}</dd></div>
                </dl>
                {team.description && (
                  <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed">
                    {team.description}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Roster</CardTitle>
              </CardHeader>
              <CardContent>
                {roster === null ? (
                  <p className="text-sm text-muted-foreground">
                    Roster details are private to team members. Apply to an open role
                    to start the conversation.
                  </p>
                ) : roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members listed.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {roster.map((member) => (
                      <li key={`${member.team_id}-${member.user_id}`} className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant={member.role === "captain" ? "default" : "secondary"}>
                          {member.role}
                        </Badge>
                        {member.game_role && (
                          <Badge variant="outline">{member.game_role}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3">
              <h2 className="text-[18px] font-semibold">Open roles</h2>
              {openPosts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      {team.recruiting
                        ? "No open roles right now. Check back soon."
                        : "This team is not recruiting right now."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                openPosts.map((post) => {
                  const postLevel = isCompetitiveLevel(post.current_level_min)
                    ? post.current_level_min
                    : null;
                  const canShowFit = Boolean(playerLevel && postLevel && profile && gameProfile);
                  return (
                    <Card key={post.id}>
                      <CardHeader>
                        <CardTitle>{post.role_needed}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {post.current_level_min} → {post.target_level} (self-reported)
                          </Badge>
                          <Badge variant="outline">{post.region}</Badge>
                          <Badge variant="outline">
                            {post.slots} slot{post.slots === 1 ? "" : "s"}
                          </Badge>
                          {post.tryout_required && (
                            <Badge variant="outline">Tryout required</Badge>
                          )}
                        </div>
                        {post.availability_required.length > 0 && (
                          <p className="text-muted-foreground">
                            Availability:{" "}
                            <span className="font-medium text-foreground">
                              {post.availability_required.join(", ")}
                            </span>
                          </p>
                        )}
                        {post.experience_min && (
                          <p className="text-muted-foreground">
                            Experience:{" "}
                            <span className="font-medium text-foreground">
                              {post.experience_min}
                            </span>
                          </p>
                        )}
                        {canShowFit && playerLevel && postLevel && profile && gameProfile && (
                          <div className="rounded-[12px] bg-surface-muted/40 p-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Why this role may fit (facts, not a score)
                            </p>
                            <FitReasons
                              reasons={buildFitReasons({
                                playerRegion: profile.region,
                                playerCurrentLevel: playerLevel,
                                playerRoles: [
                                  profile.primary_role,
                                  ...profile.secondary_roles,
                                ],
                                playerOpenToTryout: profile.open_to_tryout,
                                playerVerified:
                                  gameProfile.verification_status === "verified",
                                postRegion: post.region,
                                postLevelMin: postLevel,
                                postRoleNeeded: post.role_needed,
                                postTryoutRequired: post.tryout_required,
                              })}
                            />
                          </div>
                        )}
                        <ApplyButton
                          postId={post.id}
                          signedIn={Boolean(user)}
                          alreadyApplied={appliedPostIds.has(post.id)}
                        />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Levels are self-reported, not MicroNest ratings</Badge>
              {gameProfile?.verification_status === "verified" && <VerificationBadge verified />}
              <Link href={"/find/teams" as Route} className="text-sm text-primary underline">
                Back to Find Teams
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Find Teams", item: "/find/teams" },
          { name: team.name, item: `/teams/${team.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsTeam",
            name: team.name,
            sport: "BGMI Esports",
            description: `BGMI team (self-reported ${team.current_level}, targeting ${team.target_level}).`,
          }),
        }}
      />
    </div>
  );
}
