"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TieBreakerTeamRow } from "@/server/repositories/tie-breaker-teams";
import { addTeamAction, removeTeamAction, updateTeamAction } from "../actions/team-actions";

/** Team roster for one competition. Counts and limits are presentational; the server enforces. */
export function TeamManager({
  orgSlug,
  competitionId,
  teams,
}: {
  orgSlug: string;
  competitionId: string;
  teams: readonly TieBreakerTeamRow[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<TieBreakerTeamRow | null>(null);
  const [editName, setEditName] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState<TieBreakerTeamRow | null>(null);

  async function refresh() {
    router.refresh();
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const result = await addTeamAction({ orgSlug, competitionId, name: trimmed, shortName: null, logoUrl: null });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(team: TieBreakerTeamRow) {
    setEditing(team);
    setEditName(team.name);
    setError(null);
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setError(null);
    setSaving(true);
    try {
      const result = await updateTeamAction({
        orgSlug,
        competitionId,
        teamId: editing.id,
        name: trimmed,
        shortName: editing.short_name,
        logoUrl: editing.logo_url,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirmDelete) return;
    setError(null);
    setSaving(true);
    try {
      const result = await removeTeamAction({ orgSlug, competitionId, teamId: confirmDelete.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Teams{" "}
          <span className="text-sm font-normal text-muted-foreground" aria-live="polite">
            {teams.length} of 32 teams
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
            {error}
          </p>
        )}

        <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row" aria-label="Add a team">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tb-team-name" className="sr-only">
              Team name
            </Label>
            <Input
              id="tb-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a team, for example Falcons"
              maxLength={60}
              disabled={saving || teams.length >= 32}
            />
          </div>
          <Button type="submit" loading={saving} disabled={!name.trim() || teams.length >= 32} className="min-h-[44px]">
            <Plus className="h-4 w-4" aria-hidden /> Add team
          </Button>
        </form>

        {teams.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="Add the teams competing in this competition"
            description="You need at least 2 teams before you can finish and lock the result."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Teams">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-2 rounded-[12px] border border-border bg-card p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => startEdit(team)}
                  aria-label={`Rename ${team.name}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] text-destructive"
                  onClick={() => setConfirmDelete(team)}
                  aria-label={`Remove ${team.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename team</DialogTitle>
            </DialogHeader>
            <form onSubmit={onEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tb-team-rename">Team name</Label>
                <Input id="tb-team-rename" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} required />
              </div>
              <div className="flex gap-2">
                <Button type="submit" loading={saving} className="min-h-[44px]">
                  Save
                </Button>
                <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" aria-hidden /> Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove {confirmDelete?.name}?</DialogTitle>
              <DialogDescription>
                This removes the team and its recorded results from this competition. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" loading={saving} className="min-h-[44px]" onClick={onDelete}>
                Remove team
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
