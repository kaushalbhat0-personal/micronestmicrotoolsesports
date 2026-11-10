# Decision Register (D-01–D-19)

All statuses are **OPEN** or **RECOMMENDED**. None approved.

## Product and scope

### D-01 — Title strategy
- **Question:** BGMI-only data with multi-title-ready schema vs deeper multi-title content at launch?
- **Why it matters:** Determines whether the schema carries a first-class `GameTitle` entity from day one; retrofitting multi-title later repeats the legacy `game = bgmi` hardcode.
- **Alternatives:** (a) BGMI data + multi-title-ready schema; (b) multi-title content now; (c) BGMI-hardcoded (rejected — repeats legacy mistake).
- **Recommended default:** (a). **Status: APPROVED BY PRODUCT OWNER.** Reasoning preserved above.
- **Product impact:** Users see BGMI only at launch; non-BGMI expansion is data + UI work, not redesign.
- **Architecture/database impact:** `GameTitle` table + `GameProfile` per title from foundation; roles/ID formats keyed per title.
- **Security/moderation impact:** None beyond per-title verification methods later.
- **Dependencies:** None. **Blocks:** foundation (schema shape). **Deferrable:** No — P0.

### D-02 — Recruiter permission mechanism
- **Question:** Distinct org role (`owner/admin/recruiter/member`) vs recruiter as an admin flag?
- **Why it matters:** Shapes the membership table, every RLS helper, and the review queues. Changing it later rewrites authorization.
- **Alternatives:** (a) distinct role; (b) boolean flag on membership; (c) no scoped role (admins only — rejected, over-privileges recruiters).
- **Recommended default:** (a) distinct role with least privilege (vacancies + application review only). **Status: APPROVED BY PRODUCT OWNER.** Reasoning preserved above.
- **Product impact:** Org owners can delegate hiring without granting member management.
- **Architecture/database impact:** Role CHECK set, `is_org_recruiter()` helper, recruiter-scoped policies from day one.
- **Security/moderation impact:** Least privilege; fewer impersonation paths.
- **Dependencies:** None. **Blocks:** foundation. **Deferrable:** No — P0.

### D-03 — Stranger contact model
- **Question:** Vacancy-pointer invitations only vs any direct contact between strangers?
- **Why it matters:** Defines whether the platform needs messaging infrastructure and what harassment surface exists.
- **Alternatives:** (a) pointer-only (share a public vacancy link; contact flows through applications); (b) direct messaging.
- **Recommended default:** (a) for MVP. **Status: RECOMMENDED.**
- **Product impact:** No inbox to build or moderate; outreach is always anchored to a public, reportable vacancy.
- **Architecture/database impact:** (a) needs no new entity; (b) would add threads, delivery, moderation queue.
- **Security/moderation impact:** (a) sharply smaller abuse surface.
- **Dependencies:** Opportunity engine. **Blocks:** Player/Team discovery phase. **Deferrable:** Yes to P1 (decide before discovery build, not before foundation).

### D-04 — Notifications
- **Question:** In-app only for MVP vs email from day one (provider, templates)?
- **Why it matters:** Email adds provider selection, templates, deliverability, and unsubscribe compliance.
- **Alternatives:** (a) in-app queue only (pending counts, status changes on next visit); (b) + transactional email.
- **Recommended default:** (a), with the notification queue modelled early so email plugs in later. **Status: RECOMMENDED.**
- **Product impact:** Slower loops (users discover updates on return) but zero email ops.
- **Architecture/database impact:** `Notification`-style queue table design now; delivery worker later.
- **Security/moderation impact:** No PII leaves the platform in MVP.
- **Dependencies:** Application lifecycle. **Blocks:** discovery review queues (P1). **Deferrable:** Email itself to post-MVP — P1 for the in-app part.

### D-05 — Tournament organizer accounts
- **Question:** Editorial listing only vs self-serve organizer accounts in MVP?
- **Why it matters:** Self-serve organizers need an entity type, permissions, and moderation flow rivaling brands.
- **Alternatives:** (a) staff-listed tournaments; (b) organizer accounts now.
- **Recommended default:** (a). **Status: RECOMMENDED.**
- **Product impact:** Slower tournament coverage, full quality control.
- **Architecture/database impact:** (a) reuses editor capability; (b) adds organizer entity + RLS.
- **Dependencies:** News/editorial tooling. **Blocks:** tournaments phase only. **Deferrable:** Yes — P1.

