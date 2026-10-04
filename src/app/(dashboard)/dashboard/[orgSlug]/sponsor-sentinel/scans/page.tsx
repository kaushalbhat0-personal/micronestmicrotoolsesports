import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanHistoryTable } from "@/features/sponsor-sentinel/components/scan-history-table";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { History } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ScanHistoryPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const supabase = await createClient();
  const { scans, total } = await getScanHistory(supabase, ctx.organization.id);

  return (
    <div className="space-y-8">
      <PageHeader title="Check History" description={`Recent checks across your sponsorship campaigns — ${ctx.organization.name}. Each check evaluates all requirements against discovered content.`} />

      {scans.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="No checks have run yet"
          description="Run a check from a campaign to verify its requirements. Checks evaluate every requirement against each piece of eligible content."
          action={
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button>View campaigns</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <SectionHeader title="Recent checks" description={`Showing ${String(scans.length)} of ${String(total)} · Times in Asia/Kolkata`} />
          <Card>
            <CardContent className="pt-6">
              <ScanHistoryTable items={scans} orgSlug={orgSlug} />
              <p className="mt-4 text-xs text-muted-foreground">Checks are read-only. Proof counts are per check (content × requirements).</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
