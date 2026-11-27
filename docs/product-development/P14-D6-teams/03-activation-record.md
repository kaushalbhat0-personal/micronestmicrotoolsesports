# 03 — Activation Record (P14-D6)

## Change

```ts
// src/features/teams/domain/workspace.ts
export const WORKSPACE_WRITES_ENABLED: boolean = true;
```

Re-exported from `workspace-writer.ts` for existing imports.

## Environment

| Target | Status |
| --- | --- |
| Local / worktree source | **Activated** |
| Vercel preview/production env vars | **Not changed** (switch is code constant, not `process.env`) |
| Deployment | **Not performed** |

Activation takes effect wherever this source is built/run. Production runtime remains previous until a future deploy of this worktree.

## Fail-closed behavior

- `isDisabled()` returns `!WORKSPACE_WRITES_ENABLED`
- If constant is set back to `false`, actions return `WORKSPACE_DISABLED_MESSAGE`
- No client flag can override the server constant

## Other switches

All remain `false` (verified by import check during app-path battery).
