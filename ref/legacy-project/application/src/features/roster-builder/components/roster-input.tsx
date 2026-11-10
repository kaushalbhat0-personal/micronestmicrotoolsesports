"use client";

import * as React from "react";
import { ClipboardList, Eraser, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DEFAULT_TEAM_CAPACITY, MAX_TEAM_CAPACITY, MIN_TEAM_CAPACITY, type Delimiter } from "../types";
import { cn } from "@/lib/utils/cn";

export type DelimiterMode = "auto" | Delimiter;

export const DELIMITER_MODE_LABELS: Record<DelimiterMode, string> = {
  auto: "Auto",
  "\t": "Tab",
  ",": "Comma",
  ";": "Semicolon",
  "|": "Pipe",
};

/**
 * Safe sample registrations: fictional teams/players only, no contact data.
 * Demonstrates a spacing-variant duplicate (review) and a cross-team
 * player (blocking) through the same parser flow as pasted input.
 */
export const SAMPLE_ROSTER_INPUT = [
  "Team,Player",
  "Alpha Esports,Rahul Patil",
  "Alpha Esports,Karan Shah",
  "Alpha Esports,rahul  patil",
  "Bravo Gaming,Vikram Rao",
  "Bravo Gaming,Rahul Patil",
  "Bravo Gaming,Meera Nair",
  "Charlie Squad,Jose D'Souza",
  "Charlie Squad,Viper-OP",
].join("\n");

const PLACEHOLDER = [
  "Team,Player",
  "Alpha Esports,Player One",
  "Alpha Esports,Player Two",
  "Bravo Gaming,Player Six",
  "Bravo Gaming,Player Seven",
].join("\n");

export function RosterInput({
  value,
  onChange,
  onLoadSample,
  onClear,
  delimiterMode,
  onDelimiterModeChange,
  detectedLabel,
  capacityText,
  onCapacityTextChange,
  capacityError,
}: {
  value: string;
  onChange: (value: string) => void;
  onLoadSample: () => void;
  onClear: () => void;
  delimiterMode: DelimiterMode;
  onDelimiterModeChange: (mode: DelimiterMode) => void;
  /** Human delimiter name from the latest parse, or null before parsing. */
  detectedLabel: string | null;
  capacityText: string;
  onCapacityTextChange: (value: string) => void;
  capacityError: string | null;
}) {
  const hasInput = value.trim() !== "";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
          Paste registrations
        </CardTitle>
        <CardDescription>
          Copy rows from Sheets, Forms, WhatsApp, or Discord — tab, comma, semicolon, or pipe separated. Team first,
          player second. Nothing leaves your browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="roster-paste">Registrations</Label>
          <textarea
            id="roster-paste"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={PLACEHOLDER}
            rows={9}
            spellCheck={false}
            aria-describedby="roster-paste-hint"
            className={cn(
              "mt-2 min-h-[180px] w-full rounded-[12px] border border-input bg-card px-3.5 py-2.5 font-mono text-[13px] leading-relaxed",
              "placeholder:text-foreground-faint hover:border-border-strong",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            )}
          />
          <p id="roster-paste-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Supported: tab · comma · semicolon · pipe. Blank lines and repeated header rows are ignored. First
            column is the team, second is the player — or include a header row and columns map automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" size="sm" className="min-h-[44px]" onClick={onLoadSample}>
            <FileText className="h-4 w-4" aria-hidden />
            Load sample
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px]"
            onClick={onClear}
            disabled={!hasInput}
          >
            <Eraser className="h-4 w-4" aria-hidden />
            Clear
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="roster-delimiter">Delimiter</Label>
            <Select value={delimiterMode} onValueChange={(next) => onDelimiterModeChange(next as DelimiterMode)}>
              <SelectTrigger id="roster-delimiter" className="mt-2" aria-label="Delimiter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DELIMITER_MODE_LABELS) as DelimiterMode[]).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode === "auto" ? "Auto-detect" : DELIMITER_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {detectedLabel ? `Detected: ${detectedLabel}` : "Auto-detect picks tab, comma, semicolon, or pipe."}
            </p>
          </div>
          <div>
            <Label htmlFor="roster-capacity">Players per team</Label>
            <Input
              id="roster-capacity"
              type="number"
              inputMode="numeric"
              min={MIN_TEAM_CAPACITY}
              max={MAX_TEAM_CAPACITY}
              value={capacityText}
              onChange={(event) => onCapacityTextChange(event.target.value)}
              aria-describedby={capacityError ? "roster-capacity-error" : undefined}
              aria-invalid={capacityError !== null}
              className="mt-2"
            />
            {capacityError ? (
              <p id="roster-capacity-error" role="alert" className="mt-2 text-xs text-destructive">
                {capacityError} Using {DEFAULT_TEAM_CAPACITY} instead.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Teams above this size are flagged, never trimmed.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
