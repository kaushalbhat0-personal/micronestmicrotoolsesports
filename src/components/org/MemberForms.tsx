"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MemberRole } from "@/server/organizations/members";

type ActionResult = { ok: boolean; error?: string; idempotent?: boolean };

function useActionState() {
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  return { busy, setBusy, status, setStatus, error, setError };
}

function StatusLines({ status, error }: { status: string | null; error: string | null }) {
  return (
    <>
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
    </>
  );
}

export function AddMemberForm({
  orgSlug,
  canAssignAdmin,
  action,
}: {
  orgSlug: string;
  canAssignAdmin: boolean;
  action: (orgSlug: string, email: string, role: MemberRole) => Promise<ActionResult>;
}) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<MemberRole>("member");
  const s = useActionState();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    s.setBusy(true);
    s.setError(null);
    s.setStatus(null);
    try {
      const res = await action(orgSlug, email, role);
      if (!res.ok) s.setError(res.error ?? "Could not add member");
      else {
        s.setStatus(`${email.trim()} added as ${role}.`);
        setEmail("");
      }
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      s.setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="member-email" className="text-xs font-medium">
            Member email
          </Label>
          <Input
            id="member-email"
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="member-role" className="text-xs font-medium">
            Role
          </Label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="flex min-h-[44px] w-full rounded-[12px] border border-input bg-background px-3 text-sm"
          >
            <option value="member">Member</option>
            {canAssignAdmin && <option value="admin">Admin</option>}
          </select>
        </div>
        <Button type="submit" disabled={s.busy || email.trim().length < 3} className="min-h-[44px]">
          {s.busy ? "Adding…" : "Add member"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The account must already exist — ask them to sign up first. Ownership is never assigned here; use transfer below.
      </p>
      <StatusLines status={s.status} error={s.error} />
    </form>
  );
}

export function RoleChangeButtons({
  orgSlug,
  targetUserId,
  targetEmail,
  currentRole,
  action,
}: {
  orgSlug: string;
  targetUserId: string;
  targetEmail: string | null;
  currentRole: MemberRole;
  action: (orgSlug: string, targetUserId: string, role: MemberRole) => Promise<ActionResult>;
}) {
  const s = useActionState();
  const next: MemberRole = currentRole === "admin" ? "member" : "admin";

  async function onChange() {
    s.setBusy(true);
    s.setError(null);
    try {
      const res = await action(orgSlug, targetUserId, next);
      if (!res.ok) s.setError(res.error ?? "Could not change role");
      else s.setStatus(res.idempotent ? "Already in that role." : `Role updated to ${next}.`);
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Could not change role");
    } finally {
      s.setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={s.busy} onClick={onChange} aria-label={`Change ${targetEmail ?? "member"} to ${next}`}>
        {s.busy ? "Saving…" : currentRole === "admin" ? "Change to Member" : "Make Admin"}
      </Button>
      <StatusLines status={s.status} error={s.error} />
    </span>
  );
}

export function RemoveMemberButton({
  orgSlug,
  targetUserId,
  targetEmail,
  action,
}: {
  orgSlug: string;
  targetUserId: string;
  targetEmail: string | null;
  action: (orgSlug: string, targetUserId: string) => Promise<ActionResult>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const s = useActionState();

  async function onRemove() {
    s.setBusy(true);
    s.setError(null);
    try {
      const res = await action(orgSlug, targetUserId);
      if (!res.ok) {
        s.setError(res.error ?? "Could not remove member");
        setConfirming(false);
      } else {
        s.setStatus("Member removed.");
        setConfirming(false);
      }
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Could not remove member");
      setConfirming(false);
    } finally {
      s.setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)} aria-label={`Remove ${targetEmail ?? "member"}`}>
        Remove
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1" role="alertdialog" aria-label={`Confirm remove ${targetEmail ?? "member"}`}>
      <span className="inline-flex gap-2">
        <Button variant="destructive" size="sm" disabled={s.busy} onClick={onRemove}>
          {s.busy ? "Removing…" : "Confirm remove"}
        </Button>
        <Button variant="outline" size="sm" disabled={s.busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
      <StatusLines status={s.status} error={s.error} />
    </span>
  );
}

export function TransferOwnershipForm({
  orgSlug,
  candidates,
  action,
}: {
  orgSlug: string;
  candidates: Array<{ userId: string; email: string | null }>;
  action: (orgSlug: string, targetUserId: string) => Promise<ActionResult>;
}) {
  const [target, setTarget] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const s = useActionState();
  const selected = candidates.find((c) => c.userId === target);
  const canConfirm = selected && confirmText.trim().toUpperCase() === "TRANSFER";

  async function onTransfer() {
    if (!canConfirm) return;
    s.setBusy(true);
    s.setError(null);
    try {
      const res = await action(orgSlug, target);
      if (!res.ok) {
        s.setError(res.error ?? "Could not transfer ownership");
      } else {
        s.setStatus("Ownership transferred. You are now an admin.");
      }
      setConfirming(false);
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Could not transfer ownership");
    } finally {
      s.setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="transfer-target" className="text-xs font-medium">
            New owner
          </Label>
          <select
            id="transfer-target"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setConfirming(false);
              setConfirmText("");
            }}
            className="flex min-h-[44px] w-full rounded-[12px] border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a member…</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.email ?? "Unknown"} ({c.userId.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>
        <Button disabled={!selected || s.busy} onClick={() => setConfirming(true)} variant="destructive" className="min-h-[44px]">
          Transfer ownership
        </Button>
      </div>
      {confirming && selected && (
        <div className="rounded-[12px] border border-destructive/40 bg-destructive/5 p-3" role="alertdialog" aria-label="Confirm ownership transfer">
          <p className="text-sm font-medium">Transfer ownership to {selected.email ?? "selected member"}?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You will become an admin and lose owner powers. The new owner controls members, billing, and deletion. Type TRANSFER to confirm.
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type TRANSFER"
              maxLength={20}
              aria-label="Type TRANSFER to confirm"
              className="sm:max-w-[220px]"
            />
            <div className="flex gap-2">
              <Button disabled={!canConfirm || s.busy} onClick={onTransfer} variant="destructive" className="min-h-[44px]">
                {s.busy ? "Transferring…" : "Confirm transfer"}
              </Button>
              <Button variant="outline" disabled={s.busy} onClick={() => setConfirming(false)} className="min-h-[44px]">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      <StatusLines status={s.status} error={s.error} />
    </div>
  );
}

export function LeaveOrganizationButton({
  orgSlug,
  action,
}: {
  orgSlug: string;
  action: (orgSlug: string) => Promise<ActionResult>;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const s = useActionState();

  async function onLeave() {
    s.setBusy(true);
    s.setError(null);
    try {
      const res = await action(orgSlug);
      if (!res.ok) {
        s.setError(res.error ?? "Could not leave");
        setConfirming(false);
      } else {
        s.setStatus("You have left the organization.");
        setConfirming(false);
      }
    } catch (err) {
      s.setError(err instanceof Error ? err.message : "Could not leave");
      setConfirming(false);
    } finally {
      s.setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
        Leave organization
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1" role="alertdialog" aria-label="Confirm leave organization">
      <span className="inline-flex gap-2">
        <Button variant="destructive" size="sm" disabled={s.busy} onClick={onLeave}>
          {s.busy ? "Leaving…" : "Confirm leave"}
        </Button>
        <Button variant="outline" size="sm" disabled={s.busy} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
      <StatusLines status={s.status} error={s.error} />
    </span>
  );
}
