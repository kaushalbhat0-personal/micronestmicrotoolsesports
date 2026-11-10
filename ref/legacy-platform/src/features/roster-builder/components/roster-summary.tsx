"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DELIMITER_LABELS, type Delimiter, type ParseStats } from "../types";
import { type IssueSummary } from "../services/conflicts";

/**
 * Compact result strip: what was found and whether it is clean.
 * Icon + text (never color-only); the counts line is a live region so
 * screen readers hear reparse results.
 */
export function RosterSummary({
  stats,
  delimiter,
  delimiterDetected,
  summary,
}: {
  stats: ParseStats;
  delimiter: Delimiter;
  delimiterDetected: boolean;
  summary: IssueSummary;
}) {
  const clean = summary.blocking === 0;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
          <p aria-live="polite">
            <strong className="font-semibold">{stats.teams} {stats.teams === 1 ? "team" : "teams"}</strong>
            <span className="text-muted-foreground"> · </span>
            <strong className="font-semibold">{stats.players} {stats.players === 1 ? "player" : "players"}</strong>
            <span className="text-muted-foreground">
              {" "}· {delimiterDetected ? "Detected" : "Using"} {DELIMITER_LABELS[delimiter].toLowerCase()}-separated
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clean ? (
            <Badge variant="success">
              <CircleCheck className="h-3 w-3" aria-hidden />
              <span>Roster clean</span>
            </Badge>
          ) : (
            <Badge variant="destructive">
              <CircleAlert className="h-3 w-3" aria-hidden />
              <span>
                {summary.blocking} must fix{summary.blocking === 1 ? "" : "es"}
              </span>
            </Badge>
          )}
          {summary.review > 0 ? (
            <Badge variant="warning">
              <span>
                {summary.review} to review
              </span>
            </Badge>
          ) : null}
          {summary.info > 0 ? (
            <Badge variant="secondary">
              <span>
                {summary.info} note{summary.info === 1 ? "" : "s"}
              </span>
            </Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
