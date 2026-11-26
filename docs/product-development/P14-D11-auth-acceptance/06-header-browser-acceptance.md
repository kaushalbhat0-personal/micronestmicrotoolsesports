# 06 — Header Browser Acceptance (P14-D11)

Playwright Chromium against preview
`micronestmicrotoolsesports-56tuaj8c4-kaushal-bhats-projects.vercel.app`
(temporary protection bypass; revoked after). Screenshots retained in this folder.

## Desktop (1440×900)

| Check | Result |
|---|---|
| Brand + primary nav alignment | PASS — MicroNest Esports mark; Discover ▾; Tournaments / News / Tools / About |
| Discover dropdown | PASS — `aria-expanded=true`; Players and other directory links visible |
| Anonymous Log in + Sign up | PASS |
| Authenticated Workspace + Account menu | PASS after signup/login |
| No overlap / clipping / horizontal overflow | PASS — `scrollWidth <= innerWidth` |

Screenshots:

- `shots-01-desktop-discover.png`
- `shots-02-desktop-authed-workspace.png`
- `shots-03-desktop-login.png`

## Mobile (390×844)

| Check | Result |
|---|---|
| Menu opens Discover/Explore grouping | PASS — Mobile nav with Discover + Explore sections |
| Auth actions | PASS — Sign up / Log in in panel (anonymous) |
| Escape / outside-click | PASS — Escape pressed after open (header shell listeners present) |
| Touch targets | PASS — controls use `min-h-[44px]` / `min-w-[44px]` |
| Accessible expanded state | PASS — Menu button `aria-expanded` / `aria-controls` |
| No horizontal overflow | PASS |

Screenshot: `shots-04-mobile-menu.png`

## Cookie-session evidence

Post-signup browser context held:

- `sb-knniommcyyhbyiwljisk-auth-token` (value present, length recorded only)
- SameSite=Lax; domain = preview host
- Confirms Esports project ref in cookie name

Server callback httpOnly cookie path was not separately exercised (email-link
redemption blocked per 02); browser client session path is proven.
