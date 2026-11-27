"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type {
  BgmiOwnershipCaseStatusView,
  BgmiOwnershipEvidenceSummary,
} from "@/features/player-profile/domain/bgmi-ownership";
import {
  BGMI_OWNERSHIP_MAX_EVIDENCE,
  BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES,
} from "@/features/player-profile/domain/bgmi-ownership";
import {
  createBgmiOwnershipDraftAction,
  mintBgmiOwnershipPreviewUrlAction,
  submitBgmiOwnershipCaseAction,
  uploadBgmiOwnershipEvidenceAction,
  withdrawBgmiOwnershipCaseAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

const maxMb = Math.floor(BGMI_OWNERSHIP_MAX_ORIGINAL_BYTES / (1024 * 1024));

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function BgmiOwnershipVerificationSection({
  gameUserId,
  caseStatus,
  evidence,
}: {
  gameUserId: string | null;
  caseStatus: BgmiOwnershipCaseStatusView | null;
  evidence: BgmiOwnershipEvidenceSummary[];
}) {
  const [createState, createAction, createPending] = useActionState(
    createBgmiOwnershipDraftAction,
    initialState,
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadBgmiOwnershipEvidenceAction,
    initialState,
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitBgmiOwnershipCaseAction,
    initialState,
  );
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(
    withdrawBgmiOwnershipCaseAction,
    initialState,
  );

  const feedback =
    createState.message ||
    uploadState.message ||
    submitState.message ||
    withdrawState.message;
  const feedbackOk = createState.message
    ? createState.ok
    : uploadState.message
      ? uploadState.ok
      : submitState.message
        ? submitState.ok
        : withdrawState.ok;

  return (
    <BgmiOwnershipVerificationView
      gameUserId={gameUserId}
      caseStatus={caseStatus}
      evidence={evidence}
      createAction={createAction}
      createPending={createPending}
      uploadAction={uploadAction}
      uploadPending={uploadPending}
      submitAction={submitAction}
      submitPending={submitPending}
      withdrawAction={withdrawAction}
      withdrawPending={withdrawPending}
      feedback={feedback}
      feedbackOk={feedbackOk}
    />
  );
}

/** Pure presentational view — unit-tested via renderToStaticMarkup. */
export function BgmiOwnershipVerificationView({
  gameUserId,
  caseStatus,
  evidence,
  createAction,
  createPending,
  uploadAction,
  uploadPending,
  submitAction,
  submitPending,
  withdrawAction,
  withdrawPending,
  feedback,
  feedbackOk,
  enableEvidencePreview = true,
}: {
  gameUserId: string | null;
  caseStatus: BgmiOwnershipCaseStatusView | null;
  evidence: BgmiOwnershipEvidenceSummary[];
  createAction: (payload: FormData) => void;
  createPending: boolean;
  uploadAction: (payload: FormData) => void;
  uploadPending: boolean;
  submitAction: (payload: FormData) => void;
  submitPending: boolean;
  withdrawAction: (payload: FormData) => void;
  withdrawPending: boolean;
  feedback: string;
  feedbackOk: boolean;
  /** Set false in static markup unit tests (preview uses client hooks). */
  enableEvidencePreview?: boolean | undefined;
}) {
  const hasId = gameUserId !== null && gameUserId.length > 0;
  const status = caseStatus?.status ?? null;

  return (
    <section
      aria-labelledby="bgmi-ownership-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
      id="bgmi-ownership-verification"
    >
      <h2 id="bgmi-ownership-heading" className="text-lg font-semibold">
        BGMI ownership evidence{" "}
        <span className="font-normal text-slate-500">(private)</span>
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Submit up to two screenshots that show your in-game IGN and BGMI Player ID together when
        possible. Screenshots are private — they are not shown on public profiles, the directory,
        or Share Kit cards. Manual review comes later; this is not official BGMI verification and
        screenshots are not treated as tamper-proof.
      </p>

      {!hasId ? (
        <NoIdState />
      ) : status === "approved" && caseStatus ? (
        <ApprovedState caseStatus={caseStatus} />
      ) : status === "rejected" && caseStatus ? (
        <RejectedState
          caseStatus={caseStatus}
          createAction={createAction}
          createPending={createPending}
        />
      ) : status === "pending_review" && caseStatus ? (
        <PendingState
          caseStatus={caseStatus}
          withdrawAction={withdrawAction}
          pending={withdrawPending}
        />
      ) : status === "id_mismatch" && caseStatus ? (
        <MismatchState
          caseStatus={caseStatus}
          withdrawAction={withdrawAction}
          pending={withdrawPending}
        />
      ) : status === "withdrawn" && caseStatus ? (
        <WithdrawnState
          caseStatus={caseStatus}
          createAction={createAction}
          createPending={createPending}
        />
      ) : status === "draft" && caseStatus ? (
        <DraftState
          gameUserId={gameUserId}
          caseStatus={caseStatus}
          evidence={evidence}
          uploadAction={uploadAction}
          uploadPending={uploadPending}
          submitAction={submitAction}
          submitPending={submitPending}
          withdrawAction={withdrawAction}
          withdrawPending={withdrawPending}
          enableEvidencePreview={enableEvidencePreview}
        />
      ) : (
        <ReadyState
          gameUserId={gameUserId}
          createAction={createAction}
          createPending={createPending}
        />
      )}

      {feedback.length > 0 ? (
        <p
          role={feedbackOk ? "status" : "alert"}
          aria-live="polite"
          className={`mt-4 text-sm ${feedbackOk ? "text-emerald-800" : "text-accent-600"}`}
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}

function NoIdState() {
  return (
    <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm text-slate-700">
        Save your BGMI Player ID before you can upload ownership evidence.
      </p>
      <p className="mt-3">
        <a
          href="#bgmi-player-id-settings"
          className="text-sm font-semibold text-slate-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Go to BGMI Player ID settings
        </a>
      </p>
    </div>
  );
}

function ReadyState({
  gameUserId,
  createAction,
  createPending,
}: {
  gameUserId: string;
  createAction: (payload: FormData) => void;
  createPending: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm">
        Saved Player ID (private):{" "}
        <strong className="font-mono tracking-wide">{gameUserId}</strong>
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Open your in-game BGMI profile so IGN and Player ID are visible.</li>
        <li>Capture one screenshot (required). Add a second only if needed for clarity.</li>
        <li>
          Accepted formats: JPEG, PNG, or WebP — max {maxMb} MB each (max{" "}
          {BGMI_OWNERSHIP_MAX_EVIDENCE} images).
        </li>
      </ol>
      <form action={createAction}>
        <Button type="submit" disabled={createPending}>
          {createPending ? "Starting…" : "Start evidence submission"}
        </Button>
      </form>
    </div>
  );
}

function DraftState({
  gameUserId,
  caseStatus,
  evidence,
  uploadAction,
  uploadPending,
  submitAction,
  submitPending,
  withdrawAction,
  withdrawPending,
  enableEvidencePreview,
}: {
  gameUserId: string;
  caseStatus: BgmiOwnershipCaseStatusView;
  evidence: BgmiOwnershipEvidenceSummary[];
  uploadAction: (payload: FormData) => void;
  uploadPending: boolean;
  submitAction: (payload: FormData) => void;
  submitPending: boolean;
  withdrawAction: (payload: FormData) => void;
  withdrawPending: boolean;
  enableEvidencePreview: boolean;
}) {
  const canAddMore = evidence.length < BGMI_OWNERSHIP_MAX_EVIDENCE;
  const canSubmit = evidence.length >= 1;

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm" role="status">
        Draft in progress — {evidence.length} of {BGMI_OWNERSHIP_MAX_EVIDENCE} screenshots
        attached.
      </p>
      <p className="text-sm">
        Player ID that will be associated on submit:{" "}
        <strong className="font-mono tracking-wide">{gameUserId}</strong>
      </p>

      <EvidenceList
        caseId={caseStatus.id}
        evidence={evidence}
        enableEvidencePreview={enableEvidencePreview}
      />

      {canAddMore ? (
        <form action={uploadAction} className="grid gap-3">
          <input type="hidden" name="case_id" value={caseStatus.id} />
          <div>
            <label htmlFor="bgmi-evidence-file" className="text-sm font-medium">
              {evidence.length === 0 ? "Required screenshot" : "Optional second screenshot"}
            </label>
            <input
              id="bgmi-evidence-file"
              name="evidence"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
            <p className="mt-1 text-xs text-slate-500">
              JPEG, PNG, or WebP up to {maxMb} MB. Client checks are for guidance only; the server
              re-encodes and validates every upload.
            </p>
          </div>
          <Button type="submit" disabled={uploadPending}>
            {uploadPending ? "Uploading…" : "Upload screenshot"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-slate-600" role="status">
          Maximum of {BGMI_OWNERSHIP_MAX_EVIDENCE} screenshots reached.
        </p>
      )}

      {canSubmit ? (
        <form
          action={submitAction}
          className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
        >
          <input type="hidden" name="case_id" value={caseStatus.id} />
          <h3 className="text-sm font-semibold">Confirm submission</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Associated Player ID: <span className="font-mono">{gameUserId}</span> (captured
              server-side on submit)
            </li>
            <li>
              {evidence.length} evidence image{evidence.length === 1 ? "" : "s"}
            </li>
            <li>Submitted evidence cannot be replaced while pending.</li>
            <li>To change evidence later, withdraw and submit again.</li>
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" required className="mt-1 size-4" />
            <span>
              I understand evidence cannot be replaced while this submission is pending.
            </span>
          </label>
          <Button type="submit" disabled={submitPending}>
            {submitPending ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
      ) : null}

      <form action={withdrawAction}>
        <input type="hidden" name="case_id" value={caseStatus.id} />
        <Button type="submit" variant="secondary" disabled={withdrawPending}>
          {withdrawPending ? "Cancelling…" : "Cancel draft"}
        </Button>
      </form>
    </div>
  );
}

function EvidenceList({
  caseId,
  evidence,
  enableEvidencePreview,
}: {
  caseId: string;
  evidence: BgmiOwnershipEvidenceSummary[];
  enableEvidencePreview: boolean;
}) {
  if (evidence.length === 0) {
    return <p className="text-sm text-slate-600">No screenshots uploaded yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {evidence.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
        >
          <span>
            Image {item.sort_order}: {item.content_type.replace("image/", "").toUpperCase()} ·{" "}
            {item.width}×{item.height} · {Math.round(item.byte_size / 1024)} KB
          </span>
          {enableEvidencePreview ? (
            <EvidencePreviewButton caseId={caseId} evidenceId={item.id} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EvidencePreviewButton({
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
            const result = await mintBgmiOwnershipPreviewUrlAction(caseId, evidenceId);
            if (!result.ok) {
              setError(result.message);
              setUrl(null);
              return;
            }
            setUrl(result.url);
          });
        }}
      >
        {pending ? "Opening…" : "Preview"}
      </Button>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-slate-900 underline underline-offset-2"
        >
          Open preview (expires in 60s)
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

function PendingState({
  caseStatus,
  withdrawAction,
  pending,
}: {
  caseStatus: BgmiOwnershipCaseStatusView;
  withdrawAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-medium text-slate-900" role="status">
        Status: Pending manual review
      </p>
      <p className="text-sm text-slate-600">
        Submitted {formatSubmittedAt(caseStatus.submitted_at)}. A reviewer will assess your
        evidence later. There is no automatic approval from this screen.
      </p>
      {caseStatus.claimed_game_user_id ? (
        <p className="text-sm">
          Submitted for Player ID:{" "}
          <strong className="font-mono">{caseStatus.claimed_game_user_id}</strong>
        </p>
      ) : null}
      {caseStatus.live_id_matches_claim === false ? (
        <p role="alert" className="text-sm text-accent-600">
          Your saved Player ID no longer matches this submission. Withdraw and start again after
          updating your ID.
        </p>
      ) : null}
      <p className="text-sm text-slate-600">
        Evidence cannot be replaced while pending. Withdraw to delete evidence files and submit
        again.
      </p>
      <form action={withdrawAction}>
        <input type="hidden" name="case_id" value={caseStatus.id} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Withdrawing…" : "Withdraw submission"}
        </Button>
      </form>
    </div>
  );
}

function MismatchState({
  caseStatus,
  withdrawAction,
  pending,
}: {
  caseStatus: BgmiOwnershipCaseStatusView;
  withdrawAction: (payload: FormData) => void;
  pending: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-medium text-slate-900" role="status">
        Status: Player ID changed after submission
      </p>
      <p className="text-sm text-slate-700">
        Your BGMI Player ID changed after this evidence was submitted. The original snapshot is not
        rewritten, and this submission cannot be approved. Withdraw to delete the evidence files,
        then start a new submission with your current ID.
      </p>
      {caseStatus.claimed_game_user_id ? (
        <p className="text-sm">
          Original submitted ID:{" "}
          <strong className="font-mono">{caseStatus.claimed_game_user_id}</strong>
        </p>
      ) : null}
      <form action={withdrawAction}>
        <input type="hidden" name="case_id" value={caseStatus.id} />
        <Button type="submit" disabled={pending}>
          {pending ? "Withdrawing…" : "Withdraw and restart"}
        </Button>
      </form>
    </div>
  );
}

function WithdrawnState({
  caseStatus,
  createAction,
  createPending,
}: {
  caseStatus: BgmiOwnershipCaseStatusView;
  createAction: (payload: FormData) => void;
  createPending: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-medium" role="status">
        Status: Withdrawn
      </p>
      <p className="text-sm text-slate-600">
        Evidence files for this submission were deleted through the withdrawal lifecycle. Minimal
        non-sensitive audit metadata may remain. You can start a new submission anytime.
      </p>
      <p className="text-xs text-slate-500">
        Withdrawn {formatSubmittedAt(caseStatus.withdrawn_at)}
      </p>
      <form action={createAction}>
        <Button type="submit" disabled={createPending}>
          {createPending ? "Starting…" : "Start a new submission"}
        </Button>
      </form>
    </div>
  );
}

function ApprovedState({ caseStatus }: { caseStatus: BgmiOwnershipCaseStatusView }) {
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm font-medium text-emerald-900" role="status">
        Status: BGMI ownership evidence reviewed
      </p>
      <p className="text-sm text-slate-600">
        A platform reviewer accepted your evidence for the Player ID you submitted. This is not
        official BGMI endorsement. If you change your saved Player ID, the public status is
        invalidated.
      </p>
      <p className="text-xs text-slate-500">
        Decided {formatSubmittedAt(caseStatus.decided_at)}
      </p>
    </div>
  );
}

function RejectedState({
  caseStatus,
  createAction,
  createPending,
}: {
  caseStatus: BgmiOwnershipCaseStatusView;
  createAction: (payload: FormData) => void;
  createPending: boolean;
}) {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm font-medium text-slate-900" role="status">
        Status: Not approved
      </p>
      {caseStatus.player_facing_message ? (
        <p className="text-sm text-slate-700">{caseStatus.player_facing_message}</p>
      ) : (
        <p className="text-sm text-slate-700">
          Your evidence was not approved. You may start a new submission with clearer screenshots.
        </p>
      )}
      <p className="text-xs text-slate-500">
        Decided {formatSubmittedAt(caseStatus.decided_at)}
      </p>
      <form action={createAction}>
        <Button type="submit" disabled={createPending}>
          {createPending ? "Starting…" : "Start a new submission"}
        </Button>
      </form>
    </div>
  );
}
