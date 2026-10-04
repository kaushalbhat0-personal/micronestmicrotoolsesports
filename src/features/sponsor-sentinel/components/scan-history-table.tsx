import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanStatusBadge } from "./scan-status-badge";
import type { ScanHistoryItem } from "../services/scan-history";
import { formatDateTimeKolkata } from "@/lib/utils/format";

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatDateTimeKolkata(iso);
  } catch {
    return formatDateTimeKolkata(iso);
  }
}

export function ScanHistoryTable({ items, orgSlug }: { items: readonly ScanHistoryItem[]; orgSlug?: string }) {
  if (items.length === 0) return null;

  const totalProof = items.reduce((a, b) => a + b.evidenceCount, 0);

  return (
    <div className="space-y-3">
      {/* Summary strip — actual available data only */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-muted-foreground">{items.length} checks</span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-muted-foreground">{totalProof} proof items</span>
      </div>

      {/* Desktop table — editorial, fewer columns, hierarchy */}
      <div className="hidden md:block">
        <Table aria-label="Check history">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Campaign</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">Proof</TableHead>
              <TableHead scope="col">Results</TableHead>
              <TableHead scope="col">Checked</TableHead>
              <TableHead scope="col">Check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(({ scan, campaignName, evidenceCount, evaluationSummary }) => (
              <TableRow key={scan.id} className="group">
                <TableCell className="max-w-[14rem]">
                  <span className="block truncate text-sm font-medium" title={campaignName ?? scan.campaign_id}>
                    {campaignName ?? scan.campaign_id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{scan.platform}</span>
                </TableCell>
                <TableCell>
                  <ScanStatusBadge status={scan.status} />
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                    {evidenceCount}
                    <span className="text-xs text-muted-foreground font-normal">proof</span>
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {Object.keys(evaluationSummary).length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {Object.entries(evaluationSummary).map(([result, count]) => {
                        const label = result === "PASS" ? "Confirmed" : result === "FAIL" ? "Not found" : result === "NOT_VERIFIABLE" ? "Review" : result === "PENDING" ? "Checking" : result === "NOT_SUPPORTED" ? "N/A" : result;
                        const variant = result === "PASS" ? "success" : result === "FAIL" ? "destructive" : result === "NOT_VERIFIABLE" ? "warning" : "secondary";
                        return (
                          <Badge key={result} variant={variant as never} className="text-[10px]">
                            {label}:{count}
                          </Badge>
                        );
                      })}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatRelative(scan.started_at)}</TableCell>
                <TableCell className="text-xs">
                  {orgSlug ? (
                    <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${scan.id}` as Route} className="font-medium text-primary hover:underline" aria-label={`View check for ${campaignName ?? "campaign"}`}>
                      View →
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards — no horizontal scroll */}
      <div className="grid gap-3 md:hidden">
        {items.map(({ scan, campaignName, evidenceCount, evaluationSummary }) => (
          <div key={scan.id} className="rounded-[16px] border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{campaignName ?? scan.campaign_id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground capitalize">{scan.platform} · {formatRelative(scan.started_at)}</p>
              </div>
              <ScanStatusBadge status={scan.status} />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">{evidenceCount} proof</span>
              {Object.keys(evaluationSummary).length > 0 && (
                <span className="flex gap-1">
                  {Object.entries(evaluationSummary).map(([k, v]) => {
                    const label = k === "PASS" ? "Confirmed" : k === "FAIL" ? "Not found" : k === "NOT_VERIFIABLE" ? "Review" : k === "NOT_SUPPORTED" ? "N/A" : k === "PENDING" ? "Checking" : k;
                    return (
                      <Badge key={k} variant="secondary" className="text-[10px]">{label}:{v}</Badge>
                    );
                  })}
                </span>
              )}
            </div>
            {orgSlug && (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${scan.id}` as Route} className="inline-flex text-xs font-medium text-primary hover:underline">
                View check →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
