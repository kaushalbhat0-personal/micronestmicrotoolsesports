import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FreePlanBadge } from "@/components/freemium/free-plan-badge";
import { toolWorkspaceRoute } from "@/lib/workspace/tool-intent";
import { ShieldCheck, Split, Swords, Scale, ReceiptText, ClipboardList } from "lucide-react";

export interface CatalogTool {
  readonly toolSlug: string;
  readonly displayName: string;
  readonly description: string;
  readonly icon: string;
  readonly freeBadge: "Free forever" | "Free plan" | null;
  readonly freeAllowance: string | null;
  readonly entitled: boolean;
  readonly claimable: boolean;
}

function ToolIcon({ icon }: { icon: string }) {
  if (icon === "Swords") return <Swords className="h-5 w-5 text-muted-foreground" aria-hidden />;
  if (icon === "Scale") return <Scale className="h-5 w-5 text-muted-foreground" aria-hidden />;
  if (icon === "Split") return <Split className="h-5 w-5 text-muted-foreground" aria-hidden />;
  if (icon === "ReceiptText") return <ReceiptText className="h-5 w-5 text-muted-foreground" aria-hidden />;
  if (icon === "ClipboardList") return <ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden />;
  return <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden />;
}

/**
 * Workspace tool catalog card (RCCF F3/F4). Discovery-first: every released
 * tool shows its canonical Free status; entitled tools open directly,
 * claimable tools route to the tool page where the inline Start-free
 * claim lives, and anything else points at Billing. No prices, no
 * checkout — Billing remains the only purchase surface.
 */
export function ToolCatalogCard({ tool, orgSlug }: { tool: CatalogTool; orgSlug: string }) {
  const openHref = toolWorkspaceRoute(orgSlug, tool.toolSlug);
  return (
    <Card className="border-border/60">
      <CardHeader>
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface-muted border border-border">
          <ToolIcon icon={tool.icon} />
        </span>
        <CardTitle className="text-base mt-3">{tool.displayName}</CardTitle>
        <CardDescription>{tool.description}</CardDescription>
        {tool.freeBadge && tool.freeAllowance ? (
          <p className="mt-2 text-sm">
            <FreePlanBadge label={tool.freeBadge} /> <span className="text-muted-foreground">{tool.freeAllowance}</span>
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {tool.entitled ? (
          <Link
            href={openHref as Route}
            aria-label={`Open ${tool.displayName}`}
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open {tool.displayName}
          </Link>
        ) : tool.claimable ? (
          <Link
            href={openHref as Route}
            aria-label={`Start ${tool.displayName} free`}
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start free
          </Link>
        ) : (
          <Link
            href={`/dashboard/${orgSlug}/settings/billing` as Route}
            aria-label={`View Billing for ${tool.displayName}`}
            className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View Billing
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
