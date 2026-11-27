// Editorial draft editor (presentation + validation foundation).
// Client-side local state only: validates against the strict article draft
// schema and renders a live preview. There is NO persistence path — the
// save/publish buttons call disabled server actions that always return
// { ok: false } (no fake success, no invented storage).

"use client";

import { useMemo, useState } from "react";
import { articleDraftSchema } from "@/features/news/schemas/article";
import { sanitizePlainText } from "@/features/news/domain/sanitize";
import { ArticleBody } from "@/app/news/_components/article-body";
import { NewsCategoryBadge, SourceKindMarker } from "@/app/news/_components/news-bits";
import { ARTICLE_CATEGORIES, articleCategoryLabel } from "@/features/news/domain/article";

const EMPTY_BODY = "Write the first paragraph of the story here. Raw HTML is not supported.";

export function ArticleDraftEditor() {
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<string>("industry");
  const [sourceKind, setSourceKind] = useState<string>("original");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bodyText, setBodyText] = useState(EMPTY_BODY);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const blocks = useMemo(
    () => [{ type: "paragraph" as const, text: sanitizePlainText(bodyText || EMPTY_BODY, 2000) }],
    [bodyText],
  );

  function handleValidate() {
    const result = articleDraftSchema.safeParse({
      slug: "draft-preview-story",
      headline: headline.trim() === "" ? "Untitled draft headline" : headline,
      summary: summary.trim() === "" ? "A short summary of the draft story." : summary,
      category,
      authorDisplayName: "Editorial desk (preview)",
      body: blocks,
      sourceKind,
      ...(sourceKind === "sourced"
        ? {
            sourceName: sourceName.trim() === "" ? "Example Outlet" : sourceName,
            sourceUrl: sourceUrl.trim() === "" ? "https://example.com/announcement" : sourceUrl,
          }
        : {}),
      lifecycle: "draft",
    });
    if (result.success) {
      setValidationMessage("Draft validates against the editorial schema. Publishing is disabled.");
    } else {
      const first = result.error.issues[0];
      setValidationMessage(
        first ? `Needs attention: ${first.path.join(".") || "draft"} — ${first.message}` : "Draft is invalid.",
      );
    }
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="draft-editor-heading" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="draft-editor-heading" className="text-lg font-semibold">
          Draft editor
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Validation foundation only. Nothing here is saved or published.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Headline
            <input
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
              maxLength={140}
              placeholder="Headline"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Summary
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              maxLength={300}
              rows={3}
              placeholder="One-to-two sentence summary"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                {ARTICLE_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {articleCategoryLabel(entry)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Source kind
              <select
                value={sourceKind}
                onChange={(event) => setSourceKind(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="original">Original reporting</option>
                <option value="sourced">Sourced announcement</option>
              </select>
            </label>
          </div>
          {sourceKind === "sourced" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Source name
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  maxLength={120}
                  placeholder="Example Outlet"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Source URL (https)
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  inputMode="url"
                  placeholder="https://example.com/announcement"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
            </div>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium">
            Body (plain text — one paragraph preview)
            <textarea
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              rows={6}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleValidate}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Validate draft
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Publishing is disabled in this phase"
              className="cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
            >
              Publish (disabled)
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Unpublishing is disabled in this phase"
              className="cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500"
            >
              Unpublish (disabled)
            </button>
          </div>
          {validationMessage ? (
            <p role="status" className="text-sm text-slate-600">
              {validationMessage}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="draft-preview-heading" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 id="draft-preview-heading" className="text-lg font-semibold">
          Preview
        </h2>
        <p className="mt-1 text-xs text-slate-500">How the story would read once published.</p>
        <div className="mt-4 overflow-hidden rounded-lg bg-arena-950 px-4 py-6 text-white">
          <p className="text-xs font-bold tracking-[0.18em] text-accent-300 uppercase">News · Preview</p>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight uppercase">
            {headline.trim() === "" ? "Untitled draft headline" : headline}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <NewsCategoryBadge category={(category as "industry" | "game-update" | "tournament" | "team" | "player" | "platform" | "guide") ?? "industry"} />
            <SourceKindMarker kind={sourceKind === "sourced" ? "sourced" : "original"} />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {summary.trim() === "" ? "A short summary of the draft story." : summary}
        </p>
        <ArticleBody body={blocks} />
      </section>
    </div>
  );
}
