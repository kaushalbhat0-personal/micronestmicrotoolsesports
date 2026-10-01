import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScanStatusBadge } from "./scan-status-badge";
import type { ScanHistoryItem } from "../services/scan-history";
import { formatDate } from "@/lib/utils/format";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  // Use Asia/Kolkata as Sponsor Sentinel previously does, but keep as display with timezone context
  try {
    const d = new Date(value);
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return formatDate(value);
  }
}

function shortId(id: string) {
  return id.slice(0, 8);
}

export function ScanHistoryTable({ items, orgSlug }: { items: readonly ScanHistoryItem[]; orgSlug?: string }) {
  if (items.length === 0) return null;

  return (
    <Table aria-label="Check history">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Check</TableHead>
          <TableHead scope="col">Campaign</TableHead>
          <TableHead scope="col">Platform</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Started</TableHead>
          <TableHead scope="col">Completed</TableHead>
          <TableHead scope="col" className="text-right">Proof</TableHead>
          <TableHead scope="col">Result</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(({ scan, campaignName, evidenceCount, evaluationSummary }) => (
          <TableRow key={scan.id}>
            <TableCell className="text-xs">
              {orgSlug ? (
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${scan.id}` as Route} className="underline" aria-label={`View check for ${campaignName ?? "campaign"}`}>
                  View check
                </Link>
              ) : (
                "Check"
              )}
            </TableCell>
            <TableCell className="max-w-[14rem] truncate" title={campaignName ?? scan.campaign_id}>
              {campaignName ?? shortId(scan.campaign_id)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{scan.platform}</Badge>
            </TableCell>
            <TableCell>
              <ScanStatusBadge status={scan.status} />
            </TableCell>
            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(scan.started_at)}</TableCell>
            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(scan.completed_at)}</TableCell>
            <TableCell className="text-right font-medium">{evidenceCount}</TableCell>
            <TableCell className="text-xs">
              {Object.keys(evaluationSummary).length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {Object.entries(evaluationSummary).map(([result, count]) => {
                    const label = result === "PASS" ? "Confirmed" : result === "FAIL" ? "Not found" : result === "NOT_VERIFIABLE" ? "Needs review" : result === "PENDING" ? "Checking" : result === "NOT_SUPPORTED" ? "Not applicable" : result;
                    return (
                      <Badge key={result} variant="secondary" className="text-[10px]">
                        {label}:{count}
                      </Badge>
                    );
                  })}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
