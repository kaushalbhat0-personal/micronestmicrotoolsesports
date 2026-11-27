// Mobile filter disclosure for /players. Client boundary holds disclosure
// state only (mirrors the SiteHeader menu pattern); the filter form itself is
// server-rendered children, so filtering still works without JavaScript on
// desktop widths where the panel is always visible.

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FilterPanel({
  children,
  activeCount,
}: {
  children: ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current
      ?.querySelector<HTMLElement>("input, select, button")
      ?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-[44px] w-full items-center justify-center border border-ink-900/30 bg-paper px-4 text-sm font-bold tracking-wide text-ink-900 uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 sm:w-auto lg:hidden"
      >
        {open
          ? "Hide filters"
          : `Show filters${activeCount > 0 ? ` (${activeCount} active)` : ""}`}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={cn(open && "block", !open && "hidden lg:block")}
      >
        <div className="mt-4 lg:mt-0">{children}</div>
      </div>
    </div>
  );
}
