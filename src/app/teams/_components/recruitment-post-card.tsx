// Recruitment post presentation (P1 foundation — display only).
// A recruitment post card shows the role needed, slots, minimum and target
// levels (always self-reported), region, tryout requirement and lifecycle
// status. Eligibility is presented as readable requirements, never as a
// score. This component takes typed view props only: there is no live post
// feed in P1 (open posts have no public RPC), so call sites pass explicitly
// provided values — no rows are invented, no applicant data is rendered.

import Link from "next/link";
import type { RecruitmentPostInput } from "@/features/teams/schemas/team";
import { SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";

export interface RecruitmentPostView {
  teamName: string;
  teamSlug: string;
  post: RecruitmentPostInput;
}

const statusStyles: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-900",
  paused: "bg-amber-100 text-amber-900",
  closed: "bg-slate-100 text-slate-600",
  filled: "bg-slate-100 text-slate-600",
};

export function RecruitmentPostCard({ teamName, teamSlug, post }: RecruitmentPostView) {
  const statusStyle = statusStyles[post.status] ?? statusStyles["closed"] ?? "";
  return (
    <article
      aria-label={`Recruitment post by ${teamName} for ${post.roleNeeded}`}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          <Link
            href={`/teams/${teamSlug}`}
            className="rounded underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {teamName}
          </Link>{" "}
          <span className="font-normal text-slate-500">needs {post.roleNeeded}</span>
        </h3>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}
        >
          {post.status}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Role needed</dt>
          <dd className="mt-0.5 font-medium">{post.roleNeeded}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Slots</dt>
          <dd className="mt-0.5 font-medium">{post.slots}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Minimum level
          </dt>
          <dd className="mt-0.5 font-medium" title={SELF_REPORTED_LEVEL_NOTE}>
            {post.currentLevelMin} <span className="font-normal text-slate-500">(self-reported)</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">Region</dt>
          <dd className="mt-0.5 font-medium">{post.regionCode}</dd>
        </div>
      </dl>

      <ul aria-label="Requirements" className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
        <li>Plays {post.roleNeeded} at {post.currentLevelMin} context or above (self-reported).</li>
        <li>Available in {post.regionCode}.</li>
        <li>{post.tryoutRequired ? "Tryout required before joining." : "No tryout required."}</li>
      </ul>
      <p className="mt-2 text-xs text-slate-500">{SELF_REPORTED_LEVEL_NOTE}</p>
    </article>
  );
}
