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
 */
export function ChangeCard({ change }: { change: PublishedChange }) {
  const secondaryKind = [categoryLabel(change.category), entityTypeLabel(change.entityType)]
    .filter((part) => part !== "")
    .join(" · ");
  return (
    <article className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{change.entityName}</h3>
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
