import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { listMyApplications } from "@/features/finder/repositories/finder";
import { WithdrawButton } from "./withdraw-button";

export const metadata: Metadata = {
  title: "My Applications | MicroNest",
  description: "Track your team applications.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * /me/applications — player's own applications (Phase C). Private:
 * only the applicant's rows (RLS applicant_user_id = auth.uid()).
 * Post details stay minimal on purpose: non-open posts are not
 * readable to non-members, so the card shows status + note + date.
 */
export default async function MyApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const applications = await listMyApplications(supabase, user.id).catch(() => []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <PageHeader
            title="My applications"
            description="Roles you applied for. Only you and the team's captain can see these."
          />
          <div className="mt-6">
            {applications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Find a team that fits, open its profile, and apply to an open role. Shortlisted and accepted applications appear here."
                action={
                  <Link href={"/find/teams" as Route}>
                    <Button>Find teams</Button>
                  </Link>
                }
                secondaryAction={
                  <Link href={"/me" as Route}>
                    <Button variant="outline">My player profile</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {applications.map((application) => (
                  <li key={application.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-2 pt-6 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              application.status === "accepted"
                                ? "success"
                                : application.status === "declined"
                                  ? "destructive"
                                  : application.status === "withdrawn"
                                    ? "secondary"
                                    : "info"
                            }
                          >
                            {application.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(application.created_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                        {application.note && (
                          <p className="leading-relaxed">{application.note}</p>
                        )}
                        <p className="font-mono text-xs text-muted-foreground">
                          Post {application.post_id.slice(0, 8)}…
                        </p>
                        {(application.status === "applied" ||
                          application.status === "shortlisted") && (
                          <div>
                            <WithdrawButton applicationId={application.id} />
                          </div>
                        )}
                        {application.status === "accepted" && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Accepted — you joined the team roster. Check{" "}
                            <Link href={"/my-team" as Route} className="text-primary underline">
                              my team
                            </Link>{" "}
                            for details.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
