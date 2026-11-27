# 01 — Player Verification UX

## Placement

`/settings/profile` — section `BgmiOwnershipVerificationSection` after BGMI Player ID (anchor `#bgmi-player-id-settings`).

## States

| State | Condition | UI |
|---|---|---|
| A | No saved `game_user_id` | Link to BGMI ID settings; no upload |
| B | ID saved, no active draft/pending | Instructions + start draft |
| C/D | `draft` | Upload 1–2 images, confirm checkbox, submit |
| E | `pending_review` | Status + date + withdraw (no badge) |
| F | `withdrawn` | Evidence deleted copy + start new |
| G | `id_mismatch` | Non-approvable explanation + withdraw/restart |

## Accessibility

- Section heading + `aria-live` feedback
- Labels on file input; 44px+ controls via `Button`
- Keyboard-focusable links/buttons
- No fabricated review SLA or approved badge
- Privacy copy: not public / not Share Kit / not tamper-proof