### D-06 — Staff recruitment shape
- **Question:** Single generic staff type first vs distinct coach/manager/analyst flows?
- **Why it matters:** Distinct flows multiply forms, filters, and review logic for uncertain demand.
- **Alternatives:** (a) generic staff opportunity with free-text specialism; (b) per-role flows now.
- **Recommended default:** (a), split later on evidence. **Status: RECOMMENDED.**
- **Product impact:** Slightly less tailored UX for staff hires initially.
- **Architecture/database impact:** One opportunity subtype with a specialism label; no schema fork.
- **Dependencies:** Opportunity engine. **Blocks:** org recruitment phase. **Deferrable:** Yes — P1.

### D-07 — Compensation disclosure
- **Question:** Required compensation framing on staff/brand opportunities?
- **Why it matters:** Blank compensation is the top vehicle for misleading sponsorship/recruitment claims.
- **Alternatives:** (a) required framing (range, fixed, revenue-share, or explicit unpaid/trial); (b) optional.
- **Recommended default:** (a) required, with explicit unpaid allowed. **Status: RECOMMENDED.**
- **Product impact:** Honest listings; some publishers face a small extra step.
- **Architecture/database impact:** Non-nullable, validated field on relevant opportunity subtypes.
- **Security/moderation impact:** Core anti-deception control; report triage cites it.
- **Dependencies:** Opportunity schema. **Blocks:** org recruitment + brand phases. **Deferrable:** No later than P1 (field must exist at engine build).

### D-08 — Report SLA and strike policy
- **Question:** Takedown time SLA and strikes-before-ban numbers?
- **Why it matters:** Unspecified SLAs make moderation promises hollow and staffing unplannable.
- **Alternatives:** Numeric SLA + strike ladder (values genuinely require owner input).
- **Recommended default:** None proposed beyond "fast takedown path with strike count and publishing-ban for repeat offenders." **Status: OPEN.**
- **Product impact:** Sets user trust expectations publicly.
- **Architecture/database impact:** Strike counter + status fields; queue ordering by SLA.
- **Security/moderation impact:** Directly the moderation posture.
- **Dependencies:** Report/moderation queue. **Blocks:** first publishing surface (P1). **Deferrable:** Values can land just before launch, but the fields must exist at build.

### D-09 — Application caps and note length
- **Question:** Per-day application caps and note length limits?
- **Why it matters:** Primary spam control alongside the one-active-application guard.
- **Alternatives:** Numeric caps (require owner/product judgment against expected demand).
- **Recommended default:** Principle agreed (caps exist); numbers proposed at build time from load estimates. **Status: OPEN** (numbers), **RECOMMENDED** (principle).
- **Product impact:** Caps too low frustrate genuine seekers; too high enables spam.
- **Architecture/database impact:** Constants + counters, no schema risk.
- **Dependencies:** Application lifecycle. **Blocks:** discovery phase (P1). **Deferrable:** Numbers to pre-launch; principle now.

### D-10 — Discovery paywall stance
- **Question:** Is any finder or application flow ever gated?
- **Why it matters:** Locks the commercial model and whether entitlement checks touch discovery paths.
- **Alternatives:** (a) never gated; (b) gated later (e.g. premium placement).
- **Recommended default:** (a) — no paywall on discovery or applications. **Status: RECOMMENDED.**
- **Product impact:** Growth and trust; monetization must come from elsewhere (e.g. employer/brand tooling later).
- **Architecture/database impact:** No entitlement checks in discovery paths; keeps RLS simpler.
- **Dependencies:** None. **Blocks:** No build phase; commercial strategy. P1 (decide before any billing work, not before foundation).

## Backend and data

### D-11 — New-domain tables: fresh vs migrate legacy finder
- **Question:** Design new-domain tables fresh vs migrate legacy `finder_*` tables?
- **Why it matters:** Legacy tables hardcode BGMI, flat teams, no orgs/brands; migrating them bakes those limits in.
- **Alternatives:** (a) fresh tables reusing patterns (masked views, partial uniques, captain guards); (b) migrate + alter legacy tables.
- **Recommended default:** (a). **Status: APPROVED BY PRODUCT OWNER.** Reasoning preserved above.
- **Product impact:** None visible; cleaner multi-title/org/brand support.
- **Architecture/database impact:** New migrations later; legacy tables stay dormant; no data migration needed (legacy finder has no production users to carry — **[Assumption, needs confirmation]**).
- **Dependencies:** D-01, D-02. **Blocks:** backend foundation. **Deferrable:** No — P0.

