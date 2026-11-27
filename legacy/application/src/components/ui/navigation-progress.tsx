"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Global internal-navigation feedback (RCCF-PLATFORM-NAV-LOADING-08).
 *
 * Single delegated click listener: shows a thin top progress bar for
 * same-origin App Router navigations only. Mounted once in the root layout
 * so public marketing, auth, dashboard, and billing surfaces share one
 * mechanism. CSS-only animation; no route state machine, no polling.
 */
export function shouldTriggerNavigationProgress(
  rawHref: string | null,
  anchor: { target?: string | null; download?: string | null; ariaDisabled?: string | null },
  currentUrl: string,
  eventModifiers: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean } = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  }
): boolean {
  if (!rawHref) return false;
  const href = rawHref.trim();
  if (!href || href === "#") return false;
  // Hash-only links.
  if (href.startsWith("#")) return false;
  // Non-navigation schemes.
  const lower = href.toLowerCase();
  if (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:")
  ) {
    return false;
  }
  // New tabs / windows: explicit target, download intent, modifier keys, non-left click.
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.download !== undefined && anchor.download !== null) return false;
  if (anchor.ariaDisabled === "true") return false;
  if (eventModifiers.button !== 0) return false;
  if (eventModifiers.metaKey || eventModifiers.ctrlKey || eventModifiers.shiftKey || eventModifiers.altKey) return false;

  let current: URL;
  let next: URL;
  try {
    current = new URL(currentUrl, "http://localhost");
    next = new URL(href, current);
  } catch {
    return false;
  }
  // External origins (covers http(s) absolute, protocol-relative //host).
  if (next.origin !== current.origin) return false;
  // Same-URL no-op (ignore hash differences — hash nav is not a route change).
  if (next.pathname === current.pathname && next.search === current.search) return false;
  // Only http(s) same-origin navigations reach here.
  if (next.protocol !== "http:" && next.protocol !== "https:") return false;
  return true;
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Route settled — hide feedback.
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      // Disabled links never navigate.
      if (anchor.hasAttribute("disabled") || anchor.getAttribute("aria-disabled") === "true" || anchor.hasAttribute("data-no-progress")) {
        return;
      }
      const rawHref = anchor.getAttribute("href");
      const ok = shouldTriggerNavigationProgress(
        rawHref,
        {
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download") ? (anchor.getAttribute("download") ?? "") : null,
          ariaDisabled: anchor.getAttribute("aria-disabled"),
        },
        window.location.href,
        { button: e.button, metaKey: e.metaKey, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey }
      );
      if (!ok) return;
      setNavigating(true);
      // Safety auto-clear if the App Router navigation stalls or resolves
      // without a pathname change observable here.
      clearTimer();
      timer.current = setTimeout(() => setNavigating(false), 2500);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimer();
    };
  }, []);

  if (!navigating) return null;
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[100] h-[2px] w-full overflow-hidden bg-transparent"
      role="progressbar"
      aria-label="Navigating"
      aria-busy="true"
    >
      <div className="h-full w-full origin-left animate-[navprogress_900ms_ease-in-out_infinite] bg-primary" />
      <style>{`@keyframes navprogress{0%{transform:scaleX(0)}50%{transform:scaleX(0.7)}100%{transform:scaleX(1)}} @media(prefers-reduced-motion:reduce){div{animation:none !important}}`}</style>
    </div>
  );
}
