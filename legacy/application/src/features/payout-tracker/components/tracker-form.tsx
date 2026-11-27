"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYOUT_CURRENCIES, type PayoutCurrency } from "../types";
import { createTrackerAction } from "../actions/tracker-actions";

interface RecipientDraft {
  name: string;
  amount: string;
}

/**
 * Prize Payout Tracker — single creation form (no wizard).
 * Event + currency + optional deadline + inline recipient rows.
 * Starts with 3 blank rows; the server enforces Free/Paid caps.
 */
export function TrackerForm({ orgSlug, recipientCap }: { orgSlug: string; recipientCap: number }) {
  const router = useRouter();
  const [eventName, setEventName] = React.useState("");
  const [currency, setCurrency] = React.useState<PayoutCurrency>("INR");
  const [deadline, setDeadline] = React.useState("");
  const [rows, setRows] = React.useState<RecipientDraft[]>([
    { name: "", amount: "" },
    { name: "", amount: "" },
    { name: "", amount: "" },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function setRow(index: number, patch: Partial<RecipientDraft>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => (prev.length >= recipientCap ? prev : [...prev, { name: "", amount: "" }]));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const recipients = rows
      .filter((r) => r.name.trim() !== "" || r.amount.trim() !== "")
      .map((r) => ({ name: r.name.trim(), amountMajor: Number(r.amount) }));
    if (recipients.length === 0) {
      setError("Add at least one recipient with a name and amount.");
      return;
    }
    for (const r of recipients) {
      if (r.name === "" || !Number.isFinite(r.amountMajor) || r.amountMajor <= 0) {
        setError("Each recipient needs a name and an amount greater than 0.");
        return;
      }
    }
    setSaving(true);
    try {
      const res = await createTrackerAction({
        orgSlug,
        eventName: eventName.trim(),
        currency,
        deadline: deadline === "" ? undefined : deadline,
        recipients,
      });
      if (res.error || !res.trackerId) {
        setError(res.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push((`/dashboard/${orgSlug}/payout-tracker/${res.trackerId}`) as Route);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-label="Create payout tracker">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event details</CardTitle>
            <CardDescription>What tournament is this payout list for?</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="event-name">Event / tournament name</Label>
              <Input
                id="event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                maxLength={80}
                required
                placeholder="Monsoon Cup 2026"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as PayoutCurrency)}>
                <SelectTrigger id="currency" aria-label="Currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYOUT_CURRENCIES) as PayoutCurrency[]).map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} — {PAYOUT_CURRENCIES[code]?.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deadline">Payout deadline (optional)</Label>
              <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recipients</CardTitle>
            <CardDescription>
              Who should be paid, and how much. Up to {recipientCap} on your plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={`recipient-name-${i}`}>Name</Label>
                  <Input
                    id={`recipient-name-${i}`}
                    value={row.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                    maxLength={60}
                    placeholder="Team Alpha"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`recipient-amount-${i}`}>Amount</Label>
                  <Input
                    id={`recipient-amount-${i}`}
                    value={row.amount}
                    onChange={(e) => setRow(i, { amount: e.target.value })}
                    inputMode="decimal"
                    placeholder="50000"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  aria-label={`Remove recipient row ${i + 1}`}
                  className="min-h-[44px]"
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={rows.length >= recipientCap} className="min-h-[44px]">
                Add recipient
              </Button>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={saving} loading={saving} className="min-h-[44px]">
            Create tracker
          </Button>
        </div>
      </div>
    </form>
  );
}
