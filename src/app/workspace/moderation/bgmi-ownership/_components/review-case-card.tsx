"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type {
  BgmiOwnershipEvidenceSummary,
  BgmiOwnershipReviewQueueItem,
} from "@/features/player-profile/domain/bgmi-ownership";
import {
  approveBgmiOwnershipAction,
  mintReviewerEvidencePreviewAction,
  rejectBgmiOwnershipAction,
  type ReviewActionState,
} from "../actions";

const initial: ReviewActionState = { ok: false, message: "" };

export function ReviewCaseCard({
  item,
  evidence,
}: {
  item: BgmiOwnershipReviewQueueItem;
  evidence: BgmiOwnershipEvidenceSummary[];
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approveBgmiOwnershipAction,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectBgmiOwnershipAction,
    initial,
  );
  const message = approveState.message || rejectState.message;
  const ok = approveState.message ? approveState.ok : rejectState.ok;

  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-5"
      aria-labelledby={`case-${item.case_id}`}
    >
      <h2 id={`case-${item.case_id}`} className="text-base font-semibold">
        @{item.handle} · {item.display_name}
      </h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">Case</dt>
          <dd className="font-mono text-xs break-all">{item.case_id}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">Submitted</dt>
          <dd>{item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">IGN</dt>
          <dd>{item.ign ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">
            Claimed BGMI Player ID
          </dt>
          <dd className="font-mono tracking-wide">{item.claimed_game_user_id}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">Evidence</dt>
          <dd>{item.evidence_count}</dd>
        </div>
        <div>
          <dt className="text-xs tracking-wide text-slate-500 uppercase">State</dt>
          <dd>
            {item.status}
            {item.identity_mismatch ? " · ID mismatch warning" : ""}
          </dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-2">
        {evidence.map((ev) => (
          <li
            key={ev.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm"
          >
            <span>
              Image {ev.sort_order}: {ev.content_type.replace("image/", "").toUpperCase()} ·{" "}
              {ev.width}×{ev.height}
            </span>
            <ReviewerPreviewButton caseId={item.case_id} evidenceId={ev.id} />
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form action={approveAction} className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
          <input type="hidden" name="case_id" value={item.case_id} />
          <h3 className="text-sm font-semibold">Approve</h3>
          <label className="block text-sm">
            Internal reason
            <textarea
              name="internal_reason"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={approvePending || item.identity_mismatch}>
            {approvePending ? "Approving…" : "Approve"}
          </Button>
        </form>

        <form action={rejectAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="case_id" value={item.case_id} />
          <h3 className="text-sm font-semibold">Reject</h3>
          <label className="block text-sm">
            Internal reason
            <textarea
              name="internal_reason"
              required
              minLength={5}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Player-facing message
            <textarea
              name="player_facing_message"
              required
              minLength={5}
              maxLength={280}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" variant="secondary" disabled={rejectPending}>
            {rejectPending ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>

      {message ? (
        <p
          role={ok ? "status" : "alert"}
          className={`mt-3 text-sm ${ok ? "text-emerald-800" : "text-accent-600"}`}
        >
          {message}
        </p>
      ) : null}
    </article>
  );
}

function ReviewerPreviewButton({
  caseId,
  evidenceId,
}: {
  caseId: string;
  evidenceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await mintReviewerEvidencePreviewAction(caseId, evidenceId);
            if (!result.ok) {
              setError(result.message);
              setUrl(null);
              return;
            }
            setUrl(result.url);
          });
        }}
      >
        {pending ? "Opening…" : "Inspect (60s)"}
      </Button>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium underline underline-offset-2"
        >
          Open signed preview
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-accent-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
