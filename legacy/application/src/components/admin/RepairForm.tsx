"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RepairFormProps {
  id: string;
  idLabel: string;
  actionLabel: string;
  destinationPreview: string;
  action: (id: string, reason: string, confirmed: boolean) => Promise<{ ok: boolean; error?: string; preview?: unknown; idempotent?: boolean }>;
}

/**
 * Generic audited repair form: reason (required) → preview → explicit confirm.
 * Shows destination-state preview before any mutation.
 */
export function RepairForm({ id, idLabel, actionLabel, destinationPreview, action }: RepairFormProps) {
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await action(id, reason, false);
      if (!res.ok) {
        setError(res.error ?? "Preview failed");
      } else {
        setPreview(JSON.stringify(res.preview ?? { destination: destinationPreview }, null, 2));
        setConfirming(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await action(id, reason, true);
      if (!res.ok) {
        setError(res.error ?? "Mutation failed");
      } else if (res.idempotent) {
        setStatus("Already applied — no state change (idempotent).");
        setConfirming(false);
      } else {
        setStatus("Applied and audited.");
        setConfirming(false);
        setPreview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mutation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!confirming ? (
        <form onSubmit={handlePreview} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor={`reason-${id}`}>Reason (required, audited)</Label>
            <Input
              id={`reason-${id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Operational reason for audit"
              maxLength={500}
              required
              minLength={5}
              aria-label={`${actionLabel} reason for ${idLabel}`}
            />
          </div>
          <Button type="submit" disabled={busy || reason.trim().length < 5} className="min-h-[44px]">
            {busy ? "Checking…" : `Preview ${actionLabel}`}
          </Button>
        </form>
      ) : (
        <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3" role="alertdialog" aria-label={`Confirm ${actionLabel}`}>
          <p className="text-sm font-medium">Confirm {actionLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {idLabel}: <span className="font-mono">{id.slice(0, 8)}…</span> → {destinationPreview}
          </p>
          {preview && <pre className="mt-2 max-h-40 overflow-auto rounded bg-card p-2 font-mono text-[11px] text-muted-foreground">{preview}</pre>}
          <div className="mt-3 flex gap-2">
            <Button onClick={handleConfirm} disabled={busy} variant="destructive" className="min-h-[44px] flex-1">
              {busy ? "Applying…" : `Confirm ${actionLabel}`}
            </Button>
            <Button onClick={() => setConfirming(false)} disabled={busy} variant="outline" className="min-h-[44px] flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
      {status && (
        <p className="text-xs font-medium text-green-700" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
