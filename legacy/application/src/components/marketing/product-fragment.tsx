import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

/**
 * ProductFragment — editorial product visualization fragments.
 * Real fragments reuse existing UI patterns.
 */

export function T01SponsorshipFragment() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-mono tracking-wide text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        Campaign → Deliverable → Proof
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[12px] border border-border bg-card p-3">
          <p className="text-xs font-semibold">Campaign</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Monster Energy · Nov</p>
          <Badge variant="success" className="mt-2 text-[10px]">
            Active
          </Badge>
        </div>
        <div className="rounded-[12px] border border-border bg-card p-3">
          <p className="text-xs font-semibold">Deliverable</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Title contains #Monster</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Category: Valorant</p>
        </div>
        <div className="rounded-[12px] border border-primary/20 bg-primary/[0.04] p-3">
          <p className="text-xs font-semibold">Proof</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Video once · 2 proof</p>
          <span className="mt-2 inline-flex rounded-full bg-success px-2 py-0.5 text-[10px] font-medium text-success-foreground">
            Confirmed
          </span>
        </div>
      </div>
    </div>
  );
}

export function T02PrizeFragment() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Distribution Preview</p>
        <span className="font-mono text-[11px] text-success">Balanced · 100%</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Place</TableHead>
            <TableHead>Share</TableHead>
            <TableHead>Payout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">1st</TableCell>
            <TableCell className="font-mono">50%</TableCell>
            <TableCell className="font-mono">₹50,000.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">2nd</TableCell>
            <TableCell className="font-mono">30%</TableCell>
            <TableCell className="font-mono">₹30,000.00</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">3rd</TableCell>
            <TableCell className="font-mono">20%</TableCell>
            <TableCell className="font-mono">₹20,000.00</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <p className="font-mono text-[11px] text-muted-foreground">₹100,000 · reconciled to last cent</p>
    </div>
  );
}

export function T06DraftBanFragment() {
  // Static sample only — illustrative example, not a real customer record.
  const steps = [
    { n: "1", team: "Falcons", action: "Ban", item: "Ascent" },
    { n: "2", team: "Sentinels", action: "Ban", item: "Lotus" },
    { n: "3", team: "Falcons", action: "Pick", item: "Haven" },
    { n: "4", team: "Sentinels", action: "Pick", item: "Bind" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">Falcons vs Sentinels</p>
        <span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px]">Record no. DB-2026-00042</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-wrap items-center gap-x-2 rounded-[8px] bg-surface-muted/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{s.n}.</span>
            <span className="font-medium">{s.team}</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${s.action === "Ban" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"}`}>
              {s.action}
            </span>
            <span className="font-medium">{s.item}</span>
          </li>
        ))}
      </ol>
      <p className="font-mono text-[11px] text-muted-foreground">Remaining pool: Split · Decider: Split</p>
      <p className="text-[11px] text-muted-foreground">Finished records are locked and can&apos;t be changed. Sample record — illustrative example.</p>
    </div>
  );
}

export function T07TieBreakerFragment() {
  // Static sample only — illustrative example, not a real customer record.
  const rows = [
    { pos: "1", team: "Falcons", detail: "9 pts · H2H", note: "Placed by head-to-head" },
    { pos: "2", team: "Sentinels", detail: "9 pts · H2H", note: "Tied group resolved" },
    { pos: "3", team: "Wolves", detail: "3 pts", note: "Placed on points" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">Group A · Final standings</p>
        <span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[11px]">Record no. TB-2026-00042</span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.pos} className="flex flex-wrap items-center gap-x-2 rounded-[8px] bg-surface-muted/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{r.pos}.</span>
            <span className="font-medium">{r.team}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{r.detail}</span>
            <span className="inline-flex rounded-full bg-success px-2 py-0.5 text-[10px] font-medium text-success-foreground">
              {r.note}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted-foreground">Finished records are locked and can&apos;t be changed. Sample record — illustrative example.</p>
    </div>
  );
}

export function ProductFragment({ slug }: { slug: string }) {
  switch (slug) {
    case "sponsorship-tracking":
      return <T01SponsorshipFragment />;
    case "prize-pool-splitter":
      return <T02PrizeFragment />;
    case "draft-ban":
      return <T06DraftBanFragment />;
    case "tie-breaker":
      return <T07TieBreakerFragment />;
    default:
      return null;
  }
}
