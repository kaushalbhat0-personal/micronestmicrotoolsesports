"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { History, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TieBreakerCompetitionRow } from "@/server/repositories/tie-breaker-competitions";
import { CompetitionStatusBadge } from "./competition-status-badge";

type StatusFilter = "all" | "draft" | "active" | "locked";

/** History with presentation-only search/filter. Ranking and records stay server-side. */
export function CompetitionList({
  orgSlug,
  competitions,
  total,
}: {
  orgSlug: string;
  competitions: readonly TieBreakerCompetitionRow[];
  total: number;
}) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const filtered = competitions.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return c.name.toLowerCase().includes(term) || (c.record_number ?? "").toLowerCase().includes(term);
  });

  if (competitions.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" aria-hidden />}
        title="Your official standings start here"
        description="Create your first competition to set rules, add teams, and resolve tied standings."
        action={
          <Link
            href={`/dashboard/${orgSlug}/tie-breaker/new` as Route}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus className="h-4 w-4" aria-hidden /> New competition
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="tie-breaker-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="tie-breaker-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or record number"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tie-breaker-status">Status</Label>
          <div className="flex gap-2" role="group" aria-label="Filter by status">
            {(["all", "draft", "active", "locked"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={status === s ? "default" : "outline"}
                size="sm"
                className="min-h-[44px] capitalize"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
              >
                {s === "all" ? "All" : s}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No competitions match your search"
          description="Try a different name or record number, or clear the status filter."
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {filtered.length} of {total}
          </p>
          <div className="hidden md:block">
            <Table aria-label="Competition history">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Competition</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Record no.</TableHead>
                  <TableHead scope="col">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[18rem]">
                      <Link
                        href={`/dashboard/${orgSlug}/tie-breaker/${c.id}` as Route}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CompetitionStatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.record_number ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="grid gap-3 md:hidden" aria-label="Competition history">
            {filtered.map((c) => (
              <li key={c.id} className="rounded-[16px] border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <CompetitionStatusBadge status={c.status} />
                  {c.record_number && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {c.record_number}
                    </Badge>
                  )}
                </div>
                <Link
                  href={`/dashboard/${orgSlug}/tie-breaker/${c.id}` as Route}
                  className="mt-2 block break-words font-medium hover:underline"
                >
                  {c.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Updated {new Date(c.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