### D-12 — Legacy tool tables fate
- **Question:** Leave dormant indefinitely vs scheduled cleanup with retention policy?
- **Why it matters:** Dormant tables cost nothing but confuse future developers; deletion needs retention sign-off.
- **Alternatives:** (a) dormant indefinitely; (b) cleanup scheduled with policy.
- **Recommended default:** (a) for now; revisit post-MVP. **Status: RECOMMENDED.**
- **Impact:** Negligible either way short-term. **Blocks:** Nothing. **Deferrable:** Yes — P2.

### D-13 — Legacy seed exclusion
- **Question:** Exclude microtool tools/plans/BMSD demo data from new-environment seeds?
- **Why it matters:** New environments should not present dead tools, prices, or demo tournaments as live product.
- **Alternatives:** (a) fresh minimal seed (titles, categories); (b) keep legacy seed.
- **Recommended default:** (a). **Status: RECOMMENDED.**
- **Impact:** Clean first-run experience; no migration risk (seed-only).
- **Dependencies:** None. **Blocks:** environment setup for backend work (P1). **Deferrable:** Until first new migration — P1.

### D-14 — Live-project parity check authorization
- **Question:** Authorize read-only live Supabase inspection, and who runs it?
- **Why it matters:** Repo migrations may have drifted from the hosted project; all backend work assumes parity.
- **Alternatives:** Owner authorizes named person for read-only checks (migration history, table/RLS/bucket/auth listing) vs no live access.
- **Recommended default:** Authorize read-only inspection before any backend work. **Status: APPROVED BY PRODUCT OWNER** — read-only parity inspection only. Does not authorize database, auth, storage, migration, or credential changes.
- **Impact:** Gates backend foundation. **Blocks:** foundation — P0 (process gate, not product design).

### D-15 — Auth hardening timeline
- **Question:** Local-dev auth settings adequate for MVP build vs confirmations/OAuth now?
- **Why it matters:** Email confirmations and OAuth change signup UX and testing.
- **Alternatives:** (a) build on current settings, harden pre-launch; (b) harden now.
- **Recommended default:** (a). **Status: RECOMMENDED.**
- **Impact:** Faster build; hardening checklist must gate launch.
- **Dependencies:** Launch checklist. **Blocks:** launch, not foundation — P1.

## Architecture and toolchain

### D-16 — Legacy `next.config.ts` redirects
- **Question:** Remove stale `/tools/*` redirects now vs keep until routing lands?
- **Why it matters:** Cosmetic; dead redirects confuse no one but are untidy.
- **Alternatives:** (a) remove at first routing pass; (b) remove now.
- **Recommended default:** (a). **Status: RECOMMENDED.** **Blocks:** Nothing — P2.

### D-17 — Unused billing dependencies
- **Question:** Keep `dodopayments`/`razorpay` vs prune?
- **Why it matters:** Unused deps widen supply-chain surface slightly; removal is trivial later.
- **Alternatives:** (a) keep until billing scope decided; (b) prune now.
- **Recommended default:** (a). **Status: RECOMMENDED.** **Blocks:** Nothing — P2.

### D-18 — `db:types` scope fix
- **Question:** Approve fixing output path + Windows-compatible env syntax?
- **Why it matters:** Current script targets archived `src/types/` and sh-only `$VAR` syntax; backend work needs working typegen.
- **Alternatives:** (a) fix when backend work starts; (b) leave.
- **Recommended default:** (a), bundled with first backend change. **Status: RECOMMENDED.** **Blocks:** backend foundation tooling — P1.

### D-19 — Expiry automation mechanism
- **Question:** Vacancy-expiry sweep + moderation queues: Vercel Cron vs Postgres-scheduled vs manual for MVP?
- **Why it matters:** Expired listings staying open erode trust; each mechanism has different ops cost.
- **Alternatives:** (a) Vercel Cron (existing pattern, legacy `vercel.json` archived); (b) Postgres `pg_cron`/scheduled; (c) manual/swept on read + admin action.
- **Recommended default:** (a) single daily sweep reusing the legacy cron-auth pattern, if cron budget allows; else (c) expiry enforced on read with admin sweep. **Status: RECOMMENDED with fallback.**
- **Product impact:** Listings reliably expire either way.
- **Architecture/database impact:** Status-transition function + caller; no product-schema impact.
- **Dependencies:** Opportunity engine, D-08 SLA. **Blocks:** discovery/org phases (P1). **Deferrable:** Mechanism choice to build time; the expiry rule itself is frozen now.
