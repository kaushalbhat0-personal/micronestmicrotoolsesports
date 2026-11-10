"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { grantPlatformAdminAction, revokePlatformAdminAction } from "@/server/admin/superadmin-actions";

export function GrantAdminForm() {
  const [userId, setUserId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const res = await grantPlatformAdminAction(userId.trim(), reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setStatus(res.idempotent ? "Already a platform admin (idempotent)." : "Platform admin granted and audited.");
      setConfirming(false);
      setUserId("");
      setReason("");
    }
  }

  return (
    <div className="space-y-2">
      {!confirming ? (
        <form
          className="grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setStatus(null);
            setConfirming(true);
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="grant-user-id">User ID (existing profile)</Label>
            <Input id="grant-user-id" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="uuid" required aria-label="User ID to grant" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="grant-reason">Reason (required, audited)</Label>
            <Input id="grant-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this grant needed?" maxLength={500} required minLength={5} aria-label="Grant reason" />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={userId.trim().length < 8 || reason.trim().length < 5} className="min-h-[44px]">
              Review grant
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-[12px] border border-border bg-surface-muted/40 p-3" role="alertdialog" aria-label="Confirm grant platform admin">
          <p className="text-sm font-medium">Confirm grant</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{userId.trim()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Reason: {reason.trim()}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleConfirm} disabled={busy} className="min-h-[44px] flex-1">
              {busy ? "Granting…" : "Confirm grant"}
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

export function RevokeAdminButton({ userId, email }: { userId: string; email: string | null }) {
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    const res = await revokePlatformAdminAction(userId, reason);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setStatus("Platform admin revoked and audited.");
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" className="min-h-[44px]" onClick={() => setConfirming(true)} aria-label={`Revoke platform admin ${email ?? userId}`}>
        Revoke
      </Button>
    );
  }

  return (
    <div className="rounded-[12px] border border-border p-3" role="alertdialog" aria-label={`Confirm revoke ${email ?? userId}`}>
      <Label htmlFor={`revoke-reason-${userId}`}>Reason (required, audited)</Label>
      <Input
        id={`revoke-reason-${userId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this revocation needed?"
        maxLength={500}
        minLength={5}
        aria-label="Revocation reason"
      />
      <div className="mt-2 flex gap-2">
        <Button onClick={handleConfirm} disabled={busy || reason.trim().length < 5} variant="destructive" className="min-h-[44px] flex-1">
          {busy ? "Revoking…" : "Confirm revoke"}
        </Button>
        <Button onClick={() => setConfirming(false)} disabled={busy} variant="outline" className="min-h-[44px] flex-1">
          Cancel
        </Button>
      </div>
      {status && (
        <p className="mt-2 text-xs font-medium text-green-700" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
