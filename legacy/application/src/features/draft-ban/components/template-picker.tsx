import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate } from "lucide-react";
import type { DraftTemplate } from "@/types/database";

export function TemplatePicker({ orgSlug, templates }: { orgSlug: string; templates: readonly DraftTemplate[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4" aria-hidden /> Select a draft setup
        </CardTitle>
        <CardDescription>Draft setups set the ban-and-pick order. The match keeps its own copy.</CardDescription>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No draft setups yet. Create one below, or start with Standard Veto.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Workspace draft setups">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-card px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.config.sequence.length} steps <Badge variant="secondary" className="ml-1">{t.config.pool.length > 0 ? `${t.config.pool.length} items` : "no preset pool"}</Badge>
                  </p>
                </div>
                <Link href={`/dashboard/${orgSlug}/draft-ban/new?template=${t.id}` as Route}>
                  <Button size="sm" className="min-h-[44px] shrink-0">
                    Use setup
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Link href={`/dashboard/${orgSlug}/draft-ban/new` as Route}>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              Start with Standard Veto
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
