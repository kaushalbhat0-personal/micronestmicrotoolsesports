// Application form UX (P1 foundation — validation presentation only).
// The single applicant field is an optional note (max 200 chars, per the D1
// `applicationSchema` boundary). The form has NO action and the submit
// control is disabled: no application insert is enabled in this phase (D1
// migrations UNAPPLIED, D1-D3/D1-D12 pending). The boundary notice names
// exactly why applying is unavailable instead of faking success.

import { MAX_NOTE_LENGTH } from "@/features/teams/schemas/team";

interface ApplicationFormProps {
  teamName: string;
  roleNeeded: string;
}

export function ApplicationForm({ teamName, roleNeeded }: ApplicationFormProps) {
  return (
    <div>
      <form aria-label={`Apply to ${teamName}`} aria-describedby="application-form-boundary">
        <div className="flex flex-col gap-1">
          <label htmlFor="application-note" className="text-sm font-medium">
            Note to the captain <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="application-note"
            name="note"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            placeholder={`Why you fit the ${roleNeeded} role…`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
          />
          <p className="text-xs text-slate-500">Max {MAX_NOTE_LENGTH} characters.</p>
        </div>
        <div className="mt-3">
          <button
            type="submit"
            disabled
            aria-disabled="true"
            className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Apply (unavailable)
          </button>
        </div>
      </form>
      <p
        id="application-form-boundary"
        role="note"
        className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Applications are disabled in this phase: recruitment writes are awaiting migration
        acceptance and captain-authority approval. No application is submitted from this form, and
        no application information is shown publicly.
      </p>
    </div>
  );
}
