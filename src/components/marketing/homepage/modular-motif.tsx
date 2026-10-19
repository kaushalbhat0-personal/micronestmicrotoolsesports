/**
 * ModularMotif — shared decorative MicroNest visual language (server-only,
 * CSS/SVG, no motion tokens of its own). The mark suggests the modular nest:
 * two solid pieces plus one intentionally open piece.
 *
 * All exports are purely decorative (`aria-hidden`) — they must never carry
 * meaning, and must appear only ~3–5 times per page (transitions, kit
 * headers, final CTA).
 */
export function ModularMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect x="2" y="2" width="10" height="10" rx="2.5" fill="var(--color-primary)" opacity="0.85" />
      <rect x="14" y="2" width="10" height="10" rx="2.5" fill="var(--color-border-strong)" opacity="0.55" />
      <rect
        x="8"
        y="14"
        width="10"
        height="10"
        rx="2.5"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * SectionTransition — slim editorial bridge between major homepage areas
 * (practice → first challenge → toolbox → competition). Decorative only:
 * the sections themselves carry the accessible headings.
 */
export function SectionTransition({ label }: { label: string }) {
  return (
    <div aria-hidden="true" className="container-nest">
      <div className="mx-auto flex max-w-4xl items-center gap-3 py-1">
        <span className="h-px flex-1 bg-border" />
        <ModularMark />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
