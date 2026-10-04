"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);

  // Show brief progress when pathname changes - Next App Router doesn't expose navigation pending
  // We use a lightweight bar that appears immediately on link click via global listener
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href === pathname) return;
      if (href.startsWith("/dashboard")) {
        setNavigating(true);
        // auto-clear safety
        const t = setTimeout(() => setNavigating(false), 2500);
        return () => clearTimeout(t);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!navigating) return null;
  return (
    <div className="fixed left-0 top-0 z-[100] h-[2px] w-full overflow-hidden bg-transparent pointer-events-none" role="progressbar" aria-label="Navigating" aria-busy="true">
      <div className="h-full w-full origin-left animate-[navprogress_900ms_ease-in-out_infinite] bg-primary" />
      <style>{`@keyframes navprogress{0%{transform:scaleX(0)}50%{transform:scaleX(0.7)}100%{transform:scaleX(1)}} @media(prefers-reduced-motion:reduce){div{animation:none !important}}`}</style>
    </div>
  );
}
