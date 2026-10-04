import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-sm font-normal flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs">M</span>
              MicroNest
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A growing collection of focused tools for the business of esports.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tools</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/tools/sponsorship-tracking" className="text-muted-foreground hover:text-foreground hover:underline">Sponsorship Tracking</Link></li>
              <li><Link href="/tools/scrim-matchmaker" className="text-muted-foreground hover:text-foreground hover:underline">Scrim Matchmaker</Link></li>
              <li><Link href="/tools/prize-pool-splitter" className="text-muted-foreground hover:text-foreground hover:underline">Prize Pool Splitter</Link></li>
              <li><Link href="/tools/vod-clipper" className="text-muted-foreground hover:text-foreground hover:underline">VOD Clipper</Link></li>
              <li><Link href="/tools/roster-sentinel" className="text-muted-foreground hover:text-foreground hover:underline">Roster Sentinel</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Explore</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/tools" className="text-muted-foreground hover:text-foreground hover:underline">All tools</Link></li>
              <li><Link href="/signup" className="text-muted-foreground hover:text-foreground hover:underline">Get started</Link></li>
              <li><Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">Log in</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground hover:underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground hover:underline">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} MicroNest — Esports micro-SaaS platform. All rights reserved.</span>
          <span className="text-xs">Focused tools, not a giant suite.</span>
        </div>
      </div>
    </footer>
  );
}
