---
name: react
description: "Use for React 19 component composition, state/effect discipline, server/client boundaries, and a11y — version-aware. Keep components small and predictable."
---

# React — Framework Guidance (19.1)

**When to use:** Component design, composition, state, effects, props, a11y, server/client split.

**When not to use:** Styling-only (use `tailwind` skill) or DB-only without UI.

**Source:** Adapted from PyModel React Frontend Skills — https://github.com/PyModel/react-frontend-skills (`react` skill, MIT). Installed **React 19.1** takes precedence.

## Rules

**Rule: Composition over global client state**
Why: Predictable, no unnecessary re-renders.
Good: `src/components/shared/org-switcher.tsx:1` receives `organizations` prop from server layout `src/app/(dashboard)/layout.tsx:1`, local `useState` only for dropdown open. `DashboardShell` `src/components/layout/dashboard-shell.tsx:1` is client but reads `useParams()` + props, no global store.
Bad: Adding Zustand/Redux for org list — prop drilling + server fetch suffices.

**Rule: Small predictable components**
Why: Junior-readable, testable.
Good: `src/components/ui/button.tsx:1` — 50 lines, `variant`/`size` props, `loading`, `focus-visible:ring`. `Card` split into `CardHeader`/`Title`/`Description`/`Content`.
Bad: 300-line `DashboardPage` handling fetching, transforming, rendering, error, and nav — split per `architecture` skill.

**Rule: Effect discipline**
Why: Avoid loops, leaks.
Good: `src/components/ui/dialog.tsx:13` — `useEffect` for `Escape` listener + cleanup, `useEffect` for body overflow.
Bad: `useEffect` fetching Supabase in client — use Server Component `requireOrganizationContext` instead.

**Rule: Server/client boundary**
Why: Secrets stay server.
Good: `src/app/(auth)/login/login-form.tsx:1` is `"use client"` (needs `window.location`, form state) and uses browser supabase `src/lib/supabase/client.ts:1` (anon only). `src/app/(auth)/login/page.tsx:1` stays server and redirects if `auth.getUser()`.
Bad: Client component importing `src/lib/supabase/admin.ts` (service_role) — never client.

**Rule: A11y by default**
Why: Required for esports diverse users.
Good: `Dialog` `role="dialog" aria-modal`, `Dropdown` `role="menu"/menuitem` + Escape, `Button` `focus-visible`, `LoadingState` `role="status"`.
Bad: `div onClick` without `role`/`tabIndex`/keyboard — use `Button` primitive.

## Checklist

- [ ] Props typed, no `any`, `exactOptionalPropertyTypes` respected (`activeOrgId?: string | undefined`)?
- [ ] State minimal, derived values not duplicated in state?
- [ ] `"use client"` only with browser need, justified in comment?
- [ ] `key` stable (e.g., `org.id`), not index?

See `ARCHITECTURE.md` §13 and `ui-ux` skill for tokens/a11y.
