# 01 — Current Auth and Navigation Audit (P14-D10)

Date: 2026-11-16. Source: repo read (no writes, no secrets accessed).

## Header / navigation (before)

- `src/components/shared/site-header.tsx` — client component, no session awareness.
- Desktop (`xl:flex` only, 9 items + Settings + CTA): Discover players, Discover teams,
  Discover organizations, Discover organizers, Discover brands, Tournaments, News, Tools,
  About + Settings + "Explore players" CTA. Crowded single row; anonymous and authenticated
  see identical chrome; no Log in / Sign up; no account menu.
- Mobile: hamburger toggles stacked copy of the same 9 links + Settings + CTA; no auth
  actions; touch targets 44px (kept).
- `src/app/layout.tsx` renders `<SiteHeader />` statically above `<main>`.
- Footer (`site-footer.tsx`, arena band) indexed real routes only; no auth links.

## Auth surface (before)

- Provider: email/password only via `@supabase/ssr` + `@supabase/supabase-js`.
  `supabase/config.toml`: `[auth.external.*]` all disabled; no OAuth configured.
  G1-8A audit confirms no OAuth provider and no Auth-config read path in tooling.
- Login: `src/app/login/page.tsx` + `login-form.tsx` — `signInWithPassword` in the
  browser client, `?next=` allowlist of exactly 3 paths
  (`/workspace/teams`, `/teams/new`, `/settings/profile`), fallback `/workspace/teams`.
- Signup: none (grep `signup` = only test negative-assertions and integration helpers).
- Callback: none (`/auth/callback` did not exist).
- Recovery: none (`resetPasswordForEmail` zero matches, no recovery route).
- Logout: `src/app/logout/route.ts` — `POST`/`GET` clears server cookies, 303 to `/`.
- Session: `src/lib/supabase/{server,middleware,client}.ts` — middleware `getUser()` refresh,
  server `createServerClient` with anon key + cookies, browser `createBrowserClient`.
  P14-D7 verified cookie-session (not localStorage-only).
- Verified email: enforced at RPC layer (`create_team` requires
  `auth.users.email_confirmed_at IS NOT NULL`); no app-layer `email_confirmed_at` gate yet.
- Suspended: `ensureAppUser` throws `SuspendedError`; settings actions map to
  "Your account is suspended." No header leakage of status.
- Protected routes: `/workspace/teams` shows `WorkspaceSignInPrompt` (Sign in only);
  `/settings/profile` shows static signed-out copy; `/teams/new` relies on form action auth.

## Supabase config (verified local, unverified remote)

- Local `config.toml`: `enable_signup=true`, `[auth.email] enable_confirmations=false`
  (local-dev only, not remote evidence). Production confirmation behavior is therefore
  handled both ways in code: session → redirect; no session → pending screen + resend.
- `site_url` / redirect allowlist: not inspectable from repo; must be verified in dashboard
  (Site URL = production URL; allowlist includes production `/**` + `localhost:3000/**`).

## Design tokens

- `src/app/globals.css` Competitive Arena: carbon `#0A0E14`, surface `#11161F`,
  paper/steel, crimson `#C8102E`/`#9B0014`, Oswald + Geist, sharp geometry, restrained motion.
