// M1 responsive site header (client: mobile disclosure menu only).
// Links point exclusively at shipped routes. The legacy "Opportunities"
// placeholder span is removed (M0 roadmap M1-2): unshipped domains appear
// only in the homepage RoadmapStrip, labelled Coming soon. Settings stays as
// a secondary utility link so the existing authenticated route remains
// reachable; it is not presented as marketing navigation.
//
// Implementation note (M4): the menu is deliberately a state-driven <button>,
// not a native <details>. A <details> version was prototyped and rejected:
// the brand/desktop-nav must stay visible while the panel toggles, but
// <summary> must be a direct child of <details> AND closed <details> hides
// every non-<summary> child — so brand/nav/panel cannot coexist in one
// <details> without invalid nesting (verified broken render + dead toggle).
// The authored client component costs ~0 extra bytes (the App Router
// framework runtime ships on static pages regardless — see 03).

"use client";

import Link from "next/link";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const primaryLinks = [
  { href: "/players", label: "Discover players" },
  { href: "/teams", label: "Discover teams" },
  { href: "/organizations", label: "Discover organizations" },
  { href: "/organizers", label: "Discover organizers" },
  { href: "/brands", label: "Discover brands" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/news", label: "News" },
  { href: "/tools", label: "Tools" },
  { href: "/about", label: "About" },
] as const;

function BrandMark() {
  return (
    <Link
      href="/"
      className="focus-visible:outline-accent-600 flex min-h-[44px] items-center gap-2.5 rounded-none focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label="MicroNest Esports — home"
    >
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
        <rect width="28" height="28" rx="3" fill="#0A0E14" />
        <path
          d="M7 20V8l7 6 7-6v12"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="7" y="20" width="14" height="2.5" fill="#C8102E" />
      </svg>
      <span className="font-display text-lg font-extrabold tracking-tight uppercase">
        {siteConfig.name}
      </span>
    </Link>
  );
}

const linkClass =
  "inline-flex min-h-[44px] items-center rounded-none text-sm font-semibold text-ink-900 underline-offset-4 hover:text-accent-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-ink-900/10 bg-paper/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <BrandMark />

        <nav aria-label="Primary" className="hidden items-center gap-5 xl:flex">
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
          <Link
            href="/settings/profile"
            className="text-ink-600 focus-visible:outline-accent-600 inline-flex min-h-[44px] items-center rounded-none text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Settings
          </Link>
          <Link
            href="/players"
            className="bg-accent-600 hover:bg-accent-700 focus-visible:outline-accent-600 inline-flex min-h-[44px] items-center rounded-none px-4 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Explore players
          </Link>
        </nav>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="primary-menu"
          onClick={() => setOpen((value) => !value)}
          className="text-ink-900 focus-visible:outline-accent-600 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-none text-sm font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 xl:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div id="primary-menu" hidden={!open} className={cn("border-ink-900/10 border-t xl:hidden")}>
        <nav aria-label="Mobile" className="mx-auto w-full max-w-5xl px-4 py-2 sm:px-6">
          <ul className="flex flex-col">
            {primaryLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(linkClass, "w-full")}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/settings/profile"
                onClick={() => setOpen(false)}
                className="text-ink-600 focus-visible:outline-accent-600 inline-flex min-h-[44px] w-full items-center rounded-none text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Settings
              </Link>
            </li>
            <li className="py-2">
              <Link
                href="/players"
                onClick={() => setOpen(false)}
                className="bg-accent-600 hover:bg-accent-700 focus-visible:outline-accent-600 inline-flex min-h-[44px] w-full items-center justify-center rounded-none px-4 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Explore players
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
