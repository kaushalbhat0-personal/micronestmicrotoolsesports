"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { CURRENCIES, RANKED_PRESETS, formatPlacementLabel, type Currency, type DistributionMethod, type PlacementInput } from "../types";
import { calculateSplit, validateInput, formatMoney, buildCopyText } from "../services/calculation";
import { Trophy, Percent, Users, Medal, Copy, RotateCcw, Check, AlertCircle, Plus, Trash2, Calculator } from "lucide-react";

type Props = {
  orgSlug: string;
};

const DEFAULT_PLACEMENTS: PlacementInput[] = [
  { label: "1st", percentage: 50 },
  { label: "2nd", percentage: 30 },
  { label: "3rd", percentage: 20 },
];

function ordinalLabel(n: number): string {
  return formatPlacementLabel(n);
}

export function PrizeSplitterCalculator({ orgSlug: _orgSlug }: Props) {
  const [prizePool, setPrizePool] = React.useState<number>(100000);
  const [prizePoolRaw, setPrizePoolRaw] = React.useState<string>("100000");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [method, setMethod] = React.useState<DistributionMethod>("percentage");
  const [placements, setPlacements] = React.useState<PlacementInput[]>(DEFAULT_PLACEMENTS);
  const [equalCount, setEqualCount] = React.useState<number>(5);
  const [rankedPreset, setRankedPreset] = React.useState<string>("top3");
  const [copied, setCopied] = React.useState(false);

  const currencyCfg = CURRENCIES[currency];
  const symbol = currencyCfg.symbol;

  // Sync ranked preset when method changes to ranked
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

  React.useEffect(() => {
    if (method === "ranked") {
      // ensure placements reflect preset if length mismatch
      const preset = RANKED_PRESETS.find((p) => p.id === rankedPreset);
      if (preset && placements.length !== preset.count) {
        // keep if user edited? only if still default-like; simple sync on method entry handled via preset apply
      }
    }
  }, [method, rankedPreset, placements.length]);

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
    return placements.reduce((a, p) => a + (Number.isFinite(p.percentage) ? p.percentage : 0), 0);
  }, [method, placements]);

  const isBalanced = validation.valid && result?.isBalanced;

  const handleCopy = async () => {
    if (!result) return;
    const text = buildCopyText(result);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setPrizePool(100000);
    setPrizePoolRaw("100000");
    setCurrency("INR");
    setMethod("percentage");
    setPlacements(DEFAULT_PLACEMENTS);
    setEqualCount(5);
    setRankedPreset("top3");
    setCopied(false);
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
      // re-label sequentially
      return next.map((p, i) => ({ ...p, label: ordinalLabel(i + 1) }));
    });
  };

  return (
    <div className="space-y-6">
      {/* Header card — contextual */}
      <div className="rounded-[16px] border border-border bg-card p-4 sm:p-5 flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 border border-primary/15 shrink-0">
          <Calculator className="h-5 w-5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Split a tournament prize pool in seconds.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enter the prize pool, choose how it should be distributed, and get exact payouts — reconciled to the last {symbol}0.01.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: inputs */}
        <div className="lg:col-span-3 space-y-5">
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
                        const v = e.target.value.replace(/[^0-9.]/g, "");
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

              {/* Method-specific config */}
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

        {/* Right: result */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card className={`overflow-hidden transition-colors ${isBalanced ? "border-success/40" : validation.valid ? "border-border" : "border-warning/40"}`}>
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
                    {/* total bar */}
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

            <div className="flex gap-2">
              <Button onClick={handleCopy} disabled={!result} className="flex-1 min-h-[44px]">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Results"}
              </Button>
              <Button variant="outline" onClick={handleReset} className="min-h-[44px]">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>

            <p className="text-center text-xs leading-relaxed text-muted-foreground px-2">
              The calculator reconciles rounding to the last {symbol}0.01 — displayed payouts always sum to the prize pool.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
