// P4 News — writer gate tests (pure, no database).
// Publishing stays disabled: valid inputs validate, then block with an
// explicit NewsWriteDisabledError. No fake success is possible.

import { describe, expect, it } from "vitest";
import { NewsWriteDisabledError } from "@/features/news/domain/public-card";
import {
  NEWS_WRITES_ENABLED,
  parseArticleDraft,
  publishArticleOp,
  scheduleArticleOp,
  unpublishArticleOp,
} from "@/features/news/server/article-writer";

const TEST_DRAFT = {
  slug: "test-schema-gate-story",
  headline: "TEST FIXTURE headline (never publish)",
  summary: "TEST FIXTURE summary.",
  category: "industry",
  authorDisplayName: "TEST Editorial Desk",
  body: [{ type: "paragraph", text: "TEST FIXTURE body." }],
  sourceKind: "original",
  lifecycle: "draft",
};

describe("news writer kill switch", () => {
  it("stays OFF (flipping it without acceptance breaks the route audit by design)", () => {
    expect(NEWS_WRITES_ENABLED).toBe(false);
  });

  it("validates drafts but always blocks the write", () => {
    expect(parseArticleDraft(TEST_DRAFT).slug).toBe("test-schema-gate-story");
    expect(() => publishArticleOp(TEST_DRAFT)).toThrow(NewsWriteDisabledError);
    expect(() => scheduleArticleOp({ slug: "test-schema-gate-story" })).toThrow(
      NewsWriteDisabledError,
    );
    expect(() => unpublishArticleOp({ slug: "test-schema-gate-story" })).toThrow(
      NewsWriteDisabledError,
    );
  });

  it("rejects invalid drafts with a validation error, not a silent write", () => {
    expect(() => publishArticleOp({ ...TEST_DRAFT, slug: "BAD SLUG!" })).toThrow();
  });
});
