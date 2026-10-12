"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PayoutCurrency, PayoutRecipientRow, PayoutTrackerStatus } from "../types";
import { formatMinor } from "../services/totals";
import { formatMaskedReference, formatPaidDate } from "../services/deadline";
import {
  addRecipientAction,
  removeRecipientAction,
  setRecipientStatusAction,
  updateRecipientAction,
} from "../actions/recipient-actions";
import { RecipientStatusBadge } from "./status-badges";

/**
 * Prize Payout Tracker — recipient table + add/edit/toggle (client).
 * Paid/pending toggles are one click; the server derives published/completed
 * atomically. Proof links render as plain outbound anchors, never embedded.
 */
export function RecipientManager({
  orgSlug,
  trackerId,
  trackerStatus,
  currency,
  initialRecipients,
  recipientCap,
}: {
  orgSlug: string;
  trackerId: string;
  trackerStatus: PayoutTrackerStatus;
  currency: PayoutCurrency;
  initialRecipients: PayoutRecipientRow[];
  recipientCap: number;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const [newName, setNewName] = React.useState("");
  const [newAmount, setNewAmount] = React.useState("");
  const [newRef, setNewRef] = React.useState("");
  const [newProof, setNewProof] = React.useState("");

  const [editName, setEditName] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editRef, setEditRef] = React.useState("");
  const [editProof, setEditProof] = React.useState("");

  const canToggle = trackerStatus === "published" || trackerStatus === "completed";

  async function run(id: string | null, fn: () => Promise<{ error?: string }>) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fn();
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onToggle(recipient: PayoutRecipientRow) {
    await run(recipient.id, () =>
      setRecipientStatusAction({
        orgSlug,
        trackerId,
        recipientId: recipient.id,
        status: recipient.status === "paid" ? "pending" : "paid",
      }),
    );
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newName.trim() === "" || newAmount.trim() === "") {
      setError("Enter a name and an amount greater than 0.");
      return;
    }
    await run("new", () =>
      addRecipientAction({
        orgSlug,
        trackerId,
        name: newName.trim(),
        amountMajor: Number(newAmount),
        referenceLast4: newRef === "" ? undefined : newRef,
        proofUrl: newProof === "" ? undefined : newProof,
      }).then((res) => {
        if (!res.error) {
          setNewName("");
          setNewAmount("");
          setNewRef("");
          setNewProof("");
        }
        return res;
      }),
    );
  }

  function startEdit(recipient: PayoutRecipientRow) {
    setEditingId(recipient.id);
    setEditName(recipient.recipient_name);
    setEditAmount(String(recipient.amount_minor / 100));
    setEditRef(recipient.reference_last4 ?? "");
    setEditProof(recipient.proof_url ?? "");
    setError(null);
  }

  async function onSaveEdit(recipient: PayoutRecipientRow) {
    await run(recipient.id, () =>
      updateRecipientAction({
        orgSlug,
        trackerId,
        recipientId: recipient.id,
        name: editName.trim(),
        amountMajor: Number(editAmount),
        referenceLast4: editRef,
        proofUrl: editProof,
      }).then((res) => {
        if (!res.error) setEditingId(null);
        return res;
      }),
    );
  }

  async function onRemove(recipient: PayoutRecipientRow) {
    if (!window.confirm(`Remove ${recipient.recipient_name} from this tracker?`)) return;
    await run(recipient.id, () => removeRecipientAction({ orgSlug, trackerId, recipientId: recipient.id }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recipients</CardTitle>
        <CardDescription>
          {initialRecipients.length} of {recipientCap} on your plan.
          {canToggle ? " Toggle paid status as payouts happen." : " Publish the tracker to start marking payouts."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRecipients.map((r) => (
              <React.Fragment key={r.id}>
                <TableRow>
                  <TableCell className="font-medium">
                    {r.recipient_name}
                    {r.paid_at ? <span className="block text-xs font-normal text-muted-foreground">Paid {formatPaidDate(r.paid_at)}</span> : null}
                    {r.proof_url ? (
                      <a
                        href={r.proof_url}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="block text-xs text-primary underline underline-offset-4"
                      >
                        View proof
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{formatMinor(r.amount_minor, currency)}</TableCell>
                  <TableCell>
                    <RecipientStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatMaskedReference(r.reference_last4) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canToggle ? (
                        <Button
                          type="button"
                          variant={r.status === "paid" ? "outline" : "default"}
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => onToggle(r)}
                          className="min-h-[44px]"
                        >
                          {r.status === "paid" ? "Mark pending" : "Mark paid"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => (editingId === r.id ? setEditingId(null) : startEdit(r))}
                        className="min-h-[44px]"
                      >
                        {editingId === r.id ? "Cancel" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => onRemove(r)}
                        aria-label={`Remove ${r.recipient_name}`}
                        className="min-h-[44px]"
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {editingId === r.id ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <Label htmlFor={`edit-name-${r.id}`}>Name</Label>
                          <Input id={`edit-name-${r.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={60} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`edit-amount-${r.id}`}>Amount</Label>
                          <Input id={`edit-amount-${r.id}`} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} inputMode="decimal" />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`edit-ref-${r.id}`}>Last 4 of UTR / reference (optional)</Label>
                          <Input
                            id={`edit-ref-${r.id}`}
                            value={editRef}
                            onChange={(e) => setEditRef(e.target.value)}
                            maxLength={4}
                            placeholder="Leave blank to clear"
                            autoComplete="off"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor={`edit-proof-${r.id}`}>Proof link, https only (optional)</Label>
                          <Input
                            id={`edit-proof-${r.id}`}
                            value={editProof}
                            onChange={(e) => setEditProof(e.target.value)}
                            maxLength={500}
                            placeholder="https://…"
                            inputMode="url"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <Button type="button" size="sm" disabled={busyId === r.id} onClick={() => onSaveEdit(r)} className="min-h-[44px]">
                            Save changes
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
            {initialRecipients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No recipients yet — add the first one below.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>

        {initialRecipients.length < recipientCap ? (
          <form onSubmit={onAdd} aria-label="Add recipient" className="grid gap-3 rounded-[12px] border border-border p-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-recipient-name">Name</Label>
              <Input id="new-recipient-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} placeholder="Team Charlie" autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-recipient-amount">Amount</Label>
              <Input id="new-recipient-amount" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} inputMode="decimal" placeholder="20000" autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-recipient-ref">Last 4 of UTR / reference (optional)</Label>
              <Input id="new-recipient-ref" value={newRef} onChange={(e) => setNewRef(e.target.value)} maxLength={4} placeholder="e.g. 8X2Q" autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-recipient-proof">Proof link, https only (optional)</Label>
              <Input id="new-recipient-proof" value={newProof} onChange={(e) => setNewProof(e.target.value)} maxLength={500} placeholder="https://…" inputMode="url" autoComplete="off" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="outline" size="sm" disabled={busyId === "new"} className="min-h-[44px]">
                Add recipient
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Recipient limit reached for your plan.</p>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
