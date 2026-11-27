import * as React from "react";
import { ListOrdered, Settings2, Trophy, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    Icon: Settings2,
    title: "1. Set your rules",
    description: "Choose a starting setup and arrange the ranking rules in the order your competition uses.",
  },
  {
    Icon: Users,
    title: "2. Add teams",
    description: "Add the teams competing. You need at least 2 and can add up to 32.",
  },
  {
    Icon: Trophy,
    title: "3. Enter completed results",
    description: "Record each finished match. Standings update automatically after every result.",
  },
  {
    Icon: ListOrdered,
    title: "4. Review and lock",
    description: "Check every tie explanation, then finish and lock to create the official record.",
  },
];

/** Concise first-use guidance. No product tour, no jargon. */
export function FirstUseGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How it works</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Resolve tied standings using your chosen rules, explain every placement, and lock the official result.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {steps.map(({ Icon, title, description }) => (
            <li key={title} className="flex gap-3 rounded-[12px] border border-border bg-surface-muted/40 p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{description}</span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
