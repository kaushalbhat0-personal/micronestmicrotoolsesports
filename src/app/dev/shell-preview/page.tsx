import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const mockOrgs = [
  { id: "1", name: "Acme Esports", slug: "acme-esports" },
  { id: "2", name: "Neon Vipers", slug: "neon-vipers" },
];

export default function ShellPreview() {
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-6">
        <PageHeader title="Overview" description="Workspace shell preview — Acme Esports · Warm premium, grouped nav, breadcrumbs, mobile drawer." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Workspace grouping</CardTitle>
              <CardDescription>WORKSPACE: Overview, Campaigns, Checks</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">CREATORS: Channels, Connections — distinct mental models. Active state terracotta 8% warm.</p>
            </CardContent>
          </Card>
          <Card variant="muted">
            <CardHeader>
              <CardTitle>Header + Breadcrumbs</CardTitle>
              <CardDescription>Desktop breadcrumb, mobile drawer trigger, workspace switcher prominence.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Resize to 390px to see mobile drawer. Check Checks distinct from Channels.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
