"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type RemovedTeam, type WorkingTeam } from "../types";

/**
 * Working roster: slot-ordered team cards with player ordering, add/remove,
 * and a quarantine area for removed teams (restore path included).
 * Long names wrap (never truncate); move controls are plain buttons.
 */
export function RosterTeamList({
  teams,
  removed,
  capacity,
  onMoveTeamUp,
  onMoveTeamDown,
  onMovePlayerUp,
  onMovePlayerDown,
  onAddTeam,
  onRemoveTeam,
  onRestoreTeam,
}: {
  teams: ReadonlyArray<WorkingTeam>;
  removed: ReadonlyArray<RemovedTeam>;
  capacity: number;
  onMoveTeamUp: (teamKey: string) => void;
  onMoveTeamDown: (teamKey: string) => void;
  onMovePlayerUp: (teamKey: string, rowId: string) => void;
  onMovePlayerDown: (teamKey: string, rowId: string) => void;
  /** Returns true when the team was added. */
  onAddTeam: (name: string) => boolean;
  onRemoveTeam: (teamKey: string) => void;
  onRestoreTeam: (teamKey: string) => void;
}) {
  const [newTeamName, setNewTeamName] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);

  function submitAddTeam(event: React.FormEvent) {
    event.preventDefault();
    if (newTeamName.trim() === "") {
      setAddError("Enter a team name.");
      return;
    }
    if (!onAddTeam(newTeamName)) {
      setAddError("That team is already in the roster.");
      return;
    }
    setNewTeamName("");
    setAddError(null);
  }

  return (
    <section aria-label="Working roster" className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {teams.map((team, teamIndex) => {
          const overCapacity = team.players.length > capacity;
          const isFirst = teamIndex === 0;
          const isLast = teamIndex === teams.length - 1;
          return (
            <Card key={team.teamKey}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden>
                    {teamIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words" title={team.teamDisplay}>
                    {team.teamDisplay}
                  </span>
                  <Badge variant={overCapacity ? "destructive" : "secondary"}>
                    <Users className="h-3 w-3" aria-hidden />
                    <span>
                      {team.players.length}/{capacity}
                    </span>
                  </Badge>
                </CardTitle>
                {overCapacity ? (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    Over capacity — move or drop {team.players.length - capacity}{" "}
                    {team.players.length - capacity === 1 ? "player" : "players"}, or raise the team size.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => onMoveTeamUp(team.teamKey)}
                    disabled={isFirst}
                    aria-label={`Move ${team.teamDisplay} up`}
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden />
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => onMoveTeamDown(team.teamKey)}
                    disabled={isLast}
                    aria-label={`Move ${team.teamDisplay} down`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden />
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-[44px] text-destructive hover:text-destructive"
                    onClick={() => onRemoveTeam(team.teamKey)}
                    aria-label={`Remove ${team.teamDisplay} (players kept for restore)`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Remove
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {team.players.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No players yet — paste more rows or move players here.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {team.players.map((player, playerIndex) => (
                      <li
                        key={player.rowId}
                        className="flex items-center gap-2 rounded-[10px] border border-border/60 bg-surface-muted/40 px-3 py-2"
                      >
                        <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground" aria-hidden>
                          {playerIndex + 1}.
                        </span>
                        <span className="min-w-0 flex-1 break-words text-sm" title={player.playerDisplay}>
                          {player.playerDisplay}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 min-h-[36px] min-w-[36px] !px-0"
                            onClick={() => onMovePlayerUp(team.teamKey, player.rowId)}
                            disabled={playerIndex === 0}
                            aria-label={`Move ${player.playerDisplay} up`}
                          >
                            <ArrowUp className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 min-h-[36px] min-w-[36px] !px-0"
                            onClick={() => onMovePlayerDown(team.teamKey, player.rowId)}
                            disabled={playerIndex === team.players.length - 1}
                            aria-label={`Move ${player.playerDisplay} down`}
                          >
                            <ArrowDown className="h-4 w-4" aria-hidden />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden />
            Add a team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitAddTeam} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="roster-new-team">Team name</Label>
              <Input
                id="roster-new-team"
                value={newTeamName}
                onChange={(event) => {
                  setNewTeamName(event.target.value);
                  setAddError(null);
                }}
                placeholder="Delta Force"
                maxLength={120}
                aria-describedby={addError ? "roster-new-team-error" : undefined}
                aria-invalid={addError !== null}
                className="mt-2"
              />
              {addError ? (
                <p id="roster-new-team-error" role="alert" className="mt-2 text-xs text-destructive">
                  {addError}
                </p>
              ) : null}
            </div>
            <Button type="submit" variant="secondary" className="min-h-[44px] shrink-0">
              <Plus className="h-4 w-4" aria-hidden />
              Add team
            </Button>
          </form>
        </CardContent>
      </Card>

      {removed.length > 0 ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-sm">Removed teams — nothing discarded</CardTitle>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Removed players wait here. Restore the team, or edit the source text above for surgical fixes.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {removed.map((entry) => (
                <li
                  key={entry.teamKey}
                  className="flex flex-col gap-2 rounded-[12px] border border-border bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 break-words text-sm">
                    <strong className="font-semibold">{entry.teamDisplay}</strong>{" "}
                    <span className="text-muted-foreground">
                      ({entry.players.length} {entry.players.length === 1 ? "player" : "players"}:{" "}
                      {entry.players.map((p) => p.playerDisplay).join(", ") || "none"})
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] shrink-0"
                    onClick={() => onRestoreTeam(entry.teamKey)}
                    aria-label={`Restore ${entry.teamDisplay}`}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
