import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import type { Route } from "next";

export default async function CampaignsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  const campaigns = await listCampaigns(supabase, ctx.organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description={`Sponsor campaigns for ${ctx.organization.name}`}
        action={
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
            <Button size="sm" aria-label="Create campaign">
              Create campaign
            </Button>
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns</CardTitle>
            <CardDescription>Create your first sponsor campaign to start tracking requirements.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
              <Button aria-label="Create first campaign">Create campaign</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className={c.status === "active" ? "border-l-2 border-l-emerald-500" : undefined}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <StatusBadge status={c.status} />
                </CardTitle>
                <CardDescription className="line-clamp-2">{c.description ?? "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {new Date(c.starts_at).toLocaleDateString()} → {new Date(c.ends_at).toLocaleDateString()}
                </p>
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route}>
                  <Button variant="outline" size="sm" aria-label={`View campaign ${c.name}`}>
                    View
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
