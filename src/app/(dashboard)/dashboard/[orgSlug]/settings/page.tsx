import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { Settings2, Tv, Plug } from "lucide-react";

export default async function SettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description={`Workspace settings for ${ctx.organization.name}.`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tv className="h-4 w-4 text-muted-foreground" /> Creator Channels
            </CardTitle>
            <CardDescription>Which creator channels are you tracking?</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/${orgSlug}/channels` as Route}>
              <Button variant="outline" size="sm">Manage channels</Button>
            </Link>
          </CardContent>
        </Card>
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4 text-muted-foreground" /> Connections
            </CardTitle>
            <CardDescription>Which platforms are connected via OAuth?</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/${orgSlug}/connections` as Route}>
              <Button variant="outline" size="sm">Manage connections</Button>
            </Link>
          </CardContent>
        </Card>
        <Card variant="muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-muted-foreground" /> Workspace
            </CardTitle>
            <CardDescription>Workspace {ctx.organization.name} · {ctx.organization.slug}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">More settings coming in later phases.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
