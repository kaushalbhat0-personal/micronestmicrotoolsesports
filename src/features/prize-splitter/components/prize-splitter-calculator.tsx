"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import {
  CURRENCIES,
  RANKED_PRESETS,
  GAME_PRESETS,
  formatPlacementLabel,
  DEFAULT_PLACEMENTS,
  DEFAULT_METHOD,
  DEFAULT_PRIZE_POOL,
  DEFAULT_CURRENCY,
  type Currency,
  type DistributionMethod,
  type GamePrizePreset,
  type PlacementInput,
  type PrizePublishContext,
} from "../types";
import { getGameBySlug } from "@/config/games/catalog";
import { calculateSplit, validateInput, formatMoney, canonicalPct } from "../services/calculation";
import { formatPayoutAnnouncement, type AnnouncementStyle } from "../services/formatters";
import { buildCsv, downloadCsv } from "../services/export";
import { decodeShareState, encodeShareState } from "../services/share";
import { Trophy, Percent, Users, Medal, Copy, RotateCcw, Check, AlertCircle, Plus, Trash2, Calculator, Link2, Download, Printer, ChevronDown } from "lucide-react";

function ordinalLabel(n: number): string {
  return formatPlacementLabel(n);
}

function sanitizePoolInput(v: string): string {
  // Allow digits and single dot; strip others. Prevent multiple dots.
  let s = v.replace(/[^0-9.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    // keep first dot, remove others
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  return s;
}

export function PrizeSplitterCalculator() {
  const [prizePool, setPrizePool] = React.useState<number>(DEFAULT_PRIZE_POOL);
  const [prizePoolRaw, setPrizePoolRaw] = React.useState<string>(String(DEFAULT_PRIZE_POOL));
  const [currency, setCurrency] = React.useState<Currency>(DEFAULT_CURRENCY);
  const [method, setMethod] = React.useState<DistributionMethod>(DEFAULT_METHOD);
  const [placements, setPlacements] = React.useState<PlacementInput[]>(DEFAULT_PLACEMENTS);
  const [equalCount, setEqualCount] = React.useState<number>(5);
  const [rankedPreset, setRankedPreset] = React.useState<string>("top3");
  const [gamePresetId, setGamePresetId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [copyMenuOpen, setCopyMenuOpen] = React.useState(false);
  const [linkCopied, setLinkCopied] = React.useState(false);

  // Publish context
  const [tournamentName, setTournamentName] = React.useState("");
  const [date, setDate] = React.useState("");
  const [sponsorName, setSponsorName] = React.useState("");

  const currencyCfg = CURRENCIES[currency];
  const symbol = currencyCfg.symbol;

  const publishCtx: PrizePublishContext | undefined = React.useMemo(() => {
    const t = tournamentName.trim();
    const d = date.trim();
    const s = sponsorName.trim();
    if (!t && !d && !s) return undefined;
    return {
      ...(t ? { tournamentName: t } : {}),
      ...(d ? { date: d } : {}),
      ...(s ? { sponsorName: s } : {}),
    };
  }, [tournamentName, date, sponsorName]);

  // Share URL rehydration — decode ?s= on mount only
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("s");
      if (!encoded) return;
      const decoded = decodeShareState(encoded);
      if (!decoded.ok || !decoded.state) return;
      const st = decoded.state;
      setPrizePool(st.pool);
      setPrizePoolRaw(String(st.pool));
      setCurrency(st.cur);
      setMethod(st.method);
      if (st.method === "equal") {
        if (st.equalCount) setEqualCount(st.equalCount);
      } else {
        setPlacements(st.placements.length ? st.placements : DEFAULT_PLACEMENTS);
        // try to detect preset for ranked
        if (st.method === "ranked") {
          const matched = RANKED_PRESETS.find((p) => p.count === st.placements.length && p.percentages.every((pct, i) => Math.abs(pct - (st.placements[i]?.percentage ?? 0)) < 0.01));
          if (matched) setRankedPreset(matched.id);
        }
      }
      if (st.ctx) {
        if (st.ctx.tournamentName) setTournamentName(st.ctx.tournamentName);
        if (st.ctx.date) setDate(st.ctx.date);
        if (st.ctx.sponsorName) setSponsorName(st.ctx.sponsorName);
      }
    } catch {
      // ignore malformed
    }
  }, []);

  const applyPreset = React.useCallback(
    (presetId: string) => {
      const preset = RANKED_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setRankedPreset(presetId);
      const next: PlacementInput[] = preset.percentages.map((pct, i) => ({
        label: ordinalLabel(i + 1),
        percentage: pct,
      }));
      setPlacements(next);
    },
    []
  );

  const applyGamePreset = React.useCallback((preset: GamePrizePreset) => {
    setGamePresetId(preset.id);
    setMethod(preset.method);
    setPlacements(preset.placements.map((p) => ({ ...p })));
  }, []);

  const activeGamePreset = gamePresetId
    ? (GAME_PRESETS.find((p) => p.id === gamePresetId) ?? null)
    : null;

  const handleMethodChange = (next: DistributionMethod) => {
    setMethod(next);
    if (next === "percentage") {
      setPlacements(DEFAULT_PLACEMENTS);
    } else if (next === "equal") {
      // no placements needed
    } else if (next === "ranked") {
      applyPreset(rankedPreset);
    } else if (next === "custom") {
      setPlacements(DEFAULT_PLACEMENTS);
    }
  };

  const validation = React.useMemo(() => {
    const input = {
      prizePool,
      currency,
      method,
      placements: method === "equal" ? [] : placements,
      equalCount: method === "equal" ? equalCount : undefined,
    };
    return validateInput(input as never);
  }, [prizePool, currency, method, placements, equalCount]);

  const result = React.useMemo(() => {
    if (!validation.valid) return null;
    try {
      const input = {
        prizePool,
        currency,
        method,
        placements: method === "equal" ? [] : placements,
        equalCount: method === "equal" ? equalCount : undefined,
      };
      return calculateSplit(input as never);
    } catch {
      return null;
    }
  }, [validation.valid, prizePool, currency, method, placements, equalCount]);

  const totalPct = React.useMemo(() => {
    if (method === "equal") return 100;
    return placements.reduce((a, p) => a + (Number.isFinite(p.percentage) ? canonicalPct(p.percentage) : 0), 0);
  }, [method, placements]);

  const isBalanced = validation.valid && result?.isBalanced;

  const doCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    setCopyMenuOpen(false);
  };

  const handleCopy = (style: AnnouncementStyle) => {
    if (!result) return;
    const text = formatPayoutAnnouncement(result, publishCtx, style);
    void doCopy(text, style);
  };

  const handleCopyLink = async () => {
    // Build share state from current inputs
    const shareState = {
      v: 1 as const,
      pool: prizePool,
      cur: currency,
      method,
      placements: method === "equal" ? [] as PlacementInput[] : placements.map((p) => ({ label: p.label, percentage: canonicalPct(p.percentage) })),
      ...(method === "equal" ? { equalCount } : {}),
      ...(publishCtx ? { ctx: publishCtx } : {}),
    };
    // Validate before encoding — if invalid, don't copy
    const testInput = {
      prizePool: shareState.pool,
      currency: shareState.cur,
      method: shareState.method,
      placements: shareState.method === "equal" ? [] : shareState.placements,
      equalCount: shareState.method === "equal" ? shareState.equalCount : undefined,
    };
    const v = validateInput(testInput as never);
    if (!v.valid) return;
    const encoded = encodeShareState(shareState as never);
    const url = `${window.location.origin}/share/prize-splitter?s=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!result) return;
    const csv = buildCsv(result, publishCtx);
    const base = tournamentName.trim() ? tournamentName.trim().replace(/[^a-z0-9\-_]+/gi, "-").slice(0, 40) : "payout";
    downloadCsv(csv, `${base}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setPrizePool(DEFAULT_PRIZE_POOL);
    setPrizePoolRaw(String(DEFAULT_PRIZE_POOL));
    setCurrency(DEFAULT_CURRENCY);
    setMethod(DEFAULT_METHOD);
    setPlacements(DEFAULT_PLACEMENTS);
    setEqualCount(5);
    setRankedPreset("top3");
    setGamePresetId(null);
    setCopied(null);
    setLinkCopied(false);
    setCopyMenuOpen(false);
    setTournamentName("");
    setDate("");
    setSponsorName("");
    // clear share param without reload
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  const updatePlacementPct = (idx: number, value: string) => {
    const num = value === "" ? 0 : Number(value);
    setPlacements((prev) => prev.map((p, i) => (i === idx ? { ...p, percentage: Number.isNaN(num) ? 0 : num } : p)));
  };

  const addPlacement = () => {
    const nextPos = placements.length + 1;
    setPlacements((prev) => [...prev, { label: ordinalLabel(nextPos), percentage: 0 }]);
  };

  const removePlacement = (idx: number) => {
    setPlacements((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((p, i) => ({ ...p, label: ordinalLabel(i + 1) }));
    });
  };

  return (
    <div className="space-y-6">
      {/* Header card — contextual */}
      <div className="rounded-[16px] border border-border bg-card p-4 sm:p-5 flex items-start gap-3 print:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 border border-primary/15 shrink-0">
          <Calculator className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Split a tournament prize pool in seconds.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enter the prize pool, choose how it should be distributed, and get exact payouts — reconciled to the last {symbol}0.01.
            Calculations aren&apos;t saved in your workspace — copy, print, or share the result when you&apos;re done.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: inputs */}
        <div className="lg:col-span-3 space-y-5 print:hidden">
          {/* Prize Pool */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" /> Prize Pool
              </CardTitle>
              <CardDescription>Amount and currency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-5">
                <div className="sm:col-span-3 space-y-2">
                  <Label htmlFor="prize-pool">Prize pool amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
                    <Input
                      id="prize-pool"
                      inputMode="decimal"
                      value={prizePoolRaw}
                      onChange={(e) => {
                        const v = sanitizePoolInput(e.target.value);
                        setPrizePoolRaw(v);
                        const n = Number(v);
                        if (v !== "" && Number.isFinite(n)) setPrizePool(n);
                        else if (v === "") setPrizePool(0);
                      }}
                      placeholder="100000"
                      aria-invalid={validation.errors.some((e) => e.field === "prizePool")}
                      aria-describedby="prize-pool-error"
                      className="pl-7 font-mono text-[15px]"
                    />
                  </div>
                  {validation.errors
                    .filter((e) => e.field === "prizePool")
                    .map((e) => (
                      <p key={e.message} id="prize-pool-error" className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {e.message}
                      </p>
                    ))}
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger id="currency" aria-label="Currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCIES[c]?.symbol} {c} — {CURRENCIES[c]?.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tournament Context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Tournament context</CardTitle>
              <CardDescription>Optional — appears on copy, CSV, and print. Leave empty if not needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tournament-name">Tournament name</Label>
                <Input id="tournament-name" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="Valorant Champions Cup" maxLength={80} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tournament-date">Date</Label>
                  <Input id="tournament-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sponsor-name">Sponsor</Label>
                  <Input id="sponsor-name" value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="Acme Esports" maxLength={80} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game presets — starting points only, everything stays editable */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Medal className="h-4 w-4 text-primary" /> Game presets
              </CardTitle>
              <CardDescription>Start with a sensible distribution for this game — edit everything below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Game presets">
                {GAME_PRESETS.map((preset) => {
                  const pill = getGameBySlug(preset.gameSlug)?.shortName ?? preset.gameSlug;
                  const active = gamePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={active}
                      title={preset.label}
                      onClick={() => applyGamePreset(preset)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium min-h-[32px] transition-colors ${
                        active ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted"
                      }`}
                    >
                      {pill}
                    </button>
                  );
                })}
              </div>
              {activeGamePreset?.sourceNote ? (
                <p className="text-xs text-muted-foreground">{activeGamePreset.sourceNote}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Presets are starting points — edit percentages below.</p>
              )}
            </CardContent>
          </Card>

          {/* Distribution Method */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" /> Distribution Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Distribution method">
                {(
                  [
                    { id: "percentage", label: "Percentage", icon: Percent },
                    { id: "equal", label: "Equal Split", icon: Users },
                    { id: "ranked", label: "Ranked", icon: Medal },
                    { id: "custom", label: "Custom", icon: Trophy },
                  ] as const
                ).map((m) => {
                  const Icon = m.icon;
                  const active = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleMethodChange(m.id)}
                      className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[12px] border px-2 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        active ? "bg-primary text-primary-foreground border-transparent shadow-sm" : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                {method === "equal" ? (
                  <div className="space-y-2">
                    <Label htmlFor="equal-count">Number of recipients</Label>
                    <Input
                      id="equal-count"
                      type="number"
                      min={1}
                      max={1000}
                      value={equalCount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setEqualCount(Number.isFinite(v) ? Math.floor(v) : 1);
                      }}
                      className="font-mono"
                      aria-invalid={validation.errors.some((e) => e.field === "equalCount")}
                    />
                    {validation.errors
                      .filter((e) => e.field === "equalCount")
                      .map((e) => (
                        <p key={e.message} className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {e.message}
                        </p>
                      ))}
                    <p className="text-xs text-muted-foreground">Each receives {formatMoney(equalCount > 0 ? prizePool / equalCount : 0, currency)} before rounding.</p>
                  </div>
                ) : method === "ranked" ? (
                  <div className="space-y-3">
                    <Label>Preset</Label>
                    <div className="flex flex-wrap gap-2">
                      {RANKED_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={rankedPreset === p.id}
                          onClick={() => applyPreset(p.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium min-h-[32px] transition-colors ${
                            rankedPreset === p.id ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Presets are starting points — edit percentages below.</p>
                  </div>
                ) : null}

                {method !== "equal" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Placements</Label>
                      <span className={`text-xs font-mono ${Math.abs(totalPct - 100) < 0.001 ? "text-success" : "text-destructive"}`}>{Number(totalPct.toFixed(2))}% / 100%</span>
                    </div>

                    <div className="space-y-2" role="group" aria-label="Placements">
                      {placements.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface-muted text-xs font-medium tabular-nums">{p.label}</span>
                          <div className="relative flex-1">
                            <Input
                              aria-label={`${p.label} percentage`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.01}
                              value={Number.isFinite(p.percentage) ? p.percentage : 0}
                              onChange={(e) => updatePlacementPct(idx, e.target.value)}
                              className="pr-8 font-mono"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                          {method === "custom" || placements.length > 3 ? (
                            <Button variant="ghost" size="icon" aria-label={`Remove ${p.label}`} onClick={() => removePlacement(idx)} className="h-9 w-9 shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="h-9 w-9 shrink-0" aria-hidden />
                          )}
                        </div>
                      ))}
                    </div>

                    {method === "custom" && (
                      <Button variant="outline" size="sm" onClick={addPlacement} className="w-full">
                        <Plus className="h-4 w-4" /> Add placement
                      </Button>
                    )}

                    {validation.errors
                      .filter((e) => e.field === "placements" || e.field.startsWith("placements."))
                      .map((e) => (
                        <p key={e.field + e.message} className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {e.message}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: result + publish */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Distribution Preview */}
            <Card id="payout-sheet" className={`overflow-hidden transition-colors print:shadow-none print:border ${isBalanced ? "border-success/40" : validation.valid ? "border-border" : "border-warning/40"}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" /> Distribution Preview
                  </CardTitle>
                  {isBalanced ? <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Balanced</Badge> : null}
                </div>
                <CardDescription className="font-mono text-xs">
                  {validation.valid && result ? (
                    <>
                      Total distributed {formatMoney(result.totalDistributed, currency)} • {result.totalPercentage}% • Remaining {formatMoney(result.remaining, currency)}
                    </>
                  ) : (
                    <>Adjust inputs to see payouts. Total must equal 100%.</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Print header — visible only in print */}
                <div className="hidden print:block px-6 pt-6 pb-3 border-b border-border">
                  <p className="text-sm font-semibold">MicroNest — Prize Pool Splitter</p>
                  {publishCtx?.tournamentName && <p className="mt-1 text-lg font-bold">{publishCtx.tournamentName}</p>}
                  {publishCtx?.sponsorName && <p className="text-xs text-muted-foreground">Presented by {publishCtx.sponsorName}</p>}
                  {publishCtx?.date && <p className="text-xs text-muted-foreground">{publishCtx.date}</p>}
                  {result && <p className="mt-2 font-mono text-xs">Prize Pool: {formatMoney(result.prizePool, currency)} • {result?.currency}</p>}
                </div>

                {!validation.valid || !result ? (
                  <div className="px-6 py-8 text-center">
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-warning-soft border border-warning/20">
                      <AlertCircle className="h-5 w-5 text-warning" />
                    </span>
                    <p className="mt-3 text-sm font-medium">Complete the configuration</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Prize pool and distribution must be valid. Check percentage total and recipient count.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    <div className={`flex items-center justify-between px-4 py-2.5 text-xs ${isBalanced ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                      <span className="font-medium flex items-center gap-1.5">{isBalanced ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />} {totalPct.toFixed(2)}% distributed</span>
                      <span className="font-mono">{formatMoney(result.remaining, currency)} remaining</span>
                    </div>

                    <ul aria-label="Payout breakdown" className="divide-y divide-border/40">
                      {result.placements.map((pl) => (
                        <li key={`${pl.position}-${pl.label}`} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface-muted text-xs font-semibold tabular-nums">{pl.label}</span>
                            <span className="text-xs tabular-nums text-muted-foreground font-mono">{pl.percentage}%</span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums font-mono tracking-[-0.015em]">{formatMoney(pl.payout, currency)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center justify-between bg-surface-muted/50 px-4 py-3">
                      <span className="text-xs font-medium text-muted-foreground">Total</span>
                      <span className="text-sm font-bold tabular-nums font-mono">{formatMoney(result.totalDistributed, currency)} / {result.totalPercentage}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Publish */}
            <div className="space-y-3 rounded-[16px] border border-border bg-card p-4 print:hidden">
              <p className="text-xs font-semibold tracking-wide">Publish</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Button onClick={() => handleCopy("plain")} disabled={!result} className="w-full min-h-[44px] justify-between" aria-haspopup="menu" aria-expanded={copyMenuOpen} aria-label="Copy results menu">
                    <span className="flex items-center gap-2">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? `Copied ${copied}` : "Copy Results"}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Open copy options"
                      onClick={(e) => { e.stopPropagation(); setCopyMenuOpen((v) => !v); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setCopyMenuOpen((v) => !v); } }}
                      className="ml-2 flex h-7 w-7 items-center justify-center rounded-full hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${copyMenuOpen ? "rotate-180" : ""}`} />
                    </span>
                  </Button>
                  {copyMenuOpen && (
                    <div role="menu" className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[12px] border border-border bg-popover shadow-md">
                      {([
                        { id: "plain", label: "Copy Results" },
                        { id: "discord", label: "Copy for Discord" },
                        { id: "whatsapp", label: "Copy for WhatsApp" },
                        { id: "x", label: "Copy for X" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          role="menuitem"
                          disabled={!result}
                          onClick={() => handleCopy(opt.id)}
                          className="flex min-h-[44px] w-full items-center px-4 text-left text-sm hover:bg-surface-muted disabled:opacity-50 focus-visible:outline-none focus-visible:bg-surface-muted"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={handleReset} className="min-h-[44px]" aria-label="Reset calculator">
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink} disabled={!result} className="min-h-[44px] flex-col gap-0.5 py-1 text-xs" aria-label="Copy share link">
                  {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
                  {linkCopied ? "Link copied" : "Copy Link"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadCsv} disabled={!result} className="min-h-[44px] flex-col gap-0.5 py-1 text-xs" aria-label="Download CSV">
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} disabled={!result} className="min-h-[44px] flex-col gap-0.5 py-1 text-xs" aria-label="Print payout sheet">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>

              <Link href="/pricing" className="flex items-center justify-center gap-1 rounded-[10px] border border-border bg-surface-muted/50 px-3 py-2.5 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors text-center leading-relaxed">
                Need Sponsorship Tracking too? <span className="font-medium text-primary">Explore All Access → ₹2,499/month</span>
              </Link>
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground px-2 print:hidden">
              The calculator reconciles rounding to the last {symbol}0.01 — displayed payouts always sum to the prize pool.
            </p>
          </div>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="hidden print:block text-center text-[11px] text-muted-foreground pt-6 border-t border-border mt-4">
        Generated with MicroNest — Prize Pool Splitter • micronest.example • No escrow • No payments held
      </div>

      <style>{`@media print {
        @page { margin: 12mm; size: A4; }
        html, body { height: auto !important; min-height: 0 !important; background: white !important; overflow: visible !important; }
        header, aside, nav, footer { display: none !important; }
        body > div, main, .space-y-6, .grid, [class*="sticky"] { height: auto !important; min-height: 0 !important; overflow: visible !important; position: static !important; top: auto !important; }
        #payout-sheet { position: static !important; visibility: visible !important; box-shadow: none !important; border: 1px solid #e5e7eb !important; page-break-inside: avoid; break-inside: avoid; width: 100% !important; max-width: 700px !important; margin: 0 auto !important; }
        .print\\:block { display: block !important; }
        .print\\:hidden { display: none !important; }
      }`}</style>
    </div>
  );
}
