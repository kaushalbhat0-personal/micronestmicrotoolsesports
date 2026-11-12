// Prize Pool Splitter runner (client). All computation is local: the form
// validates with the strict Zod schema, the pure engine distributes integer
// minor units, and nothing leaves the browser — no account, no uploads, no
// payments, no persistence. Validation failures render as an explained
// issue list; results render in an aria-live region with recalculate/reset.

"use client";

import { useId, useMemo, useState } from "react";
import {
  MAX_PAYOUT_ROWS,
  SUPPORTED_TOOL_CURRENCIES,
  prizePoolFormSchema,
  toParsedPrizePool,
  type ToolCurrency,
} from "@/features/tools/prize-pool/schema";
import {
  distributePrizePool,
  ordinalLabel,
} from "@/features/tools/prize-pool/distribution";
import { buildResultSummary, formatToolMoney } from "@/features/tools/format";

interface RunnerRow {
  id: number;
  position: string;
  mode: "fixed" | "percent";
  amount: string;
  percent: string;
}

interface RunnerResult {
  totalMinor: number;
  currency: ToolCurrency;
  shares: Array<{ position: number; amountMinor: number }>;
  distributedMinor: number;
  unallocatedMinor: number;
  summary: string;
}

const DEFAULT_ROWS: ReadonlyArray<Omit<RunnerRow, "id">> = [
  { position: "1", mode: "percent", amount: "", percent: "50" },
  { position: "2", mode: "percent", amount: "", percent: "30" },
  { position: "3", mode: "percent", amount: "", percent: "20" },
];

let nextId = 1;
function withIds(rows: ReadonlyArray<Omit<RunnerRow, "id">>): RunnerRow[] {
  return rows.map((row) => ({ ...row, id: nextId++ }));
}

