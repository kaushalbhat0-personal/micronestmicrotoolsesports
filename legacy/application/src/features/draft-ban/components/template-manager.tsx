"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UpgradeCTA } from "@/components/freemium/upgrade-cta";
import { createTemplateAction, deleteTemplateAction, renameTemplateAction } from "../actions/template-actions";
import type { DraftTemplate } from "@/types/database";

export function TemplateManager({
  orgSlug,
  templates,
  customUsed,
  customMax,
  accessLevel,
  canCreate,
}: {
  orgSlug: string;
  templates: readonly DraftTemplate[];
  /** Custom templates used (starter templates excluded). Resolved server-side. */
  customUsed: number;
  /** Custom-template allowance for this workspace (Free 3, paid 20). Resolved server-side. */
  customMax: number;
  accessLevel: "free" | "paid";
  canCreate: boolean;
}) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [limited, setLimited] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [renaming, setRenaming] = React.useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = React.useState<{ id: string; name: string } | null>(null);

  async function create() {
    setError(null);
    setLimited(false);
    setPending(true);
    try {
      // New templates start from the Standard Veto shape; edit sequence later via match snapshots.
      const result = await createTemplateAction({
        orgSlug,
        name: name.trim(),
        config: {
          sequence: [
            { team: "A", type: "ban" },
            { team: "B", type: "ban" },
            { team: "A", type: "ban" },
            { team: "B", type: "ban" },
            { team: "A", type: "pick" },
            { team: "B", type: "pick" },
          ],
          pool: [],
          teamA: null,
          teamB: null,
        },
      });
      if (result.error) {
        setError(result.error);
        setLimited(result.templateLimited === true);
      } else setName("");
    } finally {
      setPending(false);
    }
  }

  const atCap = !canCreate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Workspace draft setups ({customUsed} of {customMax} custom templates used)
        </CardTitle>
        <CardDescription>
          Renaming or deleting a setup never changes matches already created from it. The Standard Veto starter never counts toward your limit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
            {error}
          </p>
        )}
        {(limited || (atCap && accessLevel === "free")) && (
          <div className="space-y-2 rounded-[12px] border border-border p-3">
            <p className="text-sm text-muted-foreground">
              {accessLevel === "free"
                ? `Free workspaces include ${customMax} custom templates. Delete a custom setup to free a slot, or upgrade to raise the limit.`
                : `You've reached the workspace limit of ${customMax} custom templates.`}
            </p>
            {accessLevel === "free" && (
              <UpgradeCTA
                href={`/dashboard/${orgSlug}/settings/billing`}
                label="Upgrade to raise the template limit"
                ariaLabel="Upgrade to raise the custom template limit"
              />
            )}
          </div>
        )}
        {canCreate && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="template-name">New setup name</Label>
              <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Saturday BO3 veto" autoComplete="off" />
            </div>
            <Button onClick={create} loading={pending} disabled={!name.trim()} className="min-h-[44px] sm:self-end">
              Create setup
            </Button>
          </div>
        )}
        <ul className="space-y-2" aria-label="Manage draft setups">
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
              {t.is_starter && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted-foreground">Starter</span>
              )}
              <span className="text-xs text-muted-foreground">{t.config.sequence.length} steps</span>
              <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setRenaming({ id: t.id, name: t.name })} aria-label={`Rename ${t.name}`}>
                Rename
              </Button>
              <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setDeleting({ id: t.id, name: t.name })} aria-label={`Delete ${t.name}`}>
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
          <DialogContent onClose={() => setRenaming(null)}>
            <DialogHeader>
              <DialogTitle>Rename setup</DialogTitle>
              <DialogDescription>Existing matches keep their own copies.</DialogDescription>
            </DialogHeader>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input value={renaming?.name ?? ""} onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))} maxLength={60} aria-label="Template name" />
              <Button
                className="min-h-[44px]"
                onClick={async () => {
                  if (!renaming) return;
                  const result = await renameTemplateAction({ orgSlug, templateId: renaming.id, name: renaming.name });
                  if (result.error) setError(result.error);
                  else setRenaming(null);
                }}
              >
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
          <DialogContent onClose={() => setDeleting(null)}>
            <DialogHeader>
              <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
              <DialogDescription>Matches already created from this template keep working. Deleting a custom setup frees its slot. This cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setDeleting(null)} className="min-h-[44px]">
                Keep
              </Button>
              <Button
                variant="destructive"
                className="min-h-[44px]"
                onClick={async () => {
                  if (!deleting) return;
                  const result = await deleteTemplateAction({ orgSlug, templateId: deleting.id });
                  if (result.error) setError(result.error);
                  else setDeleting(null);
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
