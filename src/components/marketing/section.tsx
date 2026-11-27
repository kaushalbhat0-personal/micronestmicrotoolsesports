// M1 marketing primitives: section shell + eyebrow.
// Static only. Must never import Supabase clients, server readers,
// repositories or private data-access modules (see marketing.test.tsx).

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type MarketingTone = "paper" | "steel" | "arena";

const toneClass: Record<MarketingTone, string> = {
  paper: "bg-paper text-ink-900",
  steel: "bg-steel-100 text-ink-900",
  arena: "bg-arena-950 text-white",
};

export function SectionEyebrow({
  children,
  tone = "paper",
  className,
}: {
  children: ReactNode;
  tone?: MarketingTone;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase",
        tone === "arena" ? "text-accent-300" : "text-accent-600",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="inline-block h-3 w-1 bg-accent-600"
      />
      {children}
    </p>
  );
}

export function MarketingSection({
  id,
  eyebrow,
  title,
  lede,
  tone = "paper",
  children,
  labelledBy,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  tone?: MarketingTone;
  children: ReactNode;
  labelledBy?: string;
}) {
  const titleId = labelledBy ?? (id !== undefined ? `${id}-title` : undefined);
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn("w-full", toneClass[tone])}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <SectionEyebrow tone={tone}>{eyebrow}</SectionEyebrow>
        <h2
          id={titleId}
          className="font-display mt-4 max-w-3xl text-3xl font-extrabold tracking-tight uppercase sm:text-4xl"
        >
          {title}
        </h2>
        {lede !== undefined ? (
          <p
            className={cn(
              "mt-4 max-w-2xl text-base leading-relaxed",
              tone === "arena" ? "text-slate-300" : "text-ink-600"
            )}
          >
            {lede}
          </p>
        ) : null}
        <div className="mt-8 sm:mt-10">{children}</div>
      </div>
    </section>
  );
}
