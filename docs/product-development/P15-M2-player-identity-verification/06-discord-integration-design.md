# 06 — Discord Integration Design (Optional)

Locked: Discord is **optional**; never required for registration, profile completion, or discoverability; proves Discord control only — **not** BGMI ownership.

## 1. Current state (Verified)

- No Discord provider configuration in `supabase/migrations` or enabled Auth external providers in `supabase/config.toml`.
- No Discord OAuth client code under `src/`.
- Marketing footer tests explicitly reject Discord social URLs.
- Auth posture in P14-D12: email/password oriented.

**Conclusion:** Discord integration does **not** exist and must not be assumed.

## 2. Recommendation for P15-M2

**Defer implementation** of Discord OAuth to a later package (after M2B.1–M2B.4), while preserving product copy and architecture hooks that keep it optional forever.

### Why defer (Proposed)

1. Manual BGMI evidence + profile edit deliver the locked verification value without Discord.
2. OAuth expands threat surface (CSRF, token storage, account linking) before reviewer workflow exists.
3. Supabase Auth Discord enablement is a **production dashboard / Auth config** change — out of scope for architecture-only and risky to couple with first verification ship.
4. No current UI dependency.

### What to preserve now

- Policy language: “Discord connection is optional and never required.”
- UI must not show Discord as a completeness requirement.
- Verification badge must not require Discord.
- Access-policy helpers must never gate discoverability on Discord.

## 3. Target architecture (if/when built)

### Flow

1. Logged-in user starts “Connect Discord” from settings.
2. Server creates OAuth authorize URL with **cryptographic state** bound to session (httpOnly cookie) + PKCE if using custom OAuth; or Supabase Auth `signInWithOAuth({ provider: 'discord' })` **only if** product accepts Auth-linked identity model.
3. Callback verifies state; exchanges code **server-side**.
4. Persist minimal link row; discard or vault tokens.

### Preferred identity model (Proposed)

**Separate link table**, not “Discord becomes the login”:

`player_discord_links`

| Column | Store? |
|---|---|
| `user_id` | yes |
| `discord_user_id` | yes (internal) |
| `discord_username` | optional, owner-private by default |
| `connected_at` | yes |
| `access_token` / `refresh_token` | **avoid** if only “connected” proof needed; if required for API, server-only encrypted |
| Public Discord handle | **no** unless separate consent feature |

### Authorization

- Connect/disconnect: session owner only.
- Never expose Discord ids in G1 public RPCs or Share Kit.
- Disconnect deletes tokens and link row; no profile penalty.

### Security controls

| Control | Requirement |
|---|---|
| CSRF/state | Mandatory |
| Token exposure | Never in browser JSON / audit raw dumps |
| Account linking collisions | Unique `discord_user_id`; define merge/deny policy (Open) |
| BGMI coupling | Forbidden — separate status flags |

## 4. Supabase Auth provider note (Unverified ops)

Whether production project `knniommcyyhbyiwljisk` can enable Discord is an **Auth dashboard** decision. Architecture must not require enabling it for M2B.1–4.

If Discord is later enabled via Supabase Auth identities, still keep **application** treatment as optional metadata — do not conflate `auth.identities` Discord with BGMI ownership.

## 5. Decision

| Option | Verdict |
|---|---|
| Implement Discord in M2B.5 now | **Not justified** |
| Defer; keep optional policy | **Recommended** |
| Require Discord for verify/discover | **Forbidden** (locked) |
