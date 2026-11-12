// Site footer: arena band with brand, route index, honest availability
// statement and legal disclaimer. Links point exclusively at shipped routes:
// no /terms, no /privacy, no social URLs (none exist). Tool links use the
// real registry slugs.

import Link from "next/link";
import { siteConfig } from "@/config/site";

const footerLinks = [
  { href: "/", label: "Home" },
  { href: "/players", label: "Player directory" },
  { href: "/teams", label: "Team rosters" },
  { href: "/organizations", label: "Organizations directory" },
  { href: "/brands", label: "Brand directory" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/news", label: "News & guides" },
  { href: "/tools", label: "Esports tools" },
  { href: "/tools/prize-pool-splitter", label: "Prize Pool Splitter" },
  { href: "/tools/roster-slot-builder", label: "Roster & Slot Builder" },
  { href: "/tools/tiebreak-qualifier", label: "Tie-Break & Qualification Simulator" },
  { href: "/about", label: "About MicroNest" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-arena-950 w-full text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold tracking-tight uppercase">
              {siteConfig.name}
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
              Independent esports discovery directory and client-side utility
              suite for competitive players, independent rosters, and
              grassroots organizers — starting with BGMI.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Availability: player, team, organization, brand, tournament, news
              and tools discovery routes are live. Publishing, ownership and
              verification writes, opportunities and mini games are planned and
              labelled — never sold as shipped. News content appears only after
              editorial acceptance.
            </p>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-400">
              MicroNest Esports is an independent community directory. BGMI
              (Battlegrounds Mobile India) is a registered trademark of KRAFTON,
              Inc. MicroNest is not affiliated with, sponsored by, or endorsed
              by KRAFTON, Inc. or any official tournament body. All listings
              are self-declared or illustrative.
            </p>
          </div>
          <nav aria-label="Footer" className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] text-slate-400 uppercase">Explore</p>
            <ul className="mt-3 flex flex-col">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-[44px] items-center rounded-none text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-1 border-t border-white/15 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <p>Only players who choose to be discoverable appear in the directory.</p>
        </div>
      </div>
    </footer>
  );
}
