import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  ArticlesEmpty,
  ArticlesSignInPrompt,
  ArticlesSkeleton,
  ArticlesUnavailable,
} from "./_components/workspace-states";

export const metadata: Metadata = {
  title: "Editorial workspace",
  description: "Draft, preview and review esports stories. Publishing is disabled in this phase.",
  // Private authenticated surface: never indexed, never followed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Editorial workspace index (P4). Presentation + validation foundation:
// session check only — no article persistence exists yet (NEWS_WRITES_ENABLED
// is false). Authenticated users with no storage see the honest empty state;
// any failure resolves to the generic unavailable state.
async function WorkspaceArticleList() {
  const client = await createClient();
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user === null) {
      return <ArticlesSignInPrompt />;
    }
  } catch {
    return <ArticlesUnavailable />;
  }
  return <ArticlesEmpty />;
}

export default function WorkspaceArticlesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Editorial workspace</h1>
      <p className="mt-3 text-sm text-slate-600">
        Drafts, previews and article metadata live here. Saving and publishing stay disabled
        until author identity, editorial authorization, content security and database policies
        are accepted — this surface never simulates a successful publish.
      </p>
      <p className="mt-3 text-sm">
        <Link
          href="/workspace/articles/new"
          className="rounded text-slate-900 underline underline-offset-2 hover:text-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Start a new draft →
        </Link>
      </p>
      <Suspense fallback={<ArticlesSkeleton />}>
        <WorkspaceArticleList />
      </Suspense>
    </div>
  );
}
