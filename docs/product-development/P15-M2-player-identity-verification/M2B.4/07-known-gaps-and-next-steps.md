# 07 — Known gaps and next steps

## Gaps (accepted for M2B.4)

- **No production super-admin seed** — `platform_admins` may be empty until an owner grants membership out-of-band.
- **Signed URL expiry assertion** — TTL is set to 60s and asserted on mint; wall-clock expiry of CDN tokens not sleep-tested in CI.
- **Concurrent reviewers** — covered by `FOR UPDATE` + status predicate; no multi-client stress harness.
- **P10/P12 shells** — tournament/organizer moderation remains intentionally disabled; only BGMI ownership is operational under moderation.
- **Discord OAuth** — deferred (locked).
- **Official BGMI affiliation** — never claimed.

## Next steps (out of scope here)

- Owner-operated `platform_admins` grant for production reviewers
- Optional Discord binding (later milestone)
- Richer reviewer queue filters / pagination UX
- Retention policy for rejected evidence objects
- Commit / PR when product owner requests

## Stop

M2B.4 complete. Do not start Discord or production deploy from this milestone.
