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
import { parseToolIntent, toolDisplayName, toolWorkspaceRoute } from "@/lib/workspace/tool-intent";
import { PrimaryWorkspaceButton } from "./primary-workspace-button";

export default async function OrganizationsPage({ searchParams }: { searchParams?: Promise<{ tool?: string }> }) {
  const memberships = await getUserOrganizations();
  const user = await getCurrentUser();
  // Tool-intent preservation (RCCF F6): ?tool= is re-validated server-side
  // against the registry allowlist — never trusted raw, never an open redirect.
  const sp = searchParams ? await searchParams : undefined;
  const toolSlug = parseToolIntent(sp?.tool);
  const toolName = toolSlug ? toolDisplayName(toolSlug) : null;
  const createHref = toolSlug ? `/dashboard/organizations/new?tool=${toolSlug}` : "/dashboard/organizations/new";
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
          <Link href={createHref as Route} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Create workspace
          </Link>
        }
      />

      {toolName ? (
        <p className="rounded-[12px] border border-primary/20 bg-primary/5 p-4 text-sm" role="status" aria-live="polite">
          Choose a workspace to open {toolName}.
        </p>
      ) : null}

      {memberships.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No workspaces"
          description="Create your first workspace to get started. You can belong to many workspaces from one account."
          action={
            <Link href={createHref as Route} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
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
            // Validated tool intent deep-links straight into the tool;
            // otherwise the workspace overview opens as before.
            const openHref = toolSlug ? toolWorkspaceRoute(org.slug, toolSlug) : `/dashboard/${org.slug}`;
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
                    <Link href={openHref as Route} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                      {toolName ? `Open ${toolName}` : "Open dashboard"}
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
