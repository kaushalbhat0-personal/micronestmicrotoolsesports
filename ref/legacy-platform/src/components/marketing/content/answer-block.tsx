export function AnswerBlock({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-[12px] border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{question}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{answer}</p>
    </div>
  );
}
