import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRight,
  ShieldCheck,
  Split,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
  Trophy,
} from "lucide-react";
import { ModularMark } from "@/components/marketing/homepage/modular-motif";
import {
  resolveToolboxGroups,
  type ResolvedToolboxGroup,
  type ToolboxGroupCard,
} from "@/lib/marketing/homepage-seo";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck,
  Split,
  Swords,
  Scale,
  ReceiptText,
  ClipboardList,
  Newspaper,
  Target,
  Trophy,
};

function ToolIcon({ icon }: { icon: string }) {
  const Icon = iconMap[icon] ?? ShieldCheck;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface-muted">
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
    </span>
  );
}

function ToolCta({ card }: { card: ToolboxGroupCard }) {
  return (
    <Link
      href={card.url as Route}
      aria-label={card.ctaAriaLabel}
      className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors duration-[180ms] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {card.ctaLabel}
      <ArrowRight
        className="h-4 w-4 text-muted-foreground transition-transform duration-[180ms] ease-out group-hover:translate-x-1 group-focus-within:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}

/**
 * RunTheTournamentKit — four tools as one kit: a shared shelf frame with
 * hairline dividers, so the cells read as compartments of a single kit
 * rather than four unrelated product cards.
 */
function RunTheTournamentKit({ group }: { group: ResolvedToolboxGroup }) {
  return (
    <div role="group" aria-label={group.label}>
      <div className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
          <ModularMark />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
          </div>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {group.cards.map((card) => (
            <div key={card.url} className="group bg-card p-5 transition-colors duration-[180ms] hover:bg-surface-muted/40 focus-within:bg-surface-muted/40 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <ToolIcon icon={card.icon} />
                <span className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {card.accessNote}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold leading-none tracking-[-0.01em]">{card.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              <div className="mt-4">
                <ToolCta card={card} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * OpenToolRows — operational kits with breathing room: generous open rows
 * separated by hairlines, no card chrome. Used for the smaller two-tool
 * groups so each tool gets space without looking like a catalog grid.
 */
function OpenToolRows({ group }: { group: ResolvedToolboxGroup }) {
  return (
    <div role="group" aria-label={group.label} className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
          <span className="inline-block size-1.5 rounded-[2px] bg-primary" />
          <span className="inline-block size-1.5 rounded-[2px] bg-border-strong" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{group.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
        </div>
        <span className="h-px min-w-6 flex-1 bg-border" aria-hidden />
      </div>
      <div className="mt-2 divide-y divide-border border-b border-border">
        {group.cards.map((card) => (
          <div key={card.url} className="group flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-5">
            <ToolIcon icon={card.icon} />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-none tracking-[-0.01em]">{card.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              <p className="mt-2 font-mono text-[11px] tracking-widest text-muted-foreground">{card.accessNote}</p>
            </div>
            <div className="shrink-0">
              <ToolCta card={card} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MetaParserFieldNotes — Meta-Parser is not another tool card. It reads as
 * a field-notes document: a bound spine, WHAT CHANGED / HOW TO READ rows,
 * and a single read-the-patch CTA. All copy resolves from the canonical
 * registry and group blurb — no patch numbers, changes, or conclusions.
 */
function MetaParserFieldNotes({ group }: { group: ResolvedToolboxGroup }) {
  const card = group.cards[0];
  if (!card) return null;
  return (
    <div role="group" aria-label={group.label}>
      <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[20px] border border-border bg-card">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-primary/70" aria-hidden />
        <div className="p-6 pl-8 sm:p-8 sm:pl-10">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] tracking-widest text-primary">FIELD NOTES</p>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground">PATCH INTELLIGENCE</p>
          </div>
          <h3 className="font-display mt-3 text-xl font-normal tracking-tight sm:text-2xl">{card.name}</h3>
          <dl className="mt-5 divide-y divide-border border-y border-border">
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
              <dt className="font-mono text-[11px] tracking-widest text-muted-foreground">WHAT CHANGED</dt>
              <dd className="text-sm leading-relaxed">{card.description}</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
              <dt className="font-mono text-[11px] tracking-widest text-muted-foreground">HOW TO READ</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{group.blurb}</dd>
            </div>
            <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
              <dt className="font-mono text-[11px] tracking-widest text-muted-foreground">ACCESS</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">{card.accessNote}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Link
              href={card.url as Route}
              aria-label={card.ctaAriaLabel}
              className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {card.ctaLabel}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-[180ms] ease-out group-hover:translate-x-0.5 group-focus-within:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ToolboxGroups — the nine released tools in four neutral editorial groups.
 * All display data resolves from the canonical registry via
 * `resolveToolboxGroups()` — no duplicated catalog. Presentation differs
 * per group (kit shelf, open rows, field-notes document) so the page reads
 * as a toolbox being opened rather than a database listing: no dominant
 * group, no ranking, no card wall.
 */
export function ToolboxGroups() {
  const groups = resolveToolboxGroups();
  return (
    <section className="container-nest py-12 sm:py-16" aria-labelledby="toolbox-groups-heading">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 flex justify-center" aria-hidden>
          <ModularMark />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">The toolbox</p>
        <h2 id="toolbox-groups-heading" className="font-display mt-2 text-2xl font-normal tracking-tight sm:text-3xl">
          Tools for the work behind esports.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Focused tools, not an all-in-one platform. Pick one for tonight&apos;s job — use what you
          need, skip the rest.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-4xl space-y-10">
        {groups.map((group) => {
          if (group.label === "Run the tournament") return <RunTheTournamentKit key={group.label} group={group} />;
          if (group.label === "Understand the game") return <MetaParserFieldNotes key={group.label} group={group} />;
          return <OpenToolRows key={group.label} group={group} />;
        })}
      </div>
    </section>
  );
}
