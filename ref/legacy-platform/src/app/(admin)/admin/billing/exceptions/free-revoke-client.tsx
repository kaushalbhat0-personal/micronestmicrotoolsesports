"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revokeFreeGrantAction } from "@/server/admin/superadmin-actions";

export function FreeRevokeClient() {
  const [entitlementId, setEntitlementId] = React.useState("");
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
    const res = await revokeFreeGrantAction(entitlementId.trim(), reason, false);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setPreview(JSON.stringify(res.preview ?? {}, null, 2));
      setConfirming(true);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const res = await revokeFreeGrantAction(entitlementId.trim(), reason, true);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setStatus("Free grant revoked and audited.");
      setConfirming(false);
      setPreview(null);
      setEntitlementId("");
      setReason("");
    }
  }

  return (
    <div className="space-y-3">
      {!confirming ? (
        <form onSubmit={handlePreview} className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="free-entitlement-id">Entitlement ID</Label>
            <Input id="free-entitlement-id" value={entitlementId} onChange={(e) => setEntitlementId(e.target.value)} placeholder="uuid" required aria-label="Free entitlement ID" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="free-revoke-reason">Reason (required, audited)</Label>
            <Input id="free-revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this Free grant erroneous?" maxLength={500} required minLength={5} aria-label="Revocation reason" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={busy || entitlementId.trim().length < 8 || reason.trim().length < 5} className="min-h-[44px]">
              {busy ? "Checking…" : "Preview revocation"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3" role="alertdialog" aria-label="Confirm free grant revocation">
          <p className="text-sm font-medium">Confirm Free-grant revocation</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{entitlementId.trim()} → revoked (expires immediately, row preserved)</p>
          {preview && <pre className="mt-2 max-h-40 overflow-auto rounded bg-card p-2 font-mono text-[11px] text-muted-foreground">{preview}</pre>}
          <div className="mt-3 flex gap-2">
            <Button onClick={handleConfirm} disabled={busy} variant="destructive" className="min-h-[44px] flex-1">
              {busy ? "Revoking…" : "Confirm revoke"}
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
