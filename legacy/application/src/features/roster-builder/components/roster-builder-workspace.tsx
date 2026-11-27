"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DEFAULT_TEAM_CAPACITY,
  DELIMITER_LABELS,
  type Delimiter,
  type ParsedRow,
} from "../types";
import { teamCapacitySchema } from "../schemas";
import { parseRosterText } from "../services/parser";
import { RosterInput, SAMPLE_ROSTER_INPUT, type DelimiterMode } from "./roster-input";
import { RosterSession } from "./roster-session";

/**
 * Roster Builder workspace — ephemeral client state only.
 *
 * Holds raw pasted text, delimiter mode, and team capacity. Parsing and
 * conflict detection are memoized derivations; the editable team session
 * below remounts whenever the source text or delimiter changes (fresh
 * working model) but survives capacity changes (re-evaluated issues only).
 * Nothing is stored, sent, or logged — state dies with the page.
 */
export function RosterBuilderWorkspace() {
  const [rawInput, setRawInput] = React.useState("");
  const [delimiterMode, setDelimiterMode] = React.useState<DelimiterMode>("auto");
  const [capacityText, setCapacityText] = React.useState(String(DEFAULT_TEAM_CAPACITY));

  const capacityParsed = teamCapacitySchema.safeParse(Number(capacityText));
  const teamCapacity = capacityParsed.success ? capacityParsed.data : DEFAULT_TEAM_CAPACITY;
  const capacityError =
    capacityText.trim() === "" || !capacityParsed.success ? "Enter a whole team size between 1 and 30." : null;

  const parseResult = React.useMemo(() => {
    if (rawInput.trim() === "") return null;
    const delimiter: Delimiter | undefined = delimiterMode === "auto" ? undefined : delimiterMode;
    return parseRosterText(rawInput, delimiter === undefined ? undefined : { delimiter });
  }, [rawInput, delimiterMode]);

  const sessionKey = React.useMemo(
    () => `${delimiterMode}\n${rawInput}`,
    [delimiterMode, rawInput],
  );

  function loadSample() {
    setRawInput(SAMPLE_ROSTER_INPUT);
  }

  function clearAll() {
    setRawInput("");
  }

  function resetAll() {
    setRawInput("");
    setDelimiterMode("auto");
    setCapacityText(String(DEFAULT_TEAM_CAPACITY));
  }

  const empty = parseResult === null;
  const failed = parseResult !== null && !parseResult.ok;
  const rows: ReadonlyArray<ParsedRow> = parseResult !== null && parseResult.ok ? parseResult.rows : [];
  const detectedLabel = parseResult !== null && parseResult.ok ? DELIMITER_LABELS[parseResult.delimiter] : null;

  return (
    <div className="space-y-6">
      <RosterInput
        value={rawInput}
        onChange={setRawInput}
        onLoadSample={loadSample}
        onClear={clearAll}
        delimiterMode={delimiterMode}
        onDelimiterModeChange={setDelimiterMode}
        detectedLabel={detectedLabel}
        capacityText={capacityText}
        onCapacityTextChange={setCapacityText}
        capacityError={capacityError}
      />

      {empty ? (
        <EmptyState
          icon={<ClipboardList aria-hidden />}
          title="Paste to build your slot list"
          description="Your cleaned teams, conflicts, slot numbers, and copy-ready roster appear here. Try the sample to see the full flow in seconds."
          action={
            <Button type="button" onClick={loadSample} className="min-h-[44px]">
              Load sample registrations
            </Button>
          }
        />
      ) : null}

      {failed ? (
        <Card className="border-destructive/40" role="alert">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm font-medium text-destructive">{parseResult.error.message}</p>
            <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={clearAll}>
              Clear and start over
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {parseResult !== null && parseResult.ok ? (
        <RosterSession
          key={sessionKey}
          rows={rows}
          teamCapacity={teamCapacity}
          delimiter={parseResult.delimiter}
          delimiterDetected={parseResult.delimiterDetected}
          onReset={resetAll}
        />
      ) : null}
    </div>
  );
}
