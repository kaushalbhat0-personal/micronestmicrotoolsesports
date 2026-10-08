import Link from "next/link";
import type { Route } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import { getUserOrganizations } from "@/lib/auth/require-membership";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getPrimaryOrganizationForUser } from "@/server/services/primary-workspace-service";
import { PrimaryWorkspaceButton } from "./primary-workspace-button";

export default async function OrganizationsPage() {
  const memberships = await getUserOrganizations();
  const user = await getCurrentUser();
  let primaryOrgId: string | null = null;
  if (user) {
    try {
      const supabase = await createClient();
      primaryOrgId = (await getPrimaryOrganizationForUser(supabase, user.id))?.id ?? null;
    } catch {
      primaryOrgId = null;
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Workspaces"
        description="All workspaces you belong to. Select one to enter its dashboard."
        action={
          <Link href="/dashboard/organizations/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Create workspace
          </Link>
        }
      />

      {memberships.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No workspaces"
          description="Create your first workspace to get started. You can belong to many workspaces from one account."
          action={
            <Link href="/dashboard/organizations/new" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Create workspace
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => {
            const raw = m.organization as unknown as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
            const org = Array.isArray(raw) ? raw[0] : raw;
            if (!org) return null;
            const isPrimary = primaryOrgId === org.id;
            return (
              <Card key={org.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {org.name}
                    <Badge variant="secondary">{m.role}</Badge>
                  </CardTitle>
                  <CardDescription>/{org.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/${org.slug}` as Route} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                      Open dashboard
                    </Link>
                    <PrimaryWorkspaceButton orgId={org.id} orgName={org.name} isPrimary={isPrimary} />
                  </div>
                  {isPrimary ? (
                    <p className="mt-2 text-xs text-muted-foreground">Your preferred operational workspace. It grants no extra access.</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
