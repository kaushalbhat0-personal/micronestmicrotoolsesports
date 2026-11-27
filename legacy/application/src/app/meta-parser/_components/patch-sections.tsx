import * as React from "react";
import type { PublishedEntityGroup } from "@/features/meta-parser/repositories/reads";
import { formatGroupCounts, formatGroupTotal } from "../_lib/facts";
import { ChangeCard } from "./change-card";

/**
 * Grouped patch sections (RCCF-META-PARSER-UX-07, server-rendered, no JS).
 *
 * Fully generic: sections, labels, ordering, and filter shortcuts arrive as
 * props — no game branches anywhere in this file. Disclosure uses native
 * `<details>/<summary>` so expansion works keyboard-first with zero client
 * state; screen readers receive the entity name and counts as text whether
 * or not a group is expanded.
 */

export interface PatchSectionView {
  /** Stable section key (ordering + ids). */
  readonly key: string;
  /** Human-facing section label (e.g. "Heroes", "Gameplay"). */
  readonly label: string;
  /** Patch-global change count for this section (truthful across pages). */
  readonly changeCount: number;
  /** Patch-global entity count for this section (truthful across pages). */
  readonly groupCount: number;
  /** `?entity_type=` shortcut, or null when linking adds no value. */
  readonly filterHref: string | null;
  readonly groups: readonly PublishedEntityGroup[];
}

/** Open every group on small pages; otherwise open only the first group. */
const AUTO_EXPAND_GROUP_LIMIT = 4;

function sectionId(key: string): string {
  return `patch-section-${key}`;
}

export function PatchSections({ sections }: { sections: readonly PatchSectionView[] }) {
  const groupsOnPage = sections.reduce((n, s) => n + s.groups.length, 0);
  const expandAll = groupsOnPage <= AUTO_EXPAND_GROUP_LIMIT;
  return (
    <>
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={sectionId(section.key)} className="mt-8 first:mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={sectionId(section.key)} className="font-display text-xl font-normal tracking-tight">
              {section.filterHref ? (
                <a
                  href={section.filterHref}
                  className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.label}
                </a>
              ) : (
                section.label
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {section.groupCount.toLocaleString("en-US")}{" "}
              {section.groupCount === 1 ? "entity" : "entities"} ·{" "}
              {section.changeCount.toLocaleString("en-US")}{" "}
              {section.changeCount === 1 ? "change" : "changes"}
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {section.groups.map((group, groupIndex) => (
              <EntityGroup
                key={`${group.entityType}:${group.entityNormalized}`}
                group={group}
                sectionLabel={section.label}
                detailsId={`${section.key}-group-${groupIndex}`}
                open={expandAll || (section.key === sections[0]?.key && groupIndex === 0)}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function EntityGroup({
  group,
  sectionLabel,
  detailsId,
  open,
}: {
  group: PublishedEntityGroup;
  sectionLabel: string;
  detailsId: string;
  open: boolean;
}) {
  const breakdown = formatGroupCounts(group.counts);
  return (
    <details
      id={detailsId}
      open={open || undefined}
      className="min-w-0 rounded-[16px] border border-border"
    >
      <summary className="min-w-0 cursor-pointer list-none rounded-[16px] px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="min-w-0 break-words font-medium">{group.entityName}</h3>
          <span className="text-sm text-muted-foreground">{formatGroupTotal(group.counts.total)}</span>
        </span>
        {breakdown !== "" ? (
          <span className="mt-0.5 block min-w-0 break-words text-xs text-muted-foreground">{breakdown}</span>
        ) : null}
      </summary>
      <ol className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {group.changes.map((change) => (
          <li key={change.id} className="min-w-0">
            <ChangeCard change={change} sectionLabel={sectionLabel} hideEntityName />
          </li>
        ))}
      </ol>
    </details>
  );
}
