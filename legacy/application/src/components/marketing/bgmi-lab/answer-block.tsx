/**
 * AnswerBlock — concise direct-answer prose for AEO/people-first content.
 * Ordinary semantic HTML only: no hidden text, no keyword stuffing,
 * no schema-only content. Rendered only when the registry provides
 * an `answer` for the tool.
 */
export function AnswerBlock({ answer }: { answer: string }) {
  return (
    <p className="rounded-[12px] border border-primary/20 bg-primary/[0.04] px-4 py-3 text-[15px] leading-relaxed text-foreground">
      {answer}
    </p>
  );
}
