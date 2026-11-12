// Tie-Break & Qualification Simulator runner (client). Every calculation
// happens locally in this browser session: forms validate through the
// strict Zod boundary, the pure engine owns scoring/ranking/qualification,
// and nothing leaves the page — no account, no uploads, no lookups, no
// persistence, no live data. Standings recompute live from scenario state;
// snapshots let the user test what-if changes without losing the original.

"use client";

import { cloneElement, isValidElement, useId, useMemo, useState } from "react";
import {
  MAX_CRITERIA,
  MAX_CUTOFF,
  MAX_TEAMS,
  SCORE_DIRECTIONS,
  criterionFormSchema,
  directionLabel,
  parseScoreField,
  scenarioFormSchema,
  teamFormSchema,
  type ScoreDirection,
} from "@/features/tools/tiebreak/schema";
import {
  ScenarioError,
  addCriterion,
  addTeam,
  buildScenarioSummary,
  computeStandings,
  createScenario,
  moveCriterion,
  removeCriterion,
  removeTeam,
  renameTeam,
  setScenarioMeta,
  setTeamValue,
  updateCriterion,
  type TiebreakScenario,
} from "@/features/tools/tiebreak/engine";

interface Snapshot {
  readonly id: string;
  readonly label: string;
  readonly state: TiebreakScenario;
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

const qualStyles: Record<string, string> = {
  qualified: "bg-emerald-100 text-emerald-900",
  out: "bg-slate-100 text-slate-600",
  contested: "bg-amber-100 text-amber-900",
};

function qualLabel(status: string): string {
  switch (status) {
    case "qualified":
      return "Qualified";
    case "out":
      return "Out";
    case "contested":
      return "Contested";
    default:
      return "";
  }
}

export function TiebreakRunner() {
  const uid = useId();
  const [scenario, setScenario] = useState<TiebreakScenario>(() =>
    createScenario({ cutoff: 4 }),
  );
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const [teamDraft, setTeamDraft] = useState("");
  const [teamError, setTeamError] = useState<string | null>(null);

  const [criterionDraft, setCriterionDraft] = useState({ name: "", weight: "1", direction: "high" as ScoreDirection });
  const [criterionError, setCriterionError] = useState<string | null>(null);

  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamEditDraft, setTeamEditDraft] = useState("");
  const [teamEditError, setTeamEditError] = useState<string | null>(null);

  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [criterionEditDraft, setCriterionEditDraft] = useState({ name: "", weight: "1", direction: "high" as ScoreDirection });
  const [criterionEditError, setCriterionEditError] = useState<string | null>(null);

  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshotSeq, setSnapshotSeq] = useState(1);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => computeStandings(scenario), [scenario]);
  const summary = useMemo(() => buildScenarioSummary(scenario), [scenario]);

  // Domain ops run eagerly against the current state value (not inside a
  // React updater) so ScenarioError throws synchronously into this try/catch.
  function runOp(fn: (current: TiebreakScenario) => TiebreakScenario, onError: (message: string) => void): boolean {
    try {
      const next = fn(scenario);
      setScenario(next);
      setCopied(false);
      return true;
    } catch (error) {
      onError(error instanceof ScenarioError ? error.message : "Something went wrong. Try again.");
      return false;
    }
  }

  function clearCellState(): void {
    setCellDrafts({});
    setCellErrors({});
  }

  function changeMeta(patch: { name?: string; cutoff?: number }): void {
    setScenarioError(null);
    const parsed = scenarioFormSchema.safeParse({
      name: patch.name ?? scenario.name ?? "",
      cutoff: patch.cutoff ?? scenario.cutoff,
    });
    if (!parsed.success) {
      setScenarioError(parsed.error.issues[0]?.message ?? "Check the scenario fields.");
      return;
    }
    runOp(
      (current) => setScenarioMeta(current, { name: parsed.data.name, cutoff: parsed.data.cutoff }),
      setScenarioError,
    );
  }

  function submitTeam(): void {
    const parsed = teamFormSchema.safeParse({ displayName: teamDraft });
    if (!parsed.success) {
      setTeamError(parsed.error.issues[0]?.message ?? "Check the team name.");
      return;
    }
    setTeamError(null);
    if (runOp((current) => addTeam(current, parsed.data.displayName), setTeamError)) {
      setTeamDraft("");
    }
  }

  function submitCriterion(): void {
    const parsed = criterionFormSchema.safeParse({
      name: criterionDraft.name,
      weight: criterionDraft.weight,
      direction: criterionDraft.direction,
    });
    if (!parsed.success) {
      setCriterionError(parsed.error.issues[0]?.message ?? "Check the criterion fields.");
      return;
    }
    setCriterionError(null);
    if (
      runOp(
        (current) =>
          addCriterion(current, {
            name: parsed.data.name,
            weight: parsed.data.weight,
            direction: parsed.data.direction,
          }),
        setCriterionError,
      )
    ) {
      setCriterionDraft({ name: "", weight: "1", direction: "high" });
    }
  }

  function commitCell(teamId: string, criterionId: string, raw: string): void {
    const key = `${teamId}:${criterionId}`;
    const parsed = parseScoreField(raw);
    if (!parsed.ok) {
      setCellDrafts((drafts) => ({ ...drafts, [key]: raw }));
      setCellErrors((errors) => ({
        ...errors,
        [key]: "Enter a whole number, or clear the field to leave it missing.",
      }));
      return;
    }
    setCellDrafts((drafts) => {
      const next = { ...drafts };
      delete next[key];
      return next;
    });
    setCellErrors((errors) => {
      const next = { ...errors };
      delete next[key];
      return next;
    });
    runOp(
      (current) => setTeamValue(current, teamId, criterionId, parsed.value),
      (message) =>
        setCellErrors((errors) => ({ ...errors, [key]: message })),
    );
  }

  function saveTeamEdit(): void {
    if (editingTeamId === null) {
      return;
    }
    const parsed = teamFormSchema.safeParse({ displayName: teamEditDraft });
    if (!parsed.success) {
      setTeamEditError(parsed.error.issues[0]?.message ?? "Check the team name.");
      return;
    }
    const id = editingTeamId;
    if (runOp((current) => renameTeam(current, id, parsed.data.displayName), setTeamEditError)) {
      setEditingTeamId(null);
      setTeamEditDraft("");
      setTeamEditError(null);
    }
  }

  function saveCriterionEdit(): void {
    if (editingCriterionId === null) {
      return;
    }
    const parsed = criterionFormSchema.safeParse({
      name: criterionEditDraft.name,
      weight: criterionEditDraft.weight,
      direction: criterionEditDraft.direction,
    });
    if (!parsed.success) {
      setCriterionEditError(parsed.error.issues[0]?.message ?? "Check the criterion fields.");
      return;
    }
    const id = editingCriterionId;
    if (
      runOp(
        (current) =>
          updateCriterion(current, id, {
            name: parsed.data.name,
            weight: parsed.data.weight,
            direction: parsed.data.direction,
          }),
        setCriterionEditError,
      )
    ) {
      setEditingCriterionId(null);
      setCriterionEditError(null);
    }
  }

  function askRemove(kind: "team" | "criterion", id: string): void {
    const key = `${kind}:${id}`;
    if (confirmingRemove === key) {
      const ok = runOp(
        (current) => (kind === "team" ? removeTeam(current, id) : removeCriterion(current, id)),
        setScenarioError,
      );
      if (ok) {
        clearCellState();
        if (kind === "team" && editingTeamId === id) {
          setEditingTeamId(null);
        }
        if (kind === "criterion" && editingCriterionId === id) {
          setEditingCriterionId(null);
        }
      }
      setConfirmingRemove(null);
    } else {
      setConfirmingRemove(key);
    }
  }

  function move(id: string, direction: "up" | "down"): void {
    setScenarioError(null);
    runOp((current) => moveCriterion(current, id, direction), setScenarioError);
  }

  function saveSnapshot(): void {
    setSnapshots((current) => [
      ...current,
      {
        id: `snapshot-${snapshotSeq}`,
        label: `Snapshot ${snapshotSeq}${scenario.name ? ` — ${scenario.name}` : ""}`,
        state: structuredClone(scenario),
      },
    ]);
    setSnapshotSeq((n) => n + 1);
  }

  function restoreSnapshot(id: string): void {
    if (confirmingRestoreId !== id) {
      setConfirmingRestoreId(id);
      return;
    }
    const found = snapshots.find((s) => s.id === id);
    if (found !== undefined) {
      setScenario(structuredClone(found.state));
      setCopied(false);
      clearCellState();
      setScenarioError(null);
    }
    setConfirmingRestoreId(null);
  }

  function deleteSnapshot(id: string): void {
    setSnapshots((current) => current.filter((s) => s.id !== id));
    if (confirmingRestoreId === id) {
      setConfirmingRestoreId(null);
    }
  }

  function resetAll(): void {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    setScenario(createScenario({ cutoff: 4 }));
    setScenarioError(null);
    setTeamDraft("");
    setTeamError(null);
    setCriterionDraft({ name: "", weight: "1", direction: "high" });
    setCriterionError(null);
    clearCellState();
    setEditingTeamId(null);
    setEditingCriterionId(null);
    setConfirmingRemove(null);
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

  const hasData =
    scenario.teams.length > 0 ||
    scenario.criteria.length > 0 ||
    scenario.name !== null ||
    scenario.cutoff !== 4;
  const hasTies = result.standings.some((s) => s.tieSize > 1);

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
      {/* Scenario setup */}
      <section aria-labelledby={`${uid}-scenario-heading`}>
        <h3 id={`${uid}-scenario-heading`} className="text-base font-semibold">
          Scenario
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Your rules, your numbers. Nothing here is an official table — the
          engine only applies the criteria you configure below.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Labelled htmlFor={`${uid}-name`} label="Scenario name (optional)">
            <input
              id={`${uid}-name`}
              type="text"
              autoComplete="off"
              maxLength={48}
              value={scenario.name ?? ""}
              onChange={(event) => changeMeta({ name: event.target.value })}
              placeholder="Unnamed scenario"
              className={inputClass}
            />
          </Labelled>
          <Labelled
            htmlFor={`${uid}-cutoff`}
            label="Qualification cutoff (0 = off)"
            hint={`Top N qualify. 0 turns the line off (max ${MAX_CUTOFF}).`}
          >
            <input
              id={`${uid}-cutoff`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={String(scenario.cutoff)}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (raw === "") {
                  changeMeta({ cutoff: 0 });
                  return;
                }
                const parsed = Number(raw);
                if (Number.isInteger(parsed)) {
                  changeMeta({ cutoff: parsed });
                }
              }}
              className={inputClass}
            />
          </Labelled>
        </div>
        {scenarioError !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {scenarioError}
          </p>
        ) : null}
      </section>

      {/* Criteria */}
      <section aria-labelledby={`${uid}-criteria-heading`} className="mt-6">
        <h3 id={`${uid}-criteria-heading`} className="text-base font-semibold">
          Scoring criteria ({scenario.criteria.length}/{MAX_CRITERIA})
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Listed in tie-break priority order — move a criterion to change which
          tie-break is consulted first.
        </p>
        {scenario.criteria.length === 0 ? (
          <div role="status" className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-center">
            <p className="text-sm text-slate-600">
              No criteria yet. Add one below — every team ties at total 0 until you do.
            </p>
          </div>
        ) : (
          <ul aria-label="Scoring criteria in priority order" className="mt-3 space-y-2">
            {scenario.criteria.map((criterion, index) => {
              const key = `criterion:${criterion.id}`;
              const isEditing = editingCriterionId === criterion.id;
              return (
                <li key={criterion.id} className="rounded-md border border-slate-200 p-3">
                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Labelled htmlFor={`${uid}-cedit-name-${criterion.id}`} label="Name">
                        <input
                          id={`${uid}-cedit-name-${criterion.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={32}
                          value={criterionEditDraft.name}
                          onChange={(event) =>
                            setCriterionEditDraft((d) => ({ ...d, name: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </Labelled>
                      <Labelled htmlFor={`${uid}-cedit-weight-${criterion.id}`} label="Weight">
                        <input
                          id={`${uid}-cedit-weight-${criterion.id}`}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={5}
                          value={criterionEditDraft.weight}
                          onChange={(event) =>
                            setCriterionEditDraft((d) => ({ ...d, weight: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </Labelled>
                      <Labelled htmlFor={`${uid}-cedit-dir-${criterion.id}`} label="Direction">
                        <select
                          id={`${uid}-cedit-dir-${criterion.id}`}
                          value={criterionEditDraft.direction}
                          onChange={(event) =>
                            setCriterionEditDraft((d) => ({
                              ...d,
                              direction: event.target.value as ScoreDirection,
                            }))
                          }
                          className={`${inputClass} bg-white`}
                        >
                          {SCORE_DIRECTIONS.map((option) => (
                            <option key={option} value={option}>
                              {directionLabel(option)}
                            </option>
                          ))}
                        </select>
                      </Labelled>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        #{index + 1}
                      </span>
                      <p className="text-sm font-semibold">{criterion.name}</p>
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        weight {criterion.weight} · {directionLabel(criterion.direction).toLowerCase()}
                      </span>
                    </div>
                  )}
                  {isEditing && criterionEditError !== null ? (
                    <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
                      {criterionEditError}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={saveCriterionEdit}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCriterionId(null);
                            setCriterionEditError(null);
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => move(criterion.id, "up")}
                          disabled={index === 0}
                          aria-label={`Move ${criterion.name} earlier in priority`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↑ Priority
                        </button>
                        <button
                          type="button"
                          onClick={() => move(criterion.id, "down")}
                          disabled={index === scenario.criteria.length - 1}
                          aria-label={`Move ${criterion.name} later in priority`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ↓ Priority
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCriterionId(criterion.id);
                            setCriterionEditDraft({
                              name: criterion.name,
                              weight: String(criterion.weight),
                              direction: criterion.direction,
                            });
                            setCriterionEditError(null);
                            setConfirmingRemove(null);
                          }}
                          aria-label={`Edit ${criterion.name}`}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => askRemove("criterion", criterion.id)}
                          aria-label={
                            confirmingRemove === key
                              ? `Confirm remove ${criterion.name}`
                              : `Remove ${criterion.name}`
                          }
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          {confirmingRemove === key ? "Confirm remove" : "Remove"}
                        </button>
                        {confirmingRemove === key ? (
                          <button
                            type="button"
                            onClick={() => setConfirmingRemove(null)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                          >
                            Keep
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 grid gap-4 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-4 sm:items-end">
          <Labelled htmlFor={`${uid}-cname`} label="Criterion name">
            <input
              id={`${uid}-cname`}
              type="text"
              autoComplete="off"
              maxLength={32}
              value={criterionDraft.name}
              onChange={(event) => setCriterionDraft((d) => ({ ...d, name: event.target.value }))}
              placeholder="Placement"
              className={`${inputClass} bg-white`}
            />
          </Labelled>
          <Labelled htmlFor={`${uid}-cweight`} label="Weight" hint="-1000 to 1000.">
            <input
              id={`${uid}-cweight`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={5}
              value={criterionDraft.weight}
              onChange={(event) => setCriterionDraft((d) => ({ ...d, weight: event.target.value }))}
              className={`${inputClass} bg-white`}
            />
          </Labelled>
          <Labelled htmlFor={`${uid}-cdir`} label="Direction">
            <select
              id={`${uid}-cdir`}
              value={criterionDraft.direction}
              onChange={(event) =>
                setCriterionDraft((d) => ({ ...d, direction: event.target.value as ScoreDirection }))
              }
              className={`${inputClass} bg-white`}
            >
              {SCORE_DIRECTIONS.map((option) => (
                <option key={option} value={option}>
                  {directionLabel(option)}
                </option>
              ))}
            </select>
          </Labelled>
          <button
            type="button"
            onClick={submitCriterion}
            disabled={scenario.criteria.length >= MAX_CRITERIA}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add criterion
          </button>
        </div>
        {criterionError !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {criterionError}
          </p>
        ) : null}
      </section>

      {/* Teams */}
      <section aria-labelledby={`${uid}-teams-heading`} className="mt-6">
        <h3 id={`${uid}-teams-heading`} className="text-base font-semibold">
          Teams ({scenario.teams.length}/{MAX_TEAMS})
        </h3>
        {scenario.teams.length === 0 ? (
          <div role="status" className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-center">
            <p className="text-sm text-slate-600">
              No teams yet. Add one below, then enter a score per criterion.
            </p>
          </div>
        ) : (
          <ul aria-label="Teams and their scores" className="mt-3 grid gap-3 sm:grid-cols-2">
            {scenario.teams.map((team) => {
              const tkey = `team:${team.id}`;
              const isEditing = editingTeamId === team.id;
              return (
                <li key={team.id} className="rounded-md border border-slate-200 p-3">
                  {isEditing ? (
                    <div className="grid gap-2">
                      <Labelled htmlFor={`${uid}-tedit-${team.id}`} label="Team name">
                        <input
                          id={`${uid}-tedit-${team.id}`}
                          type="text"
                          autoComplete="off"
                          maxLength={40}
                          value={teamEditDraft}
                          onChange={(event) => setTeamEditDraft(event.target.value)}
                          className={inputClass}
                        />
                      </Labelled>
                      {teamEditError !== null ? (
                        <p role="alert" className="text-xs font-medium text-accent-600">
                          {teamEditError}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveTeamEdit}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTeamId(null);
                            setTeamEditError(null);
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{team.displayName}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTeamId(team.id);
                          setTeamEditDraft(team.displayName);
                          setTeamEditError(null);
                          setConfirmingRemove(null);
                        }}
                        aria-label={`Edit ${team.displayName}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => askRemove("team", team.id)}
                        aria-label={
                          confirmingRemove === tkey
                            ? `Confirm remove ${team.displayName}`
                            : `Remove ${team.displayName}`
                        }
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        {confirmingRemove === tkey ? "Confirm remove" : "Remove"}
                      </button>
                      {confirmingRemove === tkey ? (
                        <button
                          type="button"
                          onClick={() => setConfirmingRemove(null)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                          Keep
                        </button>
                      ) : null}
                    </div>
                  )}
                  {scenario.criteria.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Scores unlock once you add a criterion above.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2">
                      {scenario.criteria.map((criterion) => {
                        const key = `${team.id}:${criterion.id}`;
                        const draft = cellDrafts[key];
                        const entered = team.values[criterion.id];
                        const shown = draft ?? (entered === undefined ? "" : String(entered));
                        return (
                          <div key={criterion.id}>
                            <label htmlFor={`${uid}-cell-${key}`} className="text-xs font-medium text-slate-600">
                              {criterion.name} <span className="font-normal">(blank = missing, counted as 0)</span>
                            </label>
                            <input
                              id={`${uid}-cell-${key}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={8}
                              value={shown}
                              onChange={(event) => commitCell(team.id, criterion.id, event.target.value)}
                              aria-invalid={cellErrors[key] !== undefined}
                              aria-describedby={cellErrors[key] !== undefined ? `${uid}-cell-${key}-error` : undefined}
                              placeholder="—"
                              className={`${inputClass} mt-0.5 w-full`}
                            />
                            {cellErrors[key] !== undefined ? (
                              <p id={`${uid}-cell-${key}-error`} role="alert" className="mt-0.5 text-xs font-medium text-accent-600">
                                {cellErrors[key]}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <Labelled htmlFor={`${uid}-tname`} label="Team name">
              <input
                id={`${uid}-tname`}
                type="text"
                autoComplete="off"
                maxLength={40}
                value={teamDraft}
                onChange={(event) => setTeamDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitTeam();
                  }
                }}
                placeholder="Team Nova"
                className={inputClass}
              />
            </Labelled>
          </div>
          <button
            type="button"
            onClick={submitTeam}
            disabled={scenario.teams.length >= MAX_TEAMS}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add team
          </button>
        </div>
        {teamError !== null ? (
          <p role="alert" className="mt-2 text-xs font-medium text-accent-600">
            {teamError}
          </p>
        ) : null}
      </section>

      {/* Standings */}
      <section aria-labelledby={`${uid}-standings-heading`} className="mt-6">
        <h3 id={`${uid}-standings-heading`} className="text-base font-semibold">
          Standings
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Simulation based on your configured scoring rules. Not an official tournament result.
        </p>
        <div aria-live="polite">
          {result.cutoffContested ? (
            <p role="status" className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              The top-{scenario.cutoff} line cuts through a tie. Nobody there is
              auto-qualified — add a tie-break criterion or decide by hand.
            </p>
          ) : null}
          {result.standings.length === 0 ? (
            <div role="status" className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-center">
              <p className="text-sm text-slate-600">
                Standings appear here once teams are added.
              </p>
            </div>
          ) : (
            <ol aria-label="Simulated standings" className="mt-3 space-y-3">
              {result.standings.map((standing) => (
                <li key={standing.teamId} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {standing.tieSize > 1 ? `Tied ${standing.rank}` : `Rank ${standing.rank}`}
                    </span>
                    <p className="text-sm font-semibold">{standing.displayName}</p>
                    <span className="text-sm text-slate-600">total {standing.total}</span>
                    {standing.qualification !== "no-cutoff" ? (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${qualStyles[standing.qualification] ?? ""}`}>
                        {qualLabel(standing.qualification)}
                      </span>
                    ) : null}
                  </div>
                  <dl className="mt-2 space-y-1 text-xs text-slate-600">
                    {standing.contributions.map((part) => (
                      <div key={part.criterionId} className="flex flex-wrap gap-x-2">
                        <dt className="font-medium">{part.name}:</dt>
                        <dd>
                          {part.value === null ? "not entered (counted as 0)" : part.value} × {part.weight} = {part.contribution}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">{standing.explanation}</p>
                  {standing.qualificationNote !== null && standing.qualification !== "no-cutoff" ? (
                    <p className="mt-1 text-xs font-medium text-slate-700">{standing.qualificationNote}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {hasTies && result.cutoff === 0 ? (
            <p role="status" className="mt-2 text-xs text-slate-500">
              Tied teams share a rank and stay tied until a further criterion or a human decision separates them.
            </p>
          ) : null}
          {result.assumedCount > 0 ? (
            <p role="status" className="mt-2 text-xs text-slate-500">
              {result.assumedCount} missing {result.assumedCount === 1 ? "score is" : "scores are"} counted as 0 and flagged above.
            </p>
          ) : null}
        </div>
      </section>

      {/* Snapshots */}
      <section aria-labelledby={`${uid}-snapshots-heading`} className="mt-6">
        <h3 id={`${uid}-snapshots-heading`} className="text-base font-semibold">
          What-if snapshots ({snapshots.length})
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Save the current scenario, try changes freely, and restore the saved
          copy any time. Snapshots live in this browser session only.
        </p>
        <button
          type="button"
          onClick={saveSnapshot}
          className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Save snapshot
        </button>
        {snapshots.length > 0 ? (
          <ul aria-label="Saved snapshots" className="mt-2 space-y-2">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2">
                <p className="text-sm font-medium">{snapshot.label}</p>
                <span className="text-xs text-slate-500">
                  {snapshot.state.teams.length} {snapshot.state.teams.length === 1 ? "team" : "teams"} ·{" "}
                  {snapshot.state.criteria.length} {snapshot.state.criteria.length === 1 ? "criterion" : "criteria"}
                </span>
                <button
                  type="button"
                  onClick={() => restoreSnapshot(snapshot.id)}
                  aria-label={confirmingRestoreId === snapshot.id ? `Confirm restore ${snapshot.label}` : `Restore ${snapshot.label}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {confirmingRestoreId === snapshot.id ? "Confirm restore" : "Restore"}
                </button>
                {confirmingRestoreId === snapshot.id ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingRestoreId(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    Keep current
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => deleteSnapshot(snapshot.id)}
                  aria-label={`Delete ${snapshot.label}`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Summary + reset */}
      <section aria-labelledby={`${uid}-summary-heading`} className="mt-6">
        <h3 id={`${uid}-summary-heading`} className="text-base font-semibold">
          Scenario summary
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          User-created simulation only — not an official entry, approval, or result.
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
            aria-label={confirmingReset ? "Confirm reset scenario" : "Reset scenario"}
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
              Keep scenario
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
