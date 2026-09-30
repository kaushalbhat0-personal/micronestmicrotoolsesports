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

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortId(id: string) {
  return id.slice(0, 8);
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
        title={`Scan ${shortId(scan.id)}`}
        description={`Per-scan evidence and evaluations — ${campaignName ?? scan.campaign_id} • ${scan.platform}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Scan summary <ScanStatusBadge status={scan.status} />
          </CardTitle>
          <CardDescription>
            Campaign {campaignName ?? shortId(scan.campaign_id)} • Platform {scan.platform} • Scanner {scan.scanner_version}
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
              <span className="text-muted-foreground">Evidence:</span> {String(evidence.length)}
            </div>
            <div>
              <span className="text-muted-foreground">Evaluations:</span>{" "}
              {Object.keys(evaluationSummary).length === 0
                ? "—"
                : Object.entries(evaluationSummary)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(" ")}
            </div>
          </div>
          {(scan.error_code || scan.error_message) && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="font-medium text-destructive">Error</p>
              {scan.error_code && <p className="text-xs text-muted-foreground">Code: {scan.error_code}</p>}
              {scan.error_message && <p className="text-xs mt-1">{scan.error_message}</p>}
            </div>
          )}
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="inline-flex text-sm underline">
            ← Back to scan history
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence ({String(evidence.length)})</CardTitle>
          <CardDescription>Evidence generated for this exact scan only — immutable per-scan attribution via scan_id.</CardDescription>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <EmptyState title="No evidence" description="No evidence was generated for this scan. This may be a failed or pending scan." />
          ) : (
            <Table aria-label="Evidence for scan">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Evidence</TableHead>
                  <TableHead scope="col">Deliverable</TableHead>
                  <TableHead scope="col">Platform</TableHead>
                  <TableHead scope="col">Source</TableHead>
                  <TableHead scope="col">Observed</TableHead>
                  <TableHead scope="col">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-mono text-xs" title={ev.id}>
                      {shortId(ev.id)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[10rem] truncate" title={ev.deliverable_id}>
                      {detail.deliverableMap.get(ev.deliverable_id)?.name ?? shortId(ev.deliverable_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ev.platform}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {ev.source} <span className="text-muted-foreground">({ev.source_id.slice(0, 8)})</span>
                    </TableCell>
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
          <CardTitle className="text-base">Evaluations ({String(evaluations.length)})</CardTitle>
          <CardDescription>Deterministic five-state results for this scan only.</CardDescription>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <EmptyState title="No evaluations" description="No evaluations were produced for this scan." />
          ) : (
            <Table aria-label="Evaluations for scan">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Evaluation</TableHead>
                  <TableHead scope="col">Deliverable</TableHead>
                  <TableHead scope="col">State</TableHead>
                  <TableHead scope="col">Reason</TableHead>
                  <TableHead scope="col">Evaluated</TableHead>
                  <TableHead scope="col">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-mono text-xs" title={ev.id}>
                      {shortId(ev.id)}
                    </TableCell>
                    <TableCell className="text-xs max-w-[10rem] truncate">{detail.deliverableMap.get(ev.deliverable_id)?.name ?? shortId(ev.deliverable_id)}</TableCell>
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
                    <TableCell className="font-mono text-xs" title={ev.evidence_id}>
                      {shortId(ev.evidence_id)}
                    </TableCell>
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
