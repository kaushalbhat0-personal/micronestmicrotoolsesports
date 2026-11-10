"use client";

import * as React from "react";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RuleId } from "../types";
import { ruleDescription, ruleLabel } from "./rule-labels";

/**
 * Ordered ranking-rule editor. Up/down controls only — keyboard accessible
 * by default, no drag-and-drop. Points always stays first.
 */
export function RuleOrderEditor({
  order,
  onChange,
  roundLabel = "rounds",
  disabled = false,
}: {
  order: readonly RuleId[];
  onChange: (next: RuleId[]) => void;
  roundLabel?: "rounds" | "games";
  disabled?: boolean;
}) {
  function move(index: number, direction: -1 | 1) {
    const next = [...order];
    const target = index + direction;
    if (target < 1 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <Label id="rule-order-label">Ranking rules, in order</Label>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The first rule that separates a tied group determines their order. If teams remain tied, the next rule is
        applied. Points always stays first.
      </p>
      <ol aria-labelledby="rule-order-label" className="space-y-2">
        {order.map((rule, index) => (
          <li
            key={rule}
            className="flex items-center gap-3 rounded-[12px] border border-border bg-card p-3"
          >
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{ruleLabel(rule)}</span>
              <span className="block truncate text-xs text-muted-foreground">{ruleDescription(rule, roundLabel)}</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                disabled={disabled || index <= 1}
                onClick={() => move(index, -1)}
                aria-label={`Move ${ruleLabel(rule)} up`}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] min-w-[44px]"
                disabled={disabled || index >= order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${ruleLabel(rule)} down`}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        Current order: {order.map((r) => ruleLabel(r)).join(", ")}
      </p>
    </div>
  );
}
