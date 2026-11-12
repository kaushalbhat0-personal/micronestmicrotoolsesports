// Applicant's own application status presentation (P1 foundation).
// Shows ONLY the signed-in applicant's own applications as { post, team,
// status } triples — never other applicants, never notes to captains, never
// decision metadata. In P1 there is no live application feed (reads are
// applicant-or-captain gated under D1 RLS), so the default render is an
// honest empty state. Captain decisions, roster insertion and ownership
// transfer are explicitly out of scope and never rendered here.

import Link from "next/link";

export interface OwnApplicationView {
  postLabel: string;
  teamName: string;
  teamSlug: string;
  status: string;
}

interface ApplicationStatusProps {
  applications: OwnApplicationView[];
}

export function ApplicationStatus({ applications }: ApplicationStatusProps) {
  return (
    <section aria-labelledby="own-applications-heading" className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 id="own-applications-heading" className="text-lg font-semibold">
        Your applications
      </h2>
      {applications.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">
          No applications yet. When recruitment opens, your applications and their status will
          appear here — visible only to you and the team&apos;s captains, never publicly.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {applications.map((application) => (
            <li
              key={`${application.teamSlug}:${application.postLabel}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <span>
                <Link
                  href={`/teams/${application.teamSlug}`}
                  className="rounded font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {application.teamName}
                </Link>{" "}
                <span className="text-slate-600">· {application.postLabel}</span>
              </span>
              <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {application.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Application information is private: it is never listed on team pages or in search results.
      </p>
    </section>
  );
}
