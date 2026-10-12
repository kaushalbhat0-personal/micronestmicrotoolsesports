"use client";

import * as React from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type PrintModel } from "../types";
import { copyTextToClipboard, downloadTextFile } from "./browser-actions";

/**
 * Final preview with copy / CSV / print actions. Text and CSV come
 * straight from the domain output service — never rebuilt in React.
 * An unresolved banner mirrors the copy text when blocking work remains.
 */
export function RosterOutput({
  copyText,
  csvText,
  printModel,
  unresolvedCount,
  onReset,
}: {
  copyText: string;
  csvText: string;
  printModel: PrintModel;
  unresolvedCount: number;
  onReset: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);

  async function onCopy() {
    const ok = await copyTextToClipboard(copyText);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) window.setTimeout(() => setCopied(false), 2500);
  }

  function onDownloadCsv() {
    setDownloaded(downloadTextFile("tournament-roster.csv", csvText, "text/csv;charset=utf-8;"));
    window.setTimeout(() => setDownloaded(false), 2500);
  }

  function onPrint() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <>
      <section aria-label="Final roster output" className="space-y-4 print:hidden">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Final roster</CardTitle>
          <CardDescription>
            {unresolvedCount > 0
              ? `${unresolvedCount} blocking ${unresolvedCount === 1 ? "issue" : "issues"} still open — the copy carries a warning banner until you resolve them.`
              : "Clean and copy-ready. Paste it into WhatsApp, Discord, or your sheet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unresolvedCount > 0 ? (
            <p role="alert" className="rounded-[12px] border border-destructive/40 bg-destructive/5 px-3.5 py-2.5 text-sm font-medium text-destructive">
              Unresolved: {unresolvedCount} blocking {unresolvedCount === 1 ? "issue" : "issues"}. Review the panel
              above before sharing.
            </p>
          ) : null}
          <pre
            aria-label="Roster preview"
            className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-[12px] border border-border bg-surface-muted/40 p-4 font-mono text-[13px] leading-relaxed"
          >
            {copyText}
          </pre>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={onCopy} className="min-h-[44px]">
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Roster copied" : "Copy roster"}
            </Button>
            <Button type="button" variant="secondary" onClick={onDownloadCsv} className="min-h-[44px]">
              <Download className="h-4 w-4" aria-hidden />
              {downloaded ? "CSV saved" : "Export CSV"}
            </Button>
            <Button type="button" variant="outline" onClick={onPrint} className="min-h-[44px]">
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </Button>
            <Button type="button" variant="ghost" onClick={onReset} className="min-h-[44px]">
              Start over
            </Button>
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {copyFailed ? "Copy failed in this browser — select the preview text and copy manually." : " "}
          </p>
        </CardContent>
      </Card>
      </section>

      {/* Print-only sheet — same domain model as the copy output. */}
      <div className="hidden print:block">
        <h2 className="text-xl font-semibold">Tournament roster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {printModel.totalTeams} {printModel.totalTeams === 1 ? "team" : "teams"} · {printModel.totalPlayers}{" "}
          {printModel.totalPlayers === 1 ? "player" : "players"}
        </p>
        <div className="mt-4 space-y-4">
          {printModel.teams.map((team) => (
            <div key={team.slot} className="break-inside-avoid">
              <h3 className="text-base font-semibold">
                Team {team.slot} — {team.team}
              </h3>
              <ol className="mt-1 list-decimal pl-6 text-sm">
                {team.players.map((player, index) => (
                  <li key={`${team.slot}-${index}`}>{player}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
