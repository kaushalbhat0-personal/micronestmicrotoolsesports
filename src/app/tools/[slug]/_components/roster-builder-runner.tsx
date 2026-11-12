// Roster & Slot Builder runner (client). All roster work happens locally in
// this browser session: the form validates through the strict Zod boundary,
// the pure domain module owns every rule, and nothing leaves the page — no
// account, no uploads, no lookups, no persistence. Validation failures show
// next to the control that caused them; roster state renders in aria-live
// regions with recalculate-free, always-current views.

"use client";

import { cloneElement, isValidElement, useId, useMemo, useState } from "react";
import {
  MAX_NOTES_LENGTH,
  rosterPlayerFormSchema,
} from "@/features/tools/roster/schema";
import {
  RosterError,
  addPlayer,
  assignPlayer,
  buildRosterSummary,
  configureSlots,
  createRoster,
  describeCompleteness,
  removePlayer,
  rosterRoleOptions,
  unassignPlayer,
  updatePlayer,
  type RosterState,
} from "@/features/tools/roster/roster";

type SlotSelectValue = `starter:${number}` | `substitute:${number}` | "bench";

function toSlotValue(assignment: { kind: string; index: number } | null): SlotSelectValue {
  if (assignment === null) {
    return "bench";
  }
  return `${assignment.kind as "starter" | "substitute"}:${assignment.index}`;
}

