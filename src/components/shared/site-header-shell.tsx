// Site header interactive shell (client).
// P14-D10 redesign: fixes desktop overcrowding by grouping the five
// discovery destinations under one "Discover" menu. Top-level row is now
// Brand | Discover ▾ · Tournaments · News · Tools · About | Auth actions.
// Carbon Competitive Arena treatment (arena-950 band, crimson signup).
// No PII props: only `signedIn` boolean crosses the server boundary.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";

const discoverLinks = [
  { href: "/players", label: "Players", description: "Opt-in player directory" },
  { href: "/teams", label: "Teams", description: "Self-declared rosters" },
  { href: "/organizations", label: "Organizations", description: "Regional orgs" },
  { href: "/organizers", label: "Organizers", description: "Community organizers" },
  { href: "/brands", label: "Brands", description: "Brand directory" },
] as const;

const topLinks = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/news", label: "News" },
  { href: "/tools", label: "Tools" },
  { href: "/about", label: "About" },
] as const;

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex min-h-[44px] items-center gap-2.5 rounded-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      aria-label="MicroNest Esports — home"
    >
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
        <rect width="28" height="28" rx="3" fill="#FFFFFF" />
        <path
          d="M7 20V8l7 6 7-6v12"
          fill="none"
          stroke="#0A0E14"
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

const desktopLinkClass =
  "inline-flex min-h-[44px] items-center rounded-none px-1 text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function SiteHeaderShell({ signedIn }: { signedIn: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const discoverRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on Escape / outside click (keyboard + pointer a11y).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDiscoverOpen(false);
        setAccountOpen(false);
      }
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && discoverRef.current && !discoverRef.current.contains(target)) {
        setDiscoverOpen(false);
      }
      if (target && accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <header className="bg-arena-950 sticky top-0 z-40 border-b border-white/10 text-white">
      {/* Crimson keyline: Competitive Arena signature, decorative only. */}
      <div aria-hidden="true" className="bg-accent-600 h-0.5 w-full" />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandMark />

        {/* Center: grouped primary navigation (desktop). */}
        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 lg:flex">
          <div ref={discoverRef} className="relative">
            <button
              type="button"
              aria-expanded={discoverOpen}
              aria-controls="discover-menu"
              onClick={() => {
                setDiscoverOpen((v) => !v);
                setAccountOpen(false);
              }}
              className={cn(desktopLinkClass, "gap-1 px-3", discoverOpen && "text-white underline")}
            >
              Discover
              <span aria-hidden="true" className={cn("text-xs", discoverOpen && "rotate-180")}>
                ▾
              </span>
            </button>
            {discoverOpen ? (
              <div
                id="discover-menu"
                role="menu"
                aria-label="Discovery directories"
                className="bg-arena-900 absolute top-full left-0 mt-1 w-72 border border-white/10 p-1.5 shadow-xl"
              >
                {discoverLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setDiscoverOpen(false)}
                    className="flex min-h-[44px] flex-col justify-center rounded-none px-3 py-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                  >
                    <span className="text-sm font-bold">{link.label}</span>
                    <span className="text-xs text-slate-400">{link.description}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {topLinks.map((link) => (
            <Link key={link.href} href={link.href} className={cn(desktopLinkClass, "px-3")}>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: auth actions. */}
        <div className="hidden items-center gap-2 lg:flex">
          {signedIn ? (
            <>
              <Link
                href="/workspace/teams"
                className="inline-flex min-h-[44px] items-center rounded-none border border-white/25 px-4 text-sm font-bold tracking-wide text-white uppercase hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Workspace
              </Link>
              <div ref={accountRef} className="relative">
                <button
                  type="button"
                  aria-expanded={accountOpen}
                  aria-controls="account-menu"
                  aria-label="Account menu"
                  onClick={() => {
                    setAccountOpen((v) => !v);
                    setDiscoverOpen(false);
                  }}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-none bg-white/10 px-3 text-sm font-bold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span
                    aria-hidden="true"
                    className="bg-accent-600 inline-flex h-7 w-7 items-center justify-center text-xs font-extrabold text-white"
                  >
                    M
                  </span>
                  Account
                  <span aria-hidden="true" className="text-xs">
                    ▾
                  </span>
                </button>
                {accountOpen ? (
                  <div
                    id="account-menu"
                    role="menu"
                    aria-label="Account"
                    className="bg-arena-900 absolute top-full right-0 mt-1 w-60 border border-white/10 p-1.5 shadow-xl"
                  >
                    <Link
                      href="/workspace/teams"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex min-h-[44px] items-center rounded-none px-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    >
                      Team workspace
                    </Link>
                    <Link
                      href="/settings/profile"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                      className="flex min-h-[44px] items-center rounded-none px-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                    >
                      Profile settings
                    </Link>
                    <form
                      action="/logout"
                      method="post"
                      className="mt-1 border-t border-white/10 pt-1"
                    >
                      <button
                        type="submit"
                        role="menuitem"
                        className="text-accent-300 flex min-h-[44px] w-full items-center rounded-none px-3 text-sm font-bold hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
                      >
                        Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-none px-4 text-sm font-bold tracking-wide text-slate-200 uppercase hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="bg-accent-600 hover:bg-accent-700 inline-flex min-h-[44px] items-center rounded-none px-5 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile trigger (compact, touch-friendly). */}
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="primary-menu"
          onClick={() => setMobileOpen((value) => !value)}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-none px-3 text-sm font-bold tracking-wide uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile panel: stacked nav + clear auth actions, no horizontal overflow. */}
      <div id="primary-menu" hidden={!mobileOpen} className="border-t border-white/10 lg:hidden">
        <nav aria-label="Mobile" className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-6">
          <p className="px-1 pt-2 text-[11px] font-bold tracking-[0.18em] text-slate-400 uppercase">
            Discover
          </p>
          <ul className="flex flex-col">
            {discoverLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center rounded-none text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="px-1 pt-3 text-[11px] font-bold tracking-[0.18em] text-slate-400 uppercase">
            Explore
          </p>
          <ul className="flex flex-col">
            {topLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center rounded-none text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {signedIn ? (
              <>
                <li>
                  <Link
                    href="/workspace/teams"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex min-h-[44px] w-full items-center rounded-none text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Team workspace
                  </Link>
                </li>
                <li>
                  <Link
                    href="/settings/profile"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex min-h-[44px] w-full items-center rounded-none text-sm font-semibold text-slate-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Profile settings
                  </Link>
                </li>
              </>
            ) : null}
          </ul>
          <div className="flex flex-col gap-2 py-4">
            {signedIn ? (
              <form action="/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-none border border-white/25 px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="bg-accent-600 hover:bg-accent-700 inline-flex min-h-[44px] w-full items-center justify-center rounded-none px-4 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-none border border-white/25 px-4 text-sm font-bold tracking-wide text-white uppercase hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
