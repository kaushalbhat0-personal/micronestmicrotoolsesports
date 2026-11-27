# P15-M2B.2 — Private BGMI Player Identity

**Branch:** `new-platform` @ `890e16c`  
**Mode:** Implementation complete locally — **no commit / push / deploy**  
**Database:** No new migration (reuses existing owner-private `game_user_id`)

## Verdict

**PASS**

Confirmed `player_game_profiles.game_user_id` is the BGMI Player ID storage. Wired owner-only settings UI + action with conservative validation. Public projection, share cards, and team surfaces remain free of the ID.

## Design choice

| Question | Answer |
|---|---|
| Reuse `game_user_id`? | **Yes** — text 4–32, nullable, owner RLS, omitted from G1 public RPCs by design |
| New table/column? | **No** |
| Migration applied? | **N/A** — none required |

## Deliverables

| File | Contents |
|---|---|
| `01-private-identity-storage.md` | Mapping + schema facts |
| `02-owner-access-and-authorization.md` | Session ownership |
| `03-validation-and-ui.md` | Rules + settings UI |
| `04-public-data-leakage-audit.md` | Public surface audit |
| `05-test-evidence.md` | Commands + results |
| `06-future-verification-compatibility.md` | ID-change invalidation contract |

## Out of scope (preserved)

Evidence upload, reviewer workflow, badge, Discord, public ID display.
