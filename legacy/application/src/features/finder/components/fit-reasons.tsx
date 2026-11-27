import { Badge } from "@/components/ui/badge";
import type { FitReason } from "../services/fit-reasons";

/**
 * Finder — factual fit reasons (Phase C). Renders explainable facts
 * (role / region / level / tryout / verification) with their evidence
 * source. Never a score, never a percentage.
 */
export function FitReasons({ reasons }: { reasons: FitReason[] }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Why this role may fit">
      {reasons.map((reason) => (
        <li key={reason.key} className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={reason.met ? "success" : "secondary"}>
            {reason.met ? "✓" : "•"} {reason.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {reason.source === "micronest-verified" ? "Micronest verified" : "Self-reported"}
          </span>
        </li>
      ))}
    </ul>
  );
}
