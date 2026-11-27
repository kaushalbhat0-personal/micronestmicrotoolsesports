// Public tool result card. Renders ONLY registry fields: name/slug link,
// tagline, category, compatibility, availability. No metrics, no scores,
// no endorsements, no usage statistics.

import Link from "next/link";
import type { ToolDefinition } from "@/features/tools/catalog";
import {
  ToolAvailabilityBadge,
  ToolCategoryBadge,
  toolCompatibilityLabel,
} from "./tool-bits";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  const headingId = `tool-${tool.slug}-name`;
  return (
    <article aria-labelledby={headingId} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={headingId} className="min-w-0 flex-1 text-base font-semibold">
          <Link
            href={`/tools/${tool.slug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {tool.name}
          </Link>
        </h3>
        <ToolAvailabilityBadge availability={tool.availability} />
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{tool.tagline}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToolCategoryBadge category={tool.category} />
        <span className="text-xs text-slate-500">
          {toolCompatibilityLabel(tool.gameKeys)} · v{tool.version}
        </span>
      </div>
    </article>
  );
}
