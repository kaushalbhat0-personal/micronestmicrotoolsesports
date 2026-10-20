import type { BgmiLabTool } from "@/config/public/bgmi-lab";

/**
 * GameFaq — visible FAQ rendered with native <details>.
 * The FAQPage JSON-LD emitted by the shell maps 1:1 to these visible
 * entries — never generate hidden FAQ content solely for search engines.
 */
export function GameFaq({ tool }: { tool: BgmiLabTool }) {
  return (
    <section className="rounded-[16px] border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-normal tracking-tight">Questions</h2>
      <div className="mt-3 space-y-3">
        {tool.faqs.map((f) => (
          <details
            key={f.question}
            className="rounded-[12px] border border-border bg-surface-muted/40 px-4 py-3 text-sm leading-relaxed"
          >
            <summary className="cursor-pointer font-medium">{f.question}</summary>
            <p className="mt-2 text-muted-foreground">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
