"use client";

import * as React from "react";
import { CircleAlert, Eye, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type IssueSeverity, type RosterIssue } from "../types";
import { cn } from "@/lib/utils/cn";

const GROUP_META: Record<IssueSeverity, { heading: string; description: string; badgeVariant: "destructive" | "warning" | "secondary"; Icon: typeof Info }> = {
  blocking: {
    heading: "Needs decision",
    description: "Fix these before sharing — the roster is not final while they stand. Nothing was merged or deleted.",
    badgeVariant: "destructive",
    Icon: CircleAlert,
  },
  review: {
    heading: "Review",
    description: "Possible duplicates or odd rows. They stay in the roster until you edit the source text — nothing merges automatically.",
    badgeVariant: "warning",
    Icon: Eye,
  },
  info: {
    heading: "Notes",
    description: "FYI only. These never block the final list.",
    badgeVariant: "secondary",
    Icon: Info,
  },
};

/**
 * Issue panel grouped blocking → review → info. Messages are plain
 * organizer language; internal issue codes are never rendered.
 */
export function RosterIssues({ issues }: { issues: ReadonlyArray<RosterIssue> }) {
  const groups: ReadonlyArray<IssueSeverity> = ["blocking", "review", "info"];
  const visible = groups
    .map((severity) => ({ severity, items: issues.filter((issue) => issue.severity === severity) }))
    .filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;
  return (
    <section aria-label="Roster issues" className="space-y-4">
      {visible.map((group) => {
        const meta = GROUP_META[group.severity];
        const Icon = meta.Icon;
        return (
          <Card key={group.severity} className={cn(group.severity === "blocking" && "border-destructive/40")}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                <Icon className="h-4 w-4" aria-hidden />
                {meta.heading}
                <Badge variant={meta.badgeVariant}>
                  <span>{group.items.length}</span>
                </Badge>
              </CardTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">{meta.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {group.items.map((issue, index) => (
                  <li
                    key={`${issue.code}-${issue.lineNumbers.join("-")}-${index}`}
                    className="rounded-[12px] border border-border bg-surface-muted/40 px-3.5 py-2.5"
                  >
                    <p className="text-sm leading-relaxed">{issue.message}</p>
                    {issue.lineNumbers.length > 1 ? (
                      <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                        Lines {issue.lineNumbers.join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
