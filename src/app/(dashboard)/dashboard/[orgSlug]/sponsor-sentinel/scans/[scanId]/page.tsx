import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getScanDetail } from "@/features/sponsor-sentinel/services/scan-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanStatusBadge } from "@/features/sponsor-sentinel/components/scan-status-badge";
import { AppError } from "@/lib/errors";
import { formatDateTimeKolkata } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  return formatDateTimeKolkata(value);
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; scanId: string }>;
}) {
  const { orgSlug, scanId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const supabase = await createClient();

  let detail;
  try {
    detail = await getScanDetail(supabase, ctx.organization.id, scanId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const { scan, campaignName, evidence, evaluations, evaluationSummary } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check Details"
        description={`Proof and results — ${campaignName ?? "Campaign"} • ${scan.platform}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Check summary <ScanStatusBadge status={scan.status} />
          </CardTitle>
          <CardDescription>
            Campaign {campaignName ?? "Campaign"} • Platform {scan.platform}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Started:</span> {formatDateTime(scan.started_at)}
            </div>
            <div>
              <span className="text-muted-foreground">Completed:</span> {formatDateTime(scan.completed_at)}
            </div>
            <div>
              <span className="text-muted-foreground">Proof:</span> {String(evidence.length)}
            </div>
            <div>
              <span className="text-muted-foreground">Results:</span>{" "}
              {Object.keys(evaluationSummary).length === 0
                ? "—"
                : Object.entries(evaluationSummary)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(" ")}
            </div>
          </div>
          {(scan.error_code || scan.error_message) && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="font-medium text-destructive">We couldn&apos;t complete this check</p>
              <p className="text-xs mt-1 text-muted-foreground">Please try again in a moment. If the problem continues, contact support.</p>
            </div>
          )}
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="inline-flex text-sm underline">
            ← Back to check history
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proof ({String(evidence.length)})</CardTitle>
          <CardDescription>Proof collected for this check. Each check creates its own record.</CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <EmptyState title="No proof yet" description="No proof was found for this check. This may be a failed or pending check." />
          ) : (
            <Table aria-label="Proof for check">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Requirement</TableHead>
                  <TableHead scope="col">Platform</TableHead>
                  <TableHead scope="col">Source</TableHead>
                  <TableHead scope="col">Observed</TableHead>
                  <TableHead scope="col">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs max-w-[10rem] truncate">
                      {detail.deliverableMap.get(ev.deliverable_id)?.name ?? "Requirement"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ev.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{ev.platform}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(ev.observed_at)}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-xs" title={ev.observed_value}>
                      {ev.observed_value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results ({String(evaluations.length)})</CardTitle>
          <CardDescription>Results for this check. Each requirement is marked Confirmed, Not found, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <EmptyState title="No results yet" description="No results were produced for this check." />
          ) : (
            <Table aria-label="Results for check">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Requirement</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Reason</TableHead>
                  <TableHead scope="col">Checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs max-w-[10rem] truncate">{detail.deliverableMap.get(ev.deliverable_id)?.name ?? "Requirement"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={ev.result === "PASS" ? "success" : ev.result === "FAIL" ? "destructive" : ev.result === "PENDING" ? "warning" : "secondary"}
                        aria-label={`Result ${ev.result}`}
                      >
                        {ev.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs" title={ev.reason}>
                      {ev.reason}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDateTime(ev.evaluated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
