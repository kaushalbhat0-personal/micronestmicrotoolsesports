// News publishing writer (P4) — VALIDATION + GATE ONLY.
// Persistent article writes stay DISABLED until, in order: (1) content-model
// acceptance (04-content-model.md), (2) migration + remote application by the
// authorized owner flow, (3) author-identity + editorial-authorization
// approval, (4) content-security + database-policy verification, (5)
// session-derived operation verification. The kill switch below is asserted
// ON by `src/app/news/routes.test.ts`: flipping it without the acceptance
// sequence breaks the suite on purpose.
//
// What this module DOES today (all safe without a database):
// - Strict Zod validation of draft/update/publish/unpublish inputs
//   (protected keys — ids, author identity internals, lifecycle internals,
//   verification flags — are REJECTED, never silently dropped).
// - An explicit NewsWriteDisabledError BEFORE any table touch, so no fake
//   success is possible and no unsafe write path is enabled.
//
// Identity + below-gate statements are deliberately absent: the author and
// authorization model is undecided, so even the gated SQL shape is not
// specified here — see 04-content-model.md.

import {
  NewsDirectoryValidationError,
  NewsWriteDisabledError,
} from "../domain/public-card";
import {
  articleDraftSchema,
  articlePublishSchema,
  articleUnpublishSchema,
  articleUpdateSchema,
  type ArticleDraftInput,
  type ArticlePublishInput,
  type ArticleUnpublishInput,
  type ArticleUpdateInput,
} from "../schemas/article";

/** Kill switch. Enabling requires the acceptance sequence AND updating the static gate test. */
export const NEWS_WRITES_ENABLED: boolean = false;

function isDisabled(): boolean {
  return !NEWS_WRITES_ENABLED;
}

export function parseArticleDraft(input: unknown): ArticleDraftInput {
  try {
    return articleDraftSchema.parse(input);
  } catch {
    throw new NewsDirectoryValidationError();
  }
}

export function parseArticleUpdate(input: unknown): ArticleUpdateInput {
  try {
    return articleUpdateSchema.parse(input);
  } catch {
    throw new NewsDirectoryValidationError();
  }
}

export function parseArticlePublish(input: unknown): ArticlePublishInput {
  try {
    return articlePublishSchema.parse(input);
  } catch {
    throw new NewsDirectoryValidationError();
  }
}

export function parseArticleUnpublish(input: unknown): ArticleUnpublishInput {
  try {
    return articleUnpublishSchema.parse(input);
  } catch {
    throw new NewsDirectoryValidationError();
  }
}

// Publishing operations. Validate, then block before any table touch.
export function publishArticleOp(input: unknown): { slug: string } {
  const parsed = parseArticleDraft(input);
  void parsed;
  if (isDisabled()) {
    throw new NewsWriteDisabledError();
  }
  // --- Below the gate (acceptance sequence only; authorization pending) ---
  throw new NewsWriteDisabledError();
}

export function scheduleArticleOp(input: unknown): { slug: string } {
  const parsed = parseArticlePublish(input);
  void parsed;
  if (isDisabled()) {
    throw new NewsWriteDisabledError();
  }
  throw new NewsWriteDisabledError();
}

export function unpublishArticleOp(input: unknown): { slug: string } {
  const parsed = parseArticleUnpublish(input);
  void parsed;
  if (isDisabled()) {
    throw new NewsWriteDisabledError();
  }
  throw new NewsWriteDisabledError();
}
