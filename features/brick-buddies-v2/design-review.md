# Design Review: Brick Buddies v2

> **Lite path, recorded.** Owner-directed rework from a real-device screenshot; the four-mockup round is replaced by the before / after screenshot loop below (same deviation as `features/brick-buddies-onboarding/design-review.md`). Visual rules: `docs/DESIGN-SYSTEM.md` (MD3 roles pinned dark for this game; glass chips `--bb-glass`).

**Feature:** Brick Buddies v2
**Ticket:** PLAY-009 (follow-up)
**Date:** 2026-11-23

## Before (the owner's phone, 915x412 css)

`screenshots/before-owner-phone-landscape.jpg`: four round arrow buttons, a ~330 x 200 css "Close the gap" card over the right third (a coach-less checklist, "Missing: Close the gap in the walls"), and a bottom row of Break + Items + ten 48 px slots. About half the playfield is chrome and the sentence does not say which block to use.

## After

| Change                               | Screenshot                                  |
| ------------------------------------ | ------------------------------------------- |
| Goals, goal folded to a chip + coach | `screenshots/goals-collapsed-915x412.jpg`   |
| Goals, card open, red gap glowing    | `screenshots/goals-expanded-915x412.jpg`    |
| Preview ghost with its tick          | `screenshots/ghost-preview-915x412.jpg`     |
| Colour picker open                   | `screenshots/swatch-picker-915x412.jpg`     |
| Placed, tinted, popping              | `screenshots/placed-tinted-pop-915x412.jpg` |
| Open play (no goals, no counters)    | `screenshots/open-play-915x412.jpg`         |
| Title with the mode choice           | `screenshots/title-modes-915x412.jpg`       |
| Whole-world overview (pinch in)      | `screenshots/overview-zoom-915x412.jpg`     |
| Portrait, tray open above the stick  | `screenshots/goals-portrait-390x844.jpg`    |

## DESIGN-SYSTEM check

- **Tokens only:** all new colours are existing `--bb-*` / `--md-sys-*` roles, apart from the nine tint swatches (content colours of the game's blocks, not UI roles) and the green / red confirm badge (`#4ccf74` / `#e5584d`, always with a tick / cross glyph: never colour alone).
- **Targets:** hotbar slots are 40 px on purpose (owner asked for smaller; tray 44 px; top chips and the joystick 48 / 96 px+). The colour dot is an 18 px picture with a 36 px hit area. Recorded in `test-plan.md`.
- **Motion:** pop, sparkles, ghost-badge pulse, goal-cell glow, critters and the hop idle are all off or still with `prefers-reduced-motion`.
- **Folded by default on a phone:** goal card (chip), hotbar tray, colour picker; each opens on one tap and remembers its state.

## Decision

Direction fixed by the owner brief. Human OK: the owner reviews on the phone (AC-23.13, manual).
