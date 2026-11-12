"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { BarChart3, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ALL,
  ZONE_PATTERN_DATASETS,
  datasetId,
  dayPatterns,
  finishesSummary,
  formatAverage,
  getDataset,
  mapPatterns,
  placementDistribution,
  pointsSummary,
  rate,
  selectMatches,
  teamPatterns,
} from "../data/zone-patterns";

const SELECT =
  "min-h-[44px] w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Bars({ values, format }: { values: readonly { label: string; value: number; note: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  return (
    <div className="space-y-2" role="img" aria-label={values.map((v) => `${v.label}: ${format(v.value)} (${v.note})`).join(". ")}>
      {values.map((v) => (
        <div key={v.label} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-xs" aria-hidden="true">
          <span className="font-mono font-bold uppercase tracking-wider text-muted-foreground">{v.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (v.value / max) * 100)}%` }} />
          </span>
          <span className="font-mono tabular-nums text-foreground">{format(v.value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Zone Pattern Explorer — observational data explorer over published results.
 *
 * Filters scope a pinned static dataset (3 completed stages, 54 matches);
 * every number derives deterministically from match results via
 * data/zone-patterns.ts. No predictions, no causal claims, no zone telemetry
 * (the source has none — the UI says so). Ephemeral UI state only: no
 * account, no persistence, no analytics. Lives inside AdSafeGameLayout;
 * renders no ads and nothing resembling one.
 */
export function ZonePatternExplorerShell() {
  const [dataset, setDataset] = React.useState(() => datasetId(ZONE_PATTERN_DATASETS[0]!));
  const [map, setMap] = React.useState<string>(ALL);
  const [day, setDay] = React.useState<string>(ALL);
  const [team, setTeam] = React.useState<string>(ALL);

  const detail = getDataset(dataset) ?? ZONE_PATTERN_DATASETS[0]!;
  const matches = React.useMemo(() => selectMatches(detail, map, day), [detail, map, day]);
  const placement = placementDistribution(matches);
  const finishes = finishesSummary(matches);
  const points = pointsSummary(matches);
  const teams = React.useMemo(() => teamPatterns(matches), [matches]);
  const days = React.useMemo(() => dayPatterns(matches), [matches]);
  const maps = React.useMemo(() => mapPatterns(matches), [matches]);
  const spotlight = team === ALL ? null : teams.find((t) => t.teamName === team) ?? null;

  const mapsInDataset = React.useMemo(() => [...new Set(detail.matches.map((m) => m.map))], [detail]);
  const daysInDataset = React.useMemo(
    () => [...new Set(detail.matches.map((m) => m.day))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [detail]
  );
  const teamsInDataset = React.useMemo(() => detail.teams.map((t) => t.displayName), [detail]);

  function reset() {
    setMap(ALL);
    setDay(ALL);
    setTeam(ALL);
  }

  function pickDataset(id: string) {
    setDataset(id);
    reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-4 w-4 text-primary" aria-hidden /> Explore the record
        </CardTitle>
        <CardDescription className="leading-relaxed">
          Filter completed tournament matches and read what the published results show. Observed in this sample — never a prediction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="zpe-dataset" className="text-xs font-medium">Dataset</label>
            <select id="zpe-dataset" value={dataset} onChange={(e) => pickDataset(e.target.value)} className={SELECT}>
              {ZONE_PATTERN_DATASETS.map((d) => (
                <option key={datasetId(d)} value={datasetId(d)}>
                  {d.tournamentName} · {d.stageName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="zpe-map" className="text-xs font-medium">Map</label>
            <select id="zpe-map" value={map} onChange={(e) => setMap(e.target.value)} className={SELECT}>
              <option value={ALL}>All maps</option>
              {mapsInDataset.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="zpe-day" className="text-xs font-medium">Match day</label>
            <select id="zpe-day" value={day} onChange={(e) => setDay(e.target.value)} className={SELECT}>
              <option value={ALL}>All days</option>
              {daysInDataset.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="zpe-team" className="text-xs font-medium">Team spotlight</label>
            <select id="zpe-team" value={team} onChange={(e) => setTeam(e.target.value)} className={SELECT}>
              <option value={ALL}>All teams</option>
              {teamsInDataset.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-2" aria-live="polite">
          <Badge variant="secondary">Observed sample</Badge>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            {matches.length} COMPLETED {matches.length === 1 ? "MATCH" : "MATCHES"} · REV {detail.sourceRevision}
          </span>
        </p>

        {matches.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-surface-muted/40 p-5 text-sm leading-relaxed">
            <p className="font-medium">No completed matches in this selection.</p>
            <p className="mt-1 text-muted-foreground">Widen the filters — every number on this page needs at least one recorded match behind it.</p>
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset filters
            </button>
          </div>
        ) : (
          <>
            <section aria-labelledby="zpe-winners-heading" className="space-y-3">
              <h2 id="zpe-winners-heading" className="text-sm font-semibold">Match winners</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">Who won each match in this selection, and with what output.</p>
              <div className="overflow-x-auto rounded-[12px] border border-border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Match winners in the selected sample</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Match</th>
                      <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Map</th>
                      <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Day</th>
                      <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Winner</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fin</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {matches.map((m) => (
                      <tr key={`${m.number}-${m.map}`} className="hover:bg-surface-muted/30">
                        <td className="px-3 py-2 font-mono tabular-nums">#{m.number}</td>
                        <td className="px-3 py-2">{m.map}</td>
                        <td className="px-3 py-2 text-muted-foreground">{m.day}</td>
                        <td className="px-3 py-2 font-medium">{m.winnerName}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{m.winnerFinishes}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{m.winnerPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="zpe-placement-heading" className="space-y-3">
              <h2 id="zpe-placement-heading" className="text-sm font-semibold">Placement distribution</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Share of team appearances that won, reached the top 4, or reached the top 8 across {placement.total} appearances.
              </p>
              <Bars
                format={(v) => `${v}`}
                values={[
                  { label: "Wins", value: placement.wins, note: `${rate(placement.wins, placement.total).toFixed(1)}% of appearances` },
                  { label: "Top 4", value: placement.top4, note: `${rate(placement.top4, placement.total).toFixed(1)}% of appearances` },
                  { label: "Top 8", value: placement.top8, note: `${rate(placement.top8, placement.total).toFixed(1)}% of appearances` },
                  { label: "9–16", value: placement.bottom8, note: `${rate(placement.bottom8, placement.total).toFixed(1)}% of appearances` },
                ]}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Wins {placement.wins} · Top 4 {placement.top4} ({rate(placement.top4, placement.total).toFixed(1)}%) · Top 8 {placement.top8} ({rate(placement.top8, placement.total).toFixed(1)}%) · observed in this sample.
              </p>
            </section>

            <section aria-labelledby="zpe-output-heading" className="space-y-3">
              <h2 id="zpe-output-heading" className="text-sm font-semibold">Finishes &amp; points</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">Average output per appearance, and the single biggest recorded games.</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">Avg finishes / appearance</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{formatAverage(finishes.averagePerAppearance)}</dd>
                </div>
                <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">Avg points / appearance</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{formatAverage(points.averagePerAppearance)}</dd>
                </div>
                <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">Avg winning total</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{formatAverage(points.averageWinningTotal)}</dd>
                </div>
              </dl>
              <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                {finishes.best ? <li>Most finishes in one match: {finishes.best.teamName}, {finishes.best.finishes} (match #{finishes.best.matchNumber}).</li> : null}
                {points.best ? <li>Most points in one match: {points.best.teamName}, {points.best.totalPoints} (match #{points.best.matchNumber}).</li> : null}
              </ul>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Average finishes per appearance by map</h3>
              <Bars
                format={(v) => formatAverage(v)}
                values={maps.map((m) => ({ label: m.map, value: m.averageFinishesPerAppearance, note: `${m.matches} matches` }))}
              />
            </section>

            <section aria-labelledby="zpe-teams-heading" className="space-y-3">
              <h2 id="zpe-teams-heading" className="text-sm font-semibold">Team consistency</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every team in this selection, ordered by average placement. This describes the sample — not a skill ranking.
              </p>
              <div className="overflow-x-auto rounded-[12px] border border-border">
                <table className="w-full text-sm">
                  <caption className="sr-only">Team aggregates in the selected sample</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Team</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Played</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Wins</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top 4</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Avg place</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Finishes</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teams.map((t) => (
                      <tr key={t.teamName} className={`hover:bg-surface-muted/30 ${spotlight?.teamName === t.teamName ? "bg-primary/[0.06]" : ""}`}>
                        <td className="px-3 py-2 font-medium">
                          {t.teamName}
                          {spotlight?.teamName === t.teamName ? <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-primary">Spotlight</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{t.played}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{t.wins}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{t.top4} ({rate(t.top4, t.played).toFixed(0)}%)</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{formatAverage(t.averagePlacement)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{t.totalFinishes}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">{t.totalPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="zpe-days-heading" className="space-y-3">
              <h2 id="zpe-days-heading" className="text-sm font-semibold">Day progression</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">How output and winners moved across days in this selection.</p>
              <ul className="space-y-2">
                {days.map((d) => (
                  <li key={d.day} className="rounded-[12px] border border-border bg-surface-muted/40 p-3 text-sm">
                    <p className="font-mono text-[11px] tracking-widest text-muted-foreground">{d.day.toUpperCase()} · {d.matches} MATCHES</p>
                    <p className="mt-1 leading-relaxed">
                      Avg {formatAverage(d.averageFinishesPerAppearance)} finishes and {formatAverage(d.averagePointsPerAppearance)} points per appearance.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Winners: {d.winners.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Source: {detail.tournamentName} {detail.stageName}, revision {detail.sourceRevision}.{" "}
              <Link
                href={`/bgmi-tournaments/${detail.tournamentSlug}/${detail.stageSlug}` as Route}
                className="underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                View the published stage
              </Link>
            </p>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Published results only — no zone telemetry, no predictions. Your filters stay on this device; nothing is saved.
        </p>
      </CardContent>
    </Card>
  );
}
