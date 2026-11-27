// Safe article-body renderer. Renders ONLY structured blocks as plain
// text elements: paragraphs, headings, blockquotes, lists. Raw HTML is never
// rendered: block text arrives sanitized from the reader and React escapes
// it again at render.

import type { PublicArticleDetail } from "@/features/news/domain/public-card";

export function ArticleBody({ body }: { body: PublicArticleDetail["body"] }) {
  return (
    <div className="mt-6 max-w-2xl space-y-4">
      {body.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index} className="pt-2 text-xl font-bold tracking-tight">
              {block.text}
            </h2>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="border-l-4 border-accent-600 bg-slate-50 px-4 py-3"
            >
              <p className="text-base leading-relaxed text-slate-800 italic">
                &ldquo;{block.text}&rdquo;
              </p>
              {block.attribution ? (
                <cite className="mt-1 block text-xs font-medium text-slate-500 not-italic">
                  — {block.attribution}
                </cite>
              ) : null}
            </blockquote>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-base leading-relaxed text-slate-800">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
