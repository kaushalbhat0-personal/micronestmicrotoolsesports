# Feature: Sponsor Sentinel (template)

This folder demonstrates the **feature-isolated** pattern every microtool must follow.

```
features/<tool-slug>/
├── components/   — tool-specific UI (pages compose these)
├── schemas/      — Zod schemas for this tool's inputs
├── services/     — business logic (pure, testable)
├── repositories/ — DB access for this tool's tables (when they exist)
├── types/        — tool-specific types
└── index.ts      — public barrel (what other domains may import)
```

Rules:
- No tool may import from another tool's internals — only via `index.ts` if shared.
- Business logic lives in `services/`, not in `page.tsx` or `components/`.
- Validation lives in `schemas/`, co-located, single source.
- DB access lives in `repositories/`, isolated behind functions.
- Page/route only orchestrates: auth → entitlement → service → render.

Do NOT implement business logic until foundation is approved.
