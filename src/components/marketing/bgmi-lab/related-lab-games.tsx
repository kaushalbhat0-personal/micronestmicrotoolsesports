import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/components/ui/badge";
import { toolIcon } from "@/components/marketing/tool-icon-map";
import type { BgmiLabTool } from "@/config/public/bgmi-lab";
import { getRelatedLabTools, isLabRoutableSlug } from "@/lib/marketing/public-tool-content";

/**
 * RelatedLabGames — same-category-first related games (max 3).
 * Only routable slugs become links; planned entries render as honest
 * non-link "Planned" rows so we never link to thin/404 pages.
 * Tournament Hub + Qualification Simulator links are preserved.
 */
export function RelatedLabGames({ tool }: { tool: BgmiLabTool }) {
  const related = getRelatedLabTools(tool.slug);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {related.map((rel) => {
        const Icon = toolIcon(rel.icon);
        const routable = isLabRoutableSlug(rel.slug);
        if (!routable) {
          return (
            <div key={rel.slug} className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                BGMI Lab · Planned
              </p>
              <p className="mt-1 text-sm font-medium">{rel.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rel.tagline}</p>
            </div>
          );
        }
        return (
          <Link
            key={rel.slug}
            href={`/bgmi-lab/${rel.slug}` as Route}
            className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50"
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              BGMI Lab
            </p>
            <p className="mt-1 text-sm font-medium">{rel.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rel.tagline}</p>
          </Link>
        );
      })}
      <Link href={"/bgmi-lab" as Route} className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">BGMI Lab</p>
        <p className="mt-1 text-sm font-medium">All practice drills</p>
      </Link>
      <Link
        href={(tool.relatedSimulatorHref ?? "/bgmi-qualification") as Route}
        className="rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Qualification Simulator</p>
        <p className="mt-1 text-sm font-medium">Plan your points target</p>
      </Link>
      <div className="sm:col-span-2">
        <Link
          href={(tool.relatedHubHref ?? "/bgmi-tournaments") as Route}
          className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card p-4 hover:bg-surface-muted/50"
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-primary">Tournament Hub</span>
            <span className="mt-1 block text-sm font-medium">See how real teams handle zones</span>
          </span>
          <Badge variant="outline">Free to read</Badge>
        </Link>
      </div>
    </div>
  );
}
