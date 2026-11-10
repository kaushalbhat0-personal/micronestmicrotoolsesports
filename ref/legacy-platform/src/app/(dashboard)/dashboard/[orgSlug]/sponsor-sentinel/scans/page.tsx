import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { resolveSponsorshipLimits } from "@/server/services/sponsorship-limits";
import { FreeUsageMeter } from "@/features/sponsor-sentinel/components/free-usage-meter";
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
  try {
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }

  const supabase = await createClient();
  const callerLimits = await resolveSponsorshipLimits(supabase, { userId: ctx.user.id, organizationId: ctx.organization.id }).catch(() => null);
  const historyWindowDays = callerLimits?.level === "free" ? callerLimits.historyWindowDays : null;
  const { scans, total } = await getScanHistory(supabase, ctx.organization.id, { historyWindowDays });

  return (
    <div className="space-y-8">
      <PageHeader title="Check History" description={`Recent checks across your sponsorship campaigns — ${ctx.organization.name}. Each check evaluates all requirements against discovered content.`} />
      <FreeUsageMeter userId={ctx.user.id} organizationId={ctx.organization.id} orgSlug={orgSlug} />
      {callerLimits?.level === "free" ? (
        <p className="text-xs text-muted-foreground">Free shows the last 7 days. Upgrade to see full proof history.</p>
      ) : null}

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
              <p className="mt-4 text-xs text-muted-foreground">Checks are read-only. Each check shows proof grouped by content.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
