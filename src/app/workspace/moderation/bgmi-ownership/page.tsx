import type { Metadata } from "next";
import Link from "next/link";
import {
  listCaseEvidenceForReview,
  listPendingBgmiOwnershipCases,
} from "@/features/player-profile/server/bgmi-ownership";
import {
  ForbiddenSuperAdminError,
  UnauthenticatedError,
  requireSuperAdmin,
} from "@/lib/auth/require-super-admin";
import { createClient } from "@/lib/supabase/server";
import { ModerationSignInPrompt } from "../_components/moderation-states";
import { ReviewCaseCard } from "./_components/review-case-card";

export const metadata: Metadata = {
  title: "BGMI ownership review",
  description: "Super-admin review queue for private BGMI ownership evidence.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BgmiOwnershipReviewPage() {
  const client = await createClient();

  try {
    await requireSuperAdmin(client);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            BGMI ownership review
          </h1>
          <ModerationSignInPrompt />
        </div>
      );
    }
    if (error instanceof ForbiddenSuperAdminError) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            BGMI ownership review
          </h1>
          <p className="mt-3 text-sm text-slate-600" role="alert">
            Not allowed. This queue is limited to platform super-admins.
          </p>
          <p className="mt-4">
            <Link href="/workspace/moderation" className="text-sm font-semibold underline">
              Back to moderation
            </Link>
          </p>
        </div>
      );
    }
    throw error;
  }

  const queue = await listPendingBgmiOwnershipCases(client, 50);
  const evidenceByCase = new Map<
    string,
    Awaited<ReturnType<typeof listCaseEvidenceForReview>>
  >();
  for (const item of queue) {
    evidenceByCase.set(item.case_id, await listCaseEvidenceForReview(client, item.case_id));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <p className="mb-4 text-sm">
        <Link href="/workspace/moderation" className="underline underline-offset-2">
          ← Moderation
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        BGMI ownership review
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Compare private evidence with the immutable claimed Player ID. Approvals are manual and
        auditable. This is not official BGMI endorsement. Bulk approve is not available.
      </p>

      {queue.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-medium">No pending submissions</p>
          <p className="mt-1 text-sm text-slate-600">
            When players submit ownership evidence, cases appear here for review.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {queue.map((item) => (
            <ReviewCaseCard
              key={item.case_id}
              item={item}
              evidence={evidenceByCase.get(item.case_id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