function Labelled({
  htmlFor,
  label,
  children,
  error,
  hint,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {error !== undefined && isValidElement(children)
        ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            "aria-describedby": `${htmlFor}-error`,
            "aria-invalid": true,
          })
        : children}
      {hint !== undefined && error === undefined ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-accent-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

export function RosterBuilderRunner() {
  const uid = useId();
  const [roster, setRoster] = useState<RosterState>(() =>
    createRoster({ gameKey: "bgmi", starterSlots: 4, substituteSlots: 2 }),
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [addErrors, setAddErrors] = useState<Map<string, string>>(new Map());
  const [addFailure, setAddFailure] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [role, setRole] = useState("Flexible");
  const [notes, setNotes] = useState("");
  const [target, setTarget] = useState<SlotSelectValue>("bench");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: "", playerId: "", role: "Flexible", notes: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [copied, setCopied] = useState(false);

  const completeness = useMemo(() => describeCompleteness(roster), [roster]);
  const summary = useMemo(() => buildRosterSummary(roster), [roster]);

  const slotOptions = useMemo(() => {
    const options: Array<{ value: SlotSelectValue; label: string }> = [{ value: "bench", label: "Bench (unassigned)" }];
    for (let i = 0; i < roster.config.starterSlots; i += 1) {
      options.push({ value: `starter:${i}`, label: `Starter ${i + 1}` });
    }
    for (let i = 0; i < roster.config.substituteSlots; i += 1) {
      options.push({ value: `substitute:${i}`, label: `Substitute ${i + 1}` });
    }
    return options;
  }, [roster.config.starterSlots, roster.config.substituteSlots]);

  // Domain ops run eagerly against the current state value (not inside a
  // React updater) so RosterError throws synchronously into this try/catch.
  function runOp(
    fn: (current: RosterState) => RosterState,
    onError: (message: string) => void,
    onSuccess?: () => void,
  ): void {
    try {
      const next = fn(roster);
      setRoster(next);
      setCopied(false);
      onSuccess?.();
    } catch (error) {
      onError(error instanceof RosterError ? error.message : "Something went wrong. Try again.");
    }
  }

  function changeConfig(patch: { starterSlots?: number; substituteSlots?: number; teamName?: string }): void {
    setConfigError(null);
    runOp((current) => configureSlots(current, patch), setConfigError);
  }

  function movePlayer(playerIdValue: string, value: SlotSelectValue): void {
    setSlotError(null);
    if (value === "bench") {
      runOp((current) => unassignPlayer(current, playerIdValue), setSlotError);
      return;
    }
    const [kind, rawIndex] = value.split(":");
    runOp(
      (current) =>
        assignPlayer(current, playerIdValue, {
          kind: kind as "starter" | "substitute",
          index: Number(rawIndex),
        }),
      setSlotError,
    );
  }

  function submitAdd(): void {
    setAddFailure(null);
    const parsed = rosterPlayerFormSchema.safeParse({
      displayName: name,
      playerId,
      role,
      notes,
    });
    if (!parsed.success) {
      const map = new Map<string, string>();
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!map.has(key)) {
          map.set(key, issue.message);
        }
      }
      setAddErrors(map);
      return;
    }
    setAddErrors(new Map());
    const data = parsed.data;
    const nextTarget = target;
    try {
      let next = addPlayer(roster, {
        displayName: data.displayName,
        playerId: data.playerId === "" ? null : data.playerId,
        role: data.role,
        notes: data.notes === "" ? null : data.notes,
      });
      const added = next.players[next.players.length - 1]!;
      if (nextTarget !== "bench") {
        const [kind, rawIndex] = nextTarget.split(":");
        next = assignPlayer(next, added.id, {
          kind: kind as "starter" | "substitute",
          index: Number(rawIndex),
        });
      }
      setRoster(next);
      setName("");
      setPlayerId("");
      setRole("Flexible");
      setNotes("");
      setTarget("bench");
      setCopied(false);
    } catch (error) {
      setAddFailure(error instanceof RosterError ? error.message : "Could not add that player.");
    }
  }

  function startEdit(playerIdValue: string): void {
    const found = roster.players.find((p) => p.id === playerIdValue);
    if (!found) {
      return;
    }
    setEditingId(playerIdValue);
    setEditDraft({
      displayName: found.displayName,
      playerId: found.playerId ?? "",
      role: found.role ?? "Flexible",
      notes: found.notes ?? "",
    });
    setEditError(null);
    setConfirmingRemoveId(null);
  }

  function saveEdit(): void {
    if (editingId === null) {
      return;
    }
    const parsed = rosterPlayerFormSchema.safeParse({
      displayName: editDraft.displayName,
      playerId: editDraft.playerId,
      role: editDraft.role,
      notes: editDraft.notes,
    });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Check the highlighted fields.");
      return;
    }
    const data = parsed.data;
    const id = editingId;
    runOp(
      (current) =>
        updatePlayer(current, id, {
          displayName: data.displayName,
          playerId: data.playerId === "" ? null : data.playerId,
          role: data.role,
          notes: data.notes === "" ? null : data.notes,
          clearPlayerId: data.playerId === "",
          clearNotes: data.notes === "",
        }),
      setEditError,
      () => setEditingId(null),
    );
  }

  function askRemove(playerIdValue: string): void {
    if (confirmingRemoveId === playerIdValue) {
      runOp((current) => removePlayer(current, playerIdValue), setSlotError);
      setConfirmingRemoveId(null);
      setEditingId(null);
    } else {
      setConfirmingRemoveId(playerIdValue);
    }
  }

  function resetAll(): void {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setRoster(createRoster({ gameKey: "bgmi", starterSlots: 4, substituteSlots: 2 }));
    setConfigError(null);
    setSlotError(null);
    setAddErrors(new Map());
    setAddFailure(null);
    setName("");
    setPlayerId("");
    setRole("Flexible");
    setNotes("");
    setTarget("bench");
    setEditingId(null);
    setConfirmingRemoveId(null);
    setConfirmingReset(false);
    setCopied(false);
  }

  async function copySummary(): Promise<void> {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const hasData = roster.players.length > 0 || roster.config.teamName !== null;
  const statusCopy =
    completeness.status === "complete"
      ? "Complete — every starter slot is filled."
      : completeness.status === "empty"
        ? "Empty — add your first player below."
        : "Partial — see the issues listed below the roster.";

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      {/* Plan setup */}
      <section aria-labelledby={`${uid}-plan-heading`}>
        <h3 id={`${uid}-plan-heading`} className="text-base font-semibold">
          Roster plan
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Game: BGMI (Battlegrounds Mobile India) — this release supports BGMI only. Slot
          counts are your own plan, not an official tournament rule.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Labelled htmlFor={`${uid}-team`} label="Team name (optional)">
            <input
              id={`${uid}-team`}
              type="text"
              autoComplete="off"
              maxLength={40}
              value={roster.config.teamName ?? ""}
              onChange={(event) => changeConfig({ teamName: event.target.value })}
              placeholder="Unnamed team"
              className={inputClass}
            />
          </Labelled>
          <Labelled htmlFor={`${uid}-starters`} label="Starter slots">
            <select
              id={`${uid}-starters`}
              value={roster.config.starterSlots}
              onChange={(event) => changeConfig({ starterSlots: Number(event.target.value) })}
              className={`${inputClass} bg-white`}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "starter" : "starters"}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled htmlFor={`${uid}-subs`} label="Substitute slots">
            <select
              id={`${uid}-subs`}
              value={roster.config.substituteSlots}
              onChange={(event) => changeConfig({ substituteSlots: Number(event.target.value) })}
              className={`${inputClass} bg-white`}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "substitute" : "substitutes"}
                </option>
              ))}
            </select>
          </Labelled>
        </div>
        {configError !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {configError}
          </p>
        ) : null}
      </section>

      {/* Completeness */}
      <section aria-labelledby={`${uid}-status-heading`} className="mt-6">
        <h3 id={`${uid}-status-heading`} className="text-base font-semibold">
          Completeness
        </h3>
        <div aria-live="polite" className="mt-2">
          <p className="text-sm text-slate-700">{statusCopy}</p>
          <div
            role="progressbar"
            aria-label="Starter slots filled"
            aria-valuemin={0}
            aria-valuemax={completeness.starterTotal}
            aria-valuenow={completeness.startersFilled}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{
                width: `${completeness.starterTotal === 0 ? 0 : (completeness.startersFilled / completeness.starterTotal) * 100}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Starters {completeness.startersFilled}/{completeness.starterTotal} · Substitutes{" "}
            {completeness.substitutesFilled}/{completeness.substituteTotal} ·{" "}
            {roster.players.length} {roster.players.length === 1 ? "player" : "players"} total
          </p>
        </div>
      </section>

      {/* Add player */}
      <section aria-labelledby={`${uid}-add-heading`} className="mt-6">
        <h3 id={`${uid}-add-heading`} className="text-base font-semibold">
          Add a player
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Labelled
            htmlFor={`${uid}-name`}
            label="Display name"
            error={addErrors.get("displayName")}
            hint="In-game name, 2–24 characters."
          >
            <input
              id={`${uid}-name`}
              type="text"
              autoComplete="off"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={addErrors.has("displayName")}
              placeholder="NovaX"
              className={inputClass}
            />
          </Labelled>
          <Labelled
            htmlFor={`${uid}-pid`}
            label="Player ID (optional)"
            error={addErrors.get("playerId")}
            hint="In-game character ID to tell same names apart."
          >
            <input
              id={`${uid}-pid`}
              type="text"
              autoComplete="off"
              maxLength={32}
              value={playerId}
              onChange={(event) => setPlayerId(event.target.value)}
              aria-invalid={addErrors.has("playerId")}
              placeholder="5123456789"
              className={inputClass}
            />
          </Labelled>
          <Labelled htmlFor={`${uid}-role`} label="Role" error={addErrors.get("role")}>
            <select
              id={`${uid}-role`}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={`${inputClass} bg-white`}
            >
              {rosterRoleOptions().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled htmlFor={`${uid}-target`} label="Place in">
            <select
              id={`${uid}-target`}
              value={target}
              onChange={(event) => setTarget(event.target.value as SlotSelectValue)}
              className={`${inputClass} bg-white`}
            >
              {slotOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Labelled>
        </div>
        <div className="mt-4">
          <Labelled
            htmlFor={`${uid}-notes`}
            label={`Notes (optional, ${notes.trim().length}/${MAX_NOTES_LENGTH})`}
            error={addErrors.get("notes")}
          >
            <input
              id={`${uid}-notes`}
              type="text"
              autoComplete="off"
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              aria-invalid={addErrors.has("notes")}
              placeholder="Shot-caller, prefers third man…"
              className={inputClass}
            />
          </Labelled>
        </div>
        {addFailure !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {addFailure}
          </p>
        ) : null}
        <button
          type="button"
          onClick={submitAdd}
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Add player
        </button>
      </section>

      {/* Player list */}
      <section aria-labelledby={`${uid}-roster-heading`} className="mt-6">
        <h3 id={`${uid}-roster-heading`} className="text-base font-semibold">
          Players ({roster.players.length})
        </h3>
        {roster.players.length === 0 ? (
          <div role="status" className="mt-3 rounded-md border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-semibold">No players yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Add your first player above — they will wait on the bench until you place
              them in a slot.
            </p>
          </div>
        ) : (
          <ul aria-label="Roster players" className="mt-3 grid gap-3 sm:grid-cols-2">
            {roster.players.map((player) => {
              const isEditing = editingId === player.id;
              return (
                <li key={player.id} className="rounded-md border border-slate-200 p-3">
                  {isEditing ? (
                    <div className="grid gap-2">
                      <Labelled htmlFor={`${uid}-edit-name-${player.id}`} label="Display name">
                        <input
                          id={`${uid}-edit-name-${player.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={24}
                          value={editDraft.displayName}
                          onChange={(event) =>
                            setEditDraft((d) => ({ ...d, displayName: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </Labelled>
                      <div className="grid grid-cols-2 gap-2">
                        <Labelled htmlFor={`${uid}-edit-pid-${player.id}`} label="Player ID">
                          <input
                            id={`${uid}-edit-pid-${player.id}`}
                            type="text"
                            autoComplete="off"
                            maxLength={32}
                            value={editDraft.playerId}
                            onChange={(event) =>
                              setEditDraft((d) => ({ ...d, playerId: event.target.value }))
                            }
                            className={inputClass}
                          />
                        </Labelled>
                        <Labelled htmlFor={`${uid}-edit-role-${player.id}`} label="Role">
                          <select
                            id={`${uid}-edit-role-${player.id}`}
                            value={editDraft.role}
                            onChange={(event) =>
                              setEditDraft((d) => ({ ...d, role: event.target.value }))
                            }
                            className={`${inputClass} bg-white`}
                          >
                            {rosterRoleOptions().map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </Labelled>
                      </div>
                      <Labelled htmlFor={`${uid}-edit-notes-${player.id}`} label="Notes">
                        <input
                          id={`${uid}-edit-notes-${player.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={MAX_NOTES_LENGTH}
                          value={editDraft.notes}
                          onChange={(event) =>
                            setEditDraft((d) => ({ ...d, notes: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </Labelled>
                      {editError !== null ? (
                        <p role="alert" className="text-xs font-medium text-accent-600">
                          {editError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditError(null);
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{player.displayName}</p>
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {player.role ?? "Flexible"}
                        </span>
                        <span className="inline-block rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                          {player.assignment === null
                            ? "Bench"
                            : player.assignment.kind === "starter"
                              ? `Starter ${player.assignment.index + 1}`
                              : `Substitute ${player.assignment.index + 1}`}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {player.playerId !== null ? <p>ID: {player.playerId}</p> : null}
                        {player.notes !== null ? <p>{player.notes}</p> : null}
                      </div>
                      <div className="mt-2 grid gap-2">
                        <label
                          htmlFor={`${uid}-slot-${player.id}`}
                          className="text-xs font-medium text-slate-600"
                        >
                          Slot
                        </label>
                        <select
                          id={`${uid}-slot-${player.id}`}
                          value={toSlotValue(player.assignment)}
                          onChange={(event) =>
                            movePlayer(player.id, event.target.value as SlotSelectValue)
                          }
                          className={`${inputClass} bg-white`}
                        >
                          {slotOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(player.id)}
                            aria-label={`Edit ${player.displayName}`}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => askRemove(player.id)}
                            aria-label={
                              confirmingRemoveId === player.id
                                ? `Confirm remove ${player.displayName}`
                                : `Remove ${player.displayName}`
                            }
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                          >
                            {confirmingRemoveId === player.id ? "Confirm remove" : "Remove"}
                          </button>
                          {confirmingRemoveId === player.id ? (
                            <button
                              type="button"
                              onClick={() => setConfirmingRemoveId(null)}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                            >
                              Keep
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {slotError !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {slotError}
          </p>
        ) : null}
        {completeness.issues.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-semibold text-amber-900">Needs attention</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {completeness.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Summary + danger zone */}
      <section aria-labelledby={`${uid}-summary-heading`} className="mt-6">
        <h3 id={`${uid}-summary-heading`} className="text-base font-semibold">
          Roster summary
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          User-created plan only — not an official entry, approval, or player check.
        </p>
        <div aria-live="polite">
          <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-100">
            {summary}
          </pre>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copySummary}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Copy summary
          </button>
          <button
            type="button"
            onClick={resetAll}
            disabled={!hasData && !confirmingReset}
            aria-label={confirmingReset ? "Confirm reset roster" : "Reset roster"}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmingReset ? "Confirm reset" : "Reset"}
          </button>
          {confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Keep roster
            </button>
          ) : null}
          {copied ? (
            <p role="status" className="text-xs font-medium text-emerald-700">
              Copied to clipboard.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