function Labelled({
  htmlFor,
  label,
  children,
  error,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
  error?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error !== undefined ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-accent-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PrizePoolRunner() {
  const uid = useId();
  const [total, setTotal] = useState("100000");
  const [currency, setCurrency] = useState<ToolCurrency>("INR");
  const [rows, setRows] = useState<RunnerRow[]>(() => withIds(DEFAULT_ROWS));
  const [issues, setIssues] = useState<string[]>([]);
  const [result, setResult] = useState<RunnerResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const totalId = `${uid}-total`;
  const currencyId = `${uid}-currency`;

  const fieldErrors = useMemo(() => {
    const parsed = prizePoolFormSchema.safeParse({
      total,
      currency,
      rows: rows.map((row) => ({
        position: row.position,
        mode: row.mode,
        amount: row.amount,
        percent: row.percent,
      })),
    });
    if (parsed.success) {
      return new Map<string, string>();
    }
    const map = new Map<string, string>();
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!map.has(key)) {
        map.set(key, issue.message);
      }
    }
    return map;
  }, [total, currency, rows]);

  function updateRow(id: number, patch: Partial<RunnerRow>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setResult(null);
  }

  function removeRow(id: number): void {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
    setResult(null);
  }

  function addRow(): void {
    setRows((current) => {
      if (current.length >= MAX_PAYOUT_ROWS) {
        return current;
      }
      const used = new Set(current.map((row) => Number(row.position)));
      let position = 1;
      while (used.has(position)) {
        position += 1;
      }
      return [...current, { id: nextId++, position: String(position), mode: "percent", amount: "", percent: "" }];
    });
    setResult(null);
  }

  function calculate(): void {
    setCopied(false);
    const parsed = prizePoolFormSchema.safeParse({
      total,
      currency,
      rows: rows.map((row) => ({
        position: row.position,
        mode: row.mode,
        amount: row.amount,
        percent: row.percent,
      })),
    });
    if (!parsed.success) {
      setIssues(parsed.error.issues.map((issue) => {
        const at = issue.path.length > 0 ? ` (${issue.path.join(" · ")})` : "";
        return `${issue.message}${at}`;
      }));
      setResult(null);
      return;
    }
    const model = toParsedPrizePool(parsed.data);
    if (model === null) {
      setIssues(["Could not parse the inputs. Check each field and try again."]);
      setResult(null);
      return;
    }
    const distribution = distributePrizePool(model);
    setIssues([]);
    setResult({
      totalMinor: distribution.totalMinor,
      currency: distribution.currency,
      shares: [...distribution.shares],
      distributedMinor: distribution.distributedMinor,
      unallocatedMinor: distribution.unallocatedMinor,
      summary: buildResultSummary(distribution, "Prize Pool Splitter"),
    });
  }

  function reset(): void {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setTotal("100000");
    setCurrency("INR");
    setRows(withIds(DEFAULT_ROWS));
    setIssues([]);
    setResult(null);
    setCopied(false);
    setConfirmingReset(false);
  }

  async function copySummary(): Promise<void> {
    if (result === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled htmlFor={totalId} label="Total prize pool" error={fieldErrors.get("total")}>
          <input
            id={totalId}
            name="total"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            maxLength={16}
            value={total}
            onChange={(event) => {
              setTotal(event.target.value);
              setResult(null);
            }}
            aria-describedby={fieldErrors.get("total") ? `${totalId}-error` : undefined}
            aria-invalid={fieldErrors.has("total")}
            placeholder="100000"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
          />
        </Labelled>
        <Labelled htmlFor={currencyId} label="Currency">
          <select
            id={currencyId}
            name="currency"
            value={currency}
            onChange={(event) => {
              const value = event.target.value;
              setCurrency(value === "USD" ? "USD" : "INR");
              setResult(null);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
          >
            {SUPPORTED_TOOL_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Labelled>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">
          Payout rows ({rows.length}/{MAX_PAYOUT_ROWS})
        </legend>
        <ul className="mt-3 space-y-3">
          {rows.map((row, index) => {
            const rowBase = `rows.${index}`;
            const amountError = fieldErrors.get(`${rowBase}.amount`);
            const percentError = fieldErrors.get(`${rowBase}.percent`);
            const positionError = fieldErrors.get(`${rowBase}.position`);
            return (
              <li
                key={row.id}
                className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-[5rem_9rem_1fr_auto] sm:items-end"
              >
                <Labelled
                  htmlFor={`${uid}-pos-${row.id}`}
                  label="Position"
                  error={positionError}
                >
                  <input
                    id={`${uid}-pos-${row.id}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    value={row.position}
                    onChange={(event) => updateRow(row.id, { position: event.target.value })}
                    aria-describedby={positionError ? `${uid}-pos-${row.id}-error` : undefined}
                    aria-invalid={positionError !== undefined}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  />
                </Labelled>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-mode-${row.id}`} className="text-sm font-medium">
                    Split type
                  </label>
                  <select
                    id={`${uid}-mode-${row.id}`}
                    value={row.mode}
                    onChange={(event) =>
                      updateRow(row.id, {
                        mode: event.target.value === "fixed" ? "fixed" : "percent",
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                {row.mode === "fixed" ? (
                  <Labelled
                    htmlFor={`${uid}-amount-${row.id}`}
                    label="Amount"
                    error={amountError}
                  >
                    <input
                      id={`${uid}-amount-${row.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={16}
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                      aria-describedby={amountError ? `${uid}-amount-${row.id}-error` : undefined}
                      aria-invalid={amountError !== undefined}
                      placeholder="50000"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                    />
                  </Labelled>
                ) : (
                  <Labelled
                    htmlFor={`${uid}-percent-${row.id}`}
                    label="Percent of total"
                    error={percentError}
                  >
                    <input
                      id={`${uid}-percent-${row.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      maxLength={7}
                      value={row.percent}
                      onChange={(event) => updateRow(row.id, { percent: event.target.value })}
                      aria-describedby={percentError ? `${uid}-percent-${row.id}-error` : undefined}
                      aria-invalid={percentError !== undefined}
                      placeholder="25"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                    />
                  </Labelled>
                )}
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  aria-label={`Remove row for position ${row.position || "unknown"}`}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_PAYOUT_ROWS}
          className="mt-3 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add payout row
        </button>
      </fieldset>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={calculate}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Calculate breakdown
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label={confirmingReset ? "Confirm reset calculation" : "Reset calculation"}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          {confirmingReset ? "Confirm reset" : "Reset"}
        </button>
        {confirmingReset ? (
          <button
            type="button"
            onClick={() => setConfirmingReset(false)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Keep values
          </button>
        ) : null}
      </div>

      {issues.length > 0 ? (
        <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Check these fields</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {issues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div aria-live="polite" className="mt-4">
        {result !== null ? (
          <section aria-labelledby={`${uid}-results-heading`}>
            <h3 id={`${uid}-results-heading`} className="text-base font-semibold">
              Calculated breakdown
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Planning aid only — not a payment, transfer, or escrow.
            </p>
            <dl className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
              {result.shares.map((share) => (
                <div key={share.position} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-sm font-medium">{ordinalLabel(share.position)}</dt>
                  <dd className="text-sm font-semibold">
                    {formatToolMoney(share.amountMinor, result.currency)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-slate-600">
              Distributed {formatToolMoney(result.distributedMinor, result.currency)} of{" "}
              {formatToolMoney(result.totalMinor, result.currency)} · Unallocated{" "}
              {formatToolMoney(result.unallocatedMinor, result.currency)}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
              {result.summary}
            </pre>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copySummary}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Copy summary
              </button>
              {copied ? (
                <p role="status" className="text-xs font-medium text-emerald-700">
                  Copied to clipboard.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
