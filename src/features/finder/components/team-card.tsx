import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FinderPublicTeamRow } from "../repositories/finder";

/**
 * Finder — directory team card (Phase C). Mobile-first: vertical stack,
 * large touch target (whole card links), no tables, no overflow.
 * Renders only masked-projection fields — no private data possible.
 */
export function TeamCard({ team }: { team: FinderPublicTeamRow }) {
  return (
    <Link
      href={`/teams/${team.slug}` as Route}
      className="block rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`View ${team.name}`}
    >
      <Card className="h-full transition-colors hover:border-primary/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{team.name}</p>
              <p className="truncate text-sm text-muted-foreground">/teams/{team.slug}</p>
            </div>
            {team.recruiting ? (
              <Badge variant="info">Recruiting</Badge>
            ) : (
              <Badge variant="secondary">Not recruiting</Badge>
            )}
          </div>
          {team.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {team.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{team.current_level} → {team.target_level}</Badge>
            <Badge variant="outline">{team.region}</Badge>
            <Badge variant="secondary">{team.game.toUpperCase()}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
