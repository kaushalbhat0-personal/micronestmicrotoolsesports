import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";
import type { DraftMatch } from "@/types/database";
import { MatchRowActions } from "./match-row-actions";

function statusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "abandoned") return "Abandoned";
  return "In progress";
}

export function MatchHistoryList({
  orgSlug,
  matches,
  total,
  completedTotal,
  accessLevel = "paid",
}: {
  orgSlug: string;
  matches: readonly DraftMatch[];
  total: number;
  /** Total matching completed records before the Free window slice (honest "latest 5 of N"). */
  completedTotal?: number | undefined;
  /** Free workspaces see the latest 5 completed records; paid sees everything. */
  accessLevel?: "paid" | "free" | undefined;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-5 w-5" aria-hidden />}
        title="Start your first draft"
        description="Choose a draft setup, enter the two teams and map pool, then run the sequence and finish the record."
      />
    );
  }

  const visibleCompleted = matches.filter((m) => m.status === "completed").length;
  const freeWindow = accessLevel === "free" && typeof completedTotal === "number" && completedTotal > visibleCompleted;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {accessLevel === "free"
          ? "Showing the 5 most recent completed matches"
          : `Showing ${matches.length} of ${total}`}
      </p>
      {freeWindow ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Latest {visibleCompleted} of {completedTotal} completed matches
        </p>
      ) : null}
      <div className="hidden md:block">
        <Table aria-label="Draft history">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Record no.</TableHead>
              <TableHead scope="col">Match</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Created</TableHead>
              <TableHead scope="col">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.ref_code}</TableCell>
                <TableCell className="max-w-[16rem]">
                  <Link href={`/dashboard/${orgSlug}/draft-ban/${m.id}` as Route} className="block truncate text-sm font-medium hover:underline">
                    {m.match_name ?? `${m.team_a} vs ${m.team_b}`}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {m.team_a} vs {m.team_b}
                    {m.event_name ? ` · ${m.event_name}` : ""}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "completed" ? "success" : m.status === "abandoned" ? "secondary" : "warning"}>
                    {statusLabel(m.status)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground" title={new Date(m.created_at).toLocaleString("en-GB")}>{new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</TableCell>
                <TableCell>
                  <MatchRowActions orgSlug={orgSlug} matchId={m.id} status={m.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="grid gap-3 md:hidden" aria-label="Draft history">
        {matches.map((m) => (
          <li key={m.id} className="rounded-[16px] border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{m.ref_code}</span>
              <Badge variant={m.status === "completed" ? "success" : m.status === "abandoned" ? "secondary" : "warning"}>{statusLabel(m.status)}</Badge>
            </div>
            <Link href={`/dashboard/${orgSlug}/draft-ban/${m.id}` as Route} className="mt-1 block truncate font-medium hover:underline">
              {m.match_name ?? `${m.team_a} vs ${m.team_b}`}
            </Link>
            <p className="text-xs text-muted-foreground">
              {m.team_a} vs {m.team_b} · {new Date(m.created_at).toLocaleDateString("en-GB")}
            </p>
            <div className="mt-3">
              <MatchRowActions orgSlug={orgSlug} matchId={m.id} status={m.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
