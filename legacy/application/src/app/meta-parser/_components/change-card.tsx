import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { PublishedChange } from "@/features/meta-parser/repositories/reads";
import {
  categoryLabel,
  changeTypeBadgeVariant,
  changeTypeLabel,
  entityTypeLabel,
  humanizeAttribute,
} from "../_lib/facts";

/**
 * One patch change, reading order: who changed (entity + direction badge),
 * what changed (attribute/category context), useful context (description),
 * exact fact (old → new transition). Factual content is rendered verbatim —
 * only the hierarchy and labels are presentation.
 *
 * Grouped rendering (RCCF-META-PARSER-UX-07) passes `sectionLabel` (e.g.
 * "Gameplay") and `hideEntityName`: the section already conveys the entity
 * kind, so the technical kind half is dropped — and when the category merely
 * restates the entity kind (system/system), the human section label stands
 * in. `System · System` can therefore never render inside a section.
 */
export function ChangeCard({
  change,
  sectionLabel = null,
  hideEntityName = false,
}: {
  change: PublishedChange;
  sectionLabel?: string | null;
  hideEntityName?: boolean;
}) {
  const secondaryKind = sectionContextKind(change, sectionLabel);
  return (
    <article className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {hideEntityName ? null : <h3 className="font-medium">{change.entityName}</h3>}
        <Badge variant={changeTypeBadgeVariant(change.changeType)}>
          {changeTypeLabel(change.changeType)}
        </Badge>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {change.attribute ? (
          <p className="min-w-0 break-words text-sm font-medium text-foreground">{humanizeAttribute(change.attribute)}</p>
        ) : null}
        {secondaryKind !== "" ? (
          <p className="min-w-0 break-words text-xs text-muted-foreground">{secondaryKind}</p>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {change.description}
      </p>
      <ChangeTransition change={change} />
    </article>
  );
}

/**
 * Context line for a change. Without a section, the legacy technical pairing
 * (category · entity kind) renders. Inside a section, the entity-kind half is
 * redundant (the section heading states it); when the category label merely
 * duplicates the entity-kind label, the human section label stands in so a
 * bare technical bucket name never faces the user. Generic string logic —
 * no game branches.
 */
export function sectionContextKind(
  change: Pick<PublishedChange, "category" | "entityType">,
  sectionLabel: string | null | undefined
): string {
  const category = categoryLabel(change.category);
  const kind = entityTypeLabel(change.entityType);
  if (sectionLabel === null || sectionLabel === undefined || sectionLabel === "") {
    return [category, kind].filter((part) => part !== "").join(" · ");
  }
  if (category !== "" && category.toLowerCase() === kind.toLowerCase()) return sectionLabel;
  return category;
}

function ChangeTransition({ change }: { change: PublishedChange }) {
  const numeric =
    change.oldNumeric !== null &&
    change.oldNumeric !== undefined &&
    change.newNumeric !== null &&
    change.newNumeric !== undefined;
  const textual =
    !numeric &&
    change.oldText !== null &&
    change.oldText !== undefined &&
    change.oldText !== "" &&
    change.newText !== null &&
    change.newText !== undefined &&
    change.newText !== "";
  if (numeric) {
    const unit = change.unit ? ` ${change.unit}` : "";
    return (
      <p className="mt-2 font-mono text-[13px] text-foreground" aria-label={`Changed from ${change.oldNumeric} to ${change.newNumeric}`}>
        <span className="text-muted-foreground line-through decoration-destructive/60">{String(change.oldNumeric)}{unit}</span>
        <span aria-hidden> → </span>
        <span className="font-semibold">{String(change.newNumeric)}{unit}</span>
      </p>
    );
  }
  if (textual) {
    return (
      <p className="mt-2 text-[13px] text-foreground" aria-label={`Changed from ${change.oldText} to ${change.newText}`}>
        <span className="text-muted-foreground">{change.oldText}</span>
        <span aria-hidden> → </span>
        <span className="font-medium">{change.newText}</span>
      </p>
    );
  }
  return null;
}
