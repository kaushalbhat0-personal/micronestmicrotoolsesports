import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "./print-button";
import { decodeShareState } from "@/features/prize-splitter/services/share";
import { calculateSplit, formatMoney } from "@/features/prize-splitter/services/calculation";
import { Check, AlertCircle, Calculator } from "lucide-react";

export const metadata: Metadata = {
  title: "Prize Pool Split — MicroNest",
  description: "Shared prize pool distribution from MicroNest Prize Pool Splitter.",
  robots: { index: false, follow: false },
};

export default async function SharePrizeSplitterPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;

  if (!s) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container-nest py-12">
          <Card className="mx-auto max-w-lg border-warning/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-warning" /> Invalid share link</CardTitle>
              <CardDescription>This link is missing or malformed. Generate a new link from the Prize Pool Splitter.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Create your own split</Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Length guard early — decodeShareState also checks 4000 but we surface clearly
  if (s.length > 4000) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container-nest py-12">
          <Card className="mx-auto max-w-lg border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /> Share link too large</CardTitle>
              <CardDescription>The encoded state exceeds the allowed size.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Create your own split</Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const decoded = decodeShareState(s);

  if (!decoded.ok || !decoded.state) {
    const reason =
      decoded.error === "version"
        ? "This share link uses an unsupported version. Please generate a new link."
        : decoded.error === "too long"
          ? "This share link is too large."
          : "This share link is malformed or has been tampered with.";

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container-nest py-12">
          <Card className="mx-auto max-w-lg border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /> Invalid share link</CardTitle>
              <CardDescription>{reason}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Error: {decoded.error}</p>
              <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Create your own split</Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const st = decoded.state;

  // calculateSplit will re-validate canonically; if fails we show error
  let result: ReturnType<typeof calculateSplit> | null = null;
  try {
    const input = {
      prizePool: st.pool,
      currency: st.cur,
      method: st.method,
      placements: st.method === "equal" ? [] : st.placements,
      equalCount: st.method === "equal" ? st.equalCount : undefined,
    };
    result = calculateSplit(input as never);
  } catch {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1 container-nest py-12">
          <Card className="mx-auto max-w-lg border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /> Unable to render</CardTitle>
              <CardDescription>The shared state failed validation.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">Create your own split</Link>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const isBalanced = result.isBalanced;
  const currency = result.currency;
  const publishCtx = st.ctx;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container-nest py-8 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">MicroNest — Prize Pool Splitter</p>
            {publishCtx?.tournamentName ? <h1 className="font-display text-2xl font-normal tracking-tight">{publishCtx.tournamentName}</h1> : <h1 className="font-display text-2xl font-normal tracking-tight">Prize Pool Distribution</h1>}
            {publishCtx?.sponsorName && <p className="text-xs text-muted-foreground">Presented by {publishCtx.sponsorName}</p>}
            {publishCtx?.date && <p className="text-xs text-muted-foreground">{publishCtx.date}</p>}
            <p className="text-xs font-mono text-muted-foreground">Prize Pool {formatMoney(result.prizePool, currency)} • {currency} • {st.method}</p>
          </div>

          <Card id="payout-sheet" className={`overflow-hidden print:shadow-none print:border ${isBalanced ? "border-success/40" : "border-warning/40"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Distribution</CardTitle>
                {isBalanced ? <Badge variant="success" className="gap-1"><Check className="h-3 w-3" /> Balanced</Badge> : null}
              </div>
              <CardDescription className="font-mono text-xs">
                Total distributed {formatMoney(result.totalDistributed, currency)} • {result.totalPercentage}% • Remaining {formatMoney(result.remaining, currency)}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {/* Print header — visible only in print */}
              <div className="hidden print:block px-6 pt-6 pb-3 border-b border-border">
                <p className="text-sm font-semibold">MicroNest — Prize Pool Splitter</p>
                {publishCtx?.tournamentName && <p className="mt-1 text-lg font-bold">{publishCtx.tournamentName}</p>}
                {publishCtx?.sponsorName && <p className="text-xs text-muted-foreground">Presented by {publishCtx.sponsorName}</p>}
                {publishCtx?.date && <p className="text-xs text-muted-foreground">{publishCtx.date}</p>}
                <p className="mt-2 font-mono text-xs">Prize Pool: {formatMoney(result.prizePool, currency)} • {currency}</p>
              </div>

              <div className="divide-y divide-border/60">
                <div className={`flex items-center justify-between px-4 py-2.5 text-xs ${isBalanced ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                  <span className="font-medium flex items-center gap-1.5">{isBalanced ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}{result.totalPercentage}% distributed</span>
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
            </CardContent>
          </Card>

          <div className="text-center space-y-3 print:hidden">
            <p className="text-xs text-muted-foreground">The calculator reconciles rounding to the last {currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}0.01 — displayed payouts always sum to the prize pool.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/tools/prize-pool-splitter" className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] min-h-[44px]">Create your own split</Link>
              <Link href="/pricing" className="inline-flex h-10 items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted min-h-[44px]">View pricing</Link>
              <PrintButton />
            </div>
          </div>

          {/* Print-only footer */}
          <div className="hidden print:block text-center text-[11px] text-muted-foreground pt-6 border-t border-border mt-4">
            Generated with MicroNest — Prize Pool Splitter • micronest.example • No escrow • No payments held
          </div>
        </div>
      </main>
      <Footer />

      <style>{`@media print {
        @page { margin: 12mm; size: A4; }
        html, body { height: auto !important; min-height: 0 !important; background: white !important; overflow: visible !important; }
        header, footer, nav, aside { display: none !important; }
        main { padding: 0 !important; }
        #payout-sheet { position: static !important; visibility: visible !important; box-shadow: none !important; border: 1px solid #e5e7eb !important; page-break-inside: avoid; break-inside: avoid; width: 100% !important; max-width: 100% !important; margin: 0 auto !important; }
        .print\\:block { display: block !important; }
        .print\\:hidden { display: none !important; }
      }`}</style>
    </div>
  );
}
