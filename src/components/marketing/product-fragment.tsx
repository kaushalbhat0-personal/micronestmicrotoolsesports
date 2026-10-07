import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

/**
 * ProductFragment — editorial product visualization fragments.
 * Real fragments (T01/T02) reuse existing UI patterns.
 * Conceptual fragments (T03-T05) are clearly illustrative, not fake functionality.
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

export function T03ScrimFragment() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold">Scrim availability · Conceptual</p>
      <div className="rounded-[12px] border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs">19:00 IST</span>
          <Badge variant="secondary">BO3</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <span className="rounded-[8px] bg-surface-muted px-2 py-2 font-mono text-[11px]">Team A · CET</span>
          <span className="rounded-[8px] bg-surface-muted px-2 py-2 font-mono text-[11px]">Team B · IST</span>
          <span className="rounded-[8px] bg-success-soft border border-success/20 px-2 py-2 font-mono text-[11px] text-success">
            Overlap ✓
          </span>
        </div>
        <p className="mt-2 text-center font-mono text-[11px] text-muted-foreground">Illustrative — scheduling concept</p>
      </div>
    </div>
  );
}

export function T04VodFragment() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold">VOD highlight · Conceptual</p>
      <div className="rounded-[12px] border border-border bg-card p-4">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span>12:34</span>
          <span className="text-muted-foreground">→</span>
          <span>13:07</span>
          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[11px]">VOD</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface-muted">
          <div className="h-2 w-[28%] rounded-full bg-primary" />
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">33s highlight · not yet implemented</p>
      </div>
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

export function T05RosterFragment() {  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold">Roster · Conceptual</p>
      <div className="rounded-[12px] border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Starting 5</span>
          <Badge variant="outline">2026</Badge>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between rounded-[8px] bg-surface-muted px-3 py-2">
            <span className="text-xs">Player 1 · EU</span>
            <span className="font-mono text-[11px] text-success">Contract ✓</span>
          </div>
          <div className="flex justify-between rounded-[8px] bg-surface-muted px-3 py-2">
            <span className="text-xs">Player 2 · KR</span>
            <span className="font-mono text-[11px] text-warning">Visa pending</span>
          </div>
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">Illustrative roster snapshot</p>
      </div>
    </div>
  );
}

export function ProductFragment({ slug }: { slug: string }) {
  switch (slug) {
    case "sponsorship-tracking":
      return <T01SponsorshipFragment />;
    case "prize-pool-splitter":
      return <T02PrizeFragment />;
    case "scrim-matchmaker":
      return <T03ScrimFragment />;
    case "vod-clipper":
      return <T04VodFragment />;
    case "roster-sentinel":
      return <T05RosterFragment />;
    case "draft-ban":
      return <T06DraftBanFragment />;
    default:
      return null;
  }
}
