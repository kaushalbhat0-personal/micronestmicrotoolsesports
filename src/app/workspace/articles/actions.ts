// Workspace server actions (P4) — VALIDATION + GATE ONLY.
// Thin orchestration: validate the untrusted draft record with the strict
// article schema, confirm a verified session exists, then return the
// disabled-boundary state. The gated writer operations are NEVER called
// while NEWS_WRITES_ENABLED is false — persistence awaits content-model
// acceptance + author decisions, and no fake success is returned.

"use server";

import { createClient } from "@/lib/supabase/server";
import { articleDraftSchema } from "@/features/news/schemas/article";

export interface ArticleWorkspaceActionState {
  ok: boolean;
  message: string;
}

export const ARTICLE_WORKSPACE_DISABLED_MESSAGE =
  "Article publishing is disabled in this phase: author identity, editorial authorization and database policies are awaiting decisions. Nothing was saved.";

async function requireSession(): Promise<boolean> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user !== null;
}

export async function saveArticleDraftAction(
  _prev: ArticleWorkspaceActionState,
  formData: FormData,
): Promise<ArticleWorkspaceActionState> {
  if (!(await requireSession())) {
    return { ok: false, message: "Sign in to work on drafts." };
  }
  const record: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    record[key] = value;
  }
  const parsed = articleDraftSchema.safeParse(record);
  if (!parsed.success) {
    return { ok: false, message: "Check the highlighted fields and try again." };
  }
  // Validated — but persistence is gated. No writer call, no fake success.
  return { ok: false, message: ARTICLE_WORKSPACE_DISABLED_MESSAGE };
}
