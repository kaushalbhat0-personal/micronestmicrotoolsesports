import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Logo } from "@/components/shared/logo";
import { getAvailableLabTools } from "@/lib/marketing/public-tool-content";
import { getPaidProductEntries } from "@/lib/marketing/paid-products";

export function Footer() {
  const labTools = getAvailableLabTools();
  const paidTools = getPaidProductEntries();
  return (
    <footer className="border-t bg-surface-muted/30 py-10">
      <div className="container-nest">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Logo height={28} />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Subscription software for esports operations — focused tools for the business of esports.</p>
            <p className="mt-2 text-xs font-medium tracking-wide text-muted-foreground">The toolbox behind esports. We provide the software; you run your esports operations.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">BGMI Lab</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href={"/bgmi-lab" as Route} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                  All drills
                </Link>
              </li>
              {labTools.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/bgmi-lab/${t.slug}` as Route}
                    className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tournaments</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/bgmi-tournaments" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Tournament Hub</Link></li>
              <li><Link href="/bgmi-qualification" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Qualification Simulator</Link></li>
              <li><Link href="/meta-parser" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Meta-Parser</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Paid Tools</p>
            <ul className="mt-3 space-y-2 text-sm">
              {paidTools.map((e) => (
                <li key={e.marketingSlug}>
                  <Link
                    href={`/tools/${e.marketingSlug}` as Route}
                    className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {e.tool.name}
                  </Link>
                </li>
              ))}
              <li><Link href={"/paid-tools" as Route} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">All Access</Link></li>
              <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Terms of Service</Link></li>
              <li><Link href={"/refund" as Route} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Refund &amp; Cancellation</Link></li>
              <li><Link href={"/digital-delivery" as Route} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Digital Delivery</Link></li>
              <li><Link href={"/contact" as Route} className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                <a href="mailto:info.micronest@gmail.com" className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                  info.micronest@gmail.com
                </a>
                <span className="mx-2" aria-hidden>·</span>
                <span>Pune, Maharashtra, India</span>
              </p>
              <p className="text-xs text-muted-foreground">MicroNest · MicroNest MicroTools — Esports · Subscription software for esports operations. MicroNest is currently not registered for GST.</p>
            </div>
            <span className="text-xs shrink-0">Focused tools, not a giant suite.</span>
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} MicroNest — Subscription software for esports operations. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
