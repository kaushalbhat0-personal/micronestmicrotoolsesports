import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FinderPublicPlayerRow } from "../repositories/finder";
import { VerificationBadge } from "./verification-badge";

/**
 * Finder — directory player card. Mobile-first: vertical stack, large
 * touch target (whole card links), no tables, no horizontal overflow.
 * Renders only masked-projection fields — no PII possible by construction.
 */
export function PlayerCard({ player }: { player: FinderPublicPlayerRow }) {
  return (
    <Link
      href={`/players/${player.handle}` as Route}
      className="block rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-label={`View ${player.display_name} (@${player.handle})`}
    >
      <Card className="h-full transition-colors hover:border-primary/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{player.display_name}</p>
              <p className="truncate text-sm text-muted-foreground">@{player.handle}</p>
            </div>
            <VerificationBadge verified={player.bgmi_verified} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{player.primary_role}</Badge>
            <Badge variant="outline">{player.current_level} → {player.target_level}</Badge>
            <Badge variant="outline">{player.region}</Badge>
            {player.looking_for && <Badge variant="info">Looking for team</Badge>}
            {player.open_to_tryout && <Badge variant="outline">Open to tryout</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            IGN {player.ign} · ID {player.character_id_masked}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
