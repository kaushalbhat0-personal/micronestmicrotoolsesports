import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArticleDraftEditor } from "../_components/article-draft-editor";

export const metadata: Metadata = {
  title: "New story draft",
  description: "Start an editorial draft. Publishing is disabled in this phase.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Editorial workspace — new draft (P4). Presentation + validation
// foundation only: the editor validates locally and previews safely.
// No persistence path exists (actions return the disabled boundary).
export default function NewArticlePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <p className="mb-6 text-sm">
        <Link
          href="/workspace/articles"
          className="rounded text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          ← Back to drafts
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New story draft</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Drafts validate against the strict editorial schema (headline, summary, category,
        game association, source attribution, structured body). Saving and publishing stay
        disabled until author identity and editorial authorization are accepted — nothing
        here is stored or published.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-slate-500">Loading editor…</p>}>
        <ArticleDraftEditor />
      </Suspense>
    </div>
  );
}
