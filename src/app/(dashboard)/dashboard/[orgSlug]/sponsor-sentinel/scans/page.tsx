import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanHistoryTable } from "@/features/sponsor-sentinel/components/scan-history-table";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ScanHistoryPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const supabase = await createClient();
  const { scans, total } = await getScanHistory(supabase, ctx.organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan History"
        description={`Read-only history of Sponsor Sentinel scans for ${ctx.organization.name} — newest first`}
      />

      {scans.length === 0 ? (
        <EmptyState
          title="No scans yet"
          description="No Sponsor Sentinel scans have been recorded for this organization. Scans run automatically via the scheduled Cron job for active campaigns with connected channels."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent scans</CardTitle>
            <CardDescription>
              Showing {String(scans.length)} of {String(total)} scans (limit 50, newest first). Times shown in Asia/Kolkata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScanHistoryTable items={scans} orgSlug={orgSlug} />
            <p className="mt-4 text-xs text-muted-foreground">
              Scan data is organization-scoped and read-only. Evidence counts are aggregated per campaign. Click a scan ID for per-scan evidence and evaluations.
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel`} className="ml-2 underline">
                Back to Sponsor Sentinel
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
