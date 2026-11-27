# 10 — C1D campaign operations playbook

**Audience:** Product owner, reviewers, community moderators  
**Campaign URL:** `/campaigns/bgmi-season` (noindex)  
**Primary CTA:** Create Your Player Card → `/signup` → onboarding

## 1. Content publishing workflow

1. Freeze creative against C1C landing + C1B brand (interim F mark OK if disclosed as interim).  
2. Caption / on-screen copy **must** include unofficial / not affiliated language.  
3. **Forbidden in creatives:** PMGC logos, broadcast footage, unlicensed team marks, real BGMI Player IDs, evidence screenshots, fake stats/testimonials.  
4. Prefer specimen card or consented public profile PNG after FRAGIX brand.  
5. Publish deep link to `/campaigns/bgmi-season` (or `/signup` with agreed UTM).  
6. Keep landing `robots: noindex` until owner/legal approve indexing.  
7. Changelog: note publish date, channel, creative version in an ops log (outside secrets).

## 2. Moderation procedure

| Queue | Owner | Notes |
| --- | --- | --- |
| BGMI ownership evidence | Super-admins only | `/workspace/moderation/bgmi-ownership` |
| Public profile content | Product owner | Deletion / handle policy via existing profile tools |
| Social comments | Community lead | No fabricated metrics in replies |

**Reviewer checklist (each case):**

1. Confirm super-admin session; never share signed URLs.  
2. Open evidence preview (60s TTL); compare to claimed Player ID shown in queue.  
3. If mismatch / unclear → reject with clear player-facing message (no internal jargon).  
4. If match and policy OK → approve with internal reason.  
5. Confirm audit log action written (`bgmi_ownership.approve` / `.reject`).  
6. Never approve own case.

## 3. Community showcase permission process

1. Only showcase players who **opted in** (`is_discoverable`) **and** appear via public projection, **or** who gave explicit written/DM permission for a named creative.  
2. Prefer registry-listed, ownership-reviewed profiles for “proof” posts.  
3. Do not crop in private IDs, email, or evidence.  
4. Offer opt-out: remove from future creatives within 48h of request.  
5. Keep a permission log (handle + date + channel) — no passwords, no evidence files.

## 4. Player support process

| Issue | First response | Escalation |
| --- | --- | --- |
| Cannot sign up / login | Auth troubleshooting; no password requests in public chat | Engineering |
| Profile / PNG share | Point to public profile → Share card; clarify review not required | Engineering if download fails |
| Ownership pending | Explain manual review + SLA; no status inventing | Reviewer lead |
| Rejection | Player-facing message only; suggest withdraw + resubmit | Reviewer |
| Want registry listing | Completeness + discoverability + approved ownership | Reviewer / product |
| Abuse / impersonation | Collect public URL + description; freeze via deletion tools if needed | Owner + engineering |

**Support must never ask for passwords or for evidence files in Discord/public channels.** Direct players to in-product upload.

## 5. Reviewer escalation procedure

| Severity | Example | Action |
| --- | --- | --- |
| Sev-1 | Queue backlog > SLA; no active super-admin | Pause “get reviewed” creatives; owner grants admin or staffs backup |
| Sev-2 | Suspected fraudulent evidence spike | Freeze approvals; sample audit; tighten reject messaging |
| Sev-3 | Accidental signed URL paste in chat | Rotate/ignore link (TTL 60s); remind ops; no repo commit of URL |
| Sev-4 | Public claim of official PMGC/KRAFTON endorsement | Correct publicly; remove creative |

Escalate Sev-1/2 to product owner within 1 hour of detection during campaign hours.

## 6. Campaign incident response checklist

- [ ] Identify channel + creative + time window  
- [ ] Preserve screenshots of the incident (no secrets)  
- [ ] Pull creative if affiliation / trademark / privacy breach  
- [ ] If PII/evidence leaked: revoke access paths, document, notify owner  
- [ ] If Auth abuse: enable rate measures / disable signup temporarily (owner decision)  
- [ ] Status note to community: factual, no speculation  
- [ ] Post-mortem within 72h  

## 7. First 100 player acquisition measurement plan

**Definition of “player” for this plan:** `app_users` with a player profile created during the campaign window (UTC dates owner-set).

### Without product analytics (default until Option B approved)

| # | Metric | Source | Cadence |
| --- | --- | --- | --- |
| 1 | New accounts | Supabase Auth / `app_users` count (ops) | Daily |
| 2 | Profiles complete | Completeness SQL / settings ops | Daily |
| 3 | PNG shares | **Unknown** (no event) — qualitative social listening | 2×/week |
| 4 | Ownership submitted | `pending_review` + total cases | Daily |
| 5 | Ownership approved | `approved` count + badge spot-checks | Daily |
| 6 | Registry-listed | Search sample / eligible count SQL | Daily |
| 7 | Creative CTR | Ad platform only (if paid) — no PII export to repo | Per creative |

### Target tree (illustrative process, not fabricated results)

1. 100 signups from campaign window.  
2. ≥70% reach profile completeness.  
3. ≥50% download/share PNG (measure only if analytics Option B enabled; else mark N/A).  
4. Ownership submissions only after durable reviewer online; do not market “instant registry” if queue unstaffed.

### Stop rules

- If `platform_admins` remains 0: **do not** push “get ownership reviewed / join registry” as primary creative. Lead with create + share.  
- If reject rate or fraud signals spike: pause evidence CTA.

## Ops readiness for controlled campaign

| Track | Ready? |
| --- | --- |
| Identity create + share messaging | Yes (C1B/C1C) |
| Ownership review staffing | **No** (live admins = 0) |
| Analytics decision | Owner pending |
| Legal pages / counsel | Owner pending |
| Incident + support playbooks | Documented here |
