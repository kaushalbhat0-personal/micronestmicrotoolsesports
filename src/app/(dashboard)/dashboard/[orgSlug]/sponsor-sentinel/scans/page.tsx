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
        title="Check History"
        description={`History of checks for ${ctx.organization.name} — newest first`}
      />

      {scans.length === 0 ? (
        <EmptyState
          title="No checks yet"
          description="No checks have been recorded for this workspace. Checks run automatically for active campaigns with connected creator channels."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent checks</CardTitle>
            <CardDescription>
              Showing {String(scans.length)} of {String(total)} checks. Times shown in Asia/Kolkata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScanHistoryTable items={scans} orgSlug={orgSlug} />
            <p className="mt-4 text-xs text-muted-foreground">
              Checks are read-only. Proof counts are per check. Select a check to view its proof and results.
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel`} className="ml-2 underline">
                Back to sponsorship tracking
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
