# Feature: Brick Buddies v2 — phone-first controls, goal clarity, two play modes, more life

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** IMPLEMENTED (checked by `tests/brick-buddies-v2.spec.mjs`, `tests/brick-buddies-help.spec.mjs` and `features/brick-buddies/probe.mjs`)
**Owner:** @BudGitH
**Ticket:** PLAY-009 (follow-up: owner phone-landscape feedback)
**Created:** 2026-11-23
**Feature tier:** Standard (project tier; public open-source)

---

## What & why

- **What:** eleven changes to `games/brick-buddies/index.html` from one round of owner feedback on a real phone in landscape: one virtual joystick instead of four arrow buttons; pinch-zoom + two-finger pan + a recenter button; a collapsible goal chip; a compact, collapsible build tray; tap-to-preview then tap-to-place; plain-language goals with the target cells highlighted in the world; a **Goals** / **Open play** mode choice; placement and break particles; a softer rain; wandering, living characters plus a little ambient life; and a colour picker for blocks and furniture.
- **Why:** the screenshot (`features/brick-buddies-v2/screenshots/before-owner-phone-landscape.jpg` was the owner's phone, 915x412 css) shows four separate arrow buttons, a "Close the gap" panel over the right third of the screen, and a hotbar + Break + Items row eating the bottom: about half the playfield is chrome, an accidental tap builds, and "Close the gap in the walls" does not say what to do or with what.

## Business requirements & success metrics

- **Business outcome:** a child on a phone in landscape can walk, look around, build on purpose and understand the current goal without an adult, and a child who just wants to build is not held to goals.
- **Success metrics:** (1) chrome covers at most ~30 % of a 915x412 screen in the default state (was ~50 %); (2) zero blocks placed or broken by the taps of a pinch / pan; (3) every goal row names an action and a block; (4) a player can choose Goals or Open play from the title and from the menu.
- **Must-have business rules:** static, build-free, one self-contained file, no new dependencies; saves keep working (new fields optional, old saves load unchanged); `prefers-reduced-motion` respected for every new animation; viewport sizing keeps using `--pp-app-h`; first-run onboarding still works; the existing probe passes (expectations changed only where behaviour intentionally changed).

## Target personas & success bar

- **Personas served:** **Priya & kid** "Sofa Co-op" (a ~7-year-old on a shared phone/tablet), **Maya** "Commuter Casual" (phone, one hand), **Sam** "Keyboard / AT user" — `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** walk, jump, climb, look around, pick a block and place it on purpose with thumbs only, in landscape.
- **Value (hard gate):** clearly less chrome and fewer accidents than before, with every function still reachable.
- **High satisfaction (scored, not gated):** the pop of a placed block, buddies that feel alive, a sandbox with no pressure.

## Design routing

- UI surface? **yes** · Reuse-only? **mostly** (existing tokens, chips, glass panels; new: joystick, goal chip, build tray, ghost confirm) · Tier **Standard** → strict table says **full** (four mockups). **Deviation, recorded:** the owner gave a precise brief with a real-device screenshot; the four-mockup round is replaced by a before/after screenshot loop in `design-review.md` (same deviation as `features/brick-buddies-onboarding/`).
- **Crosses FE/BE seam?** **no**.

## Design review

See `design-review.md` (before / after screenshots at 915x412 and 390x844).

## User-visible behaviour

1. **Joystick** (touch only, bottom-left): drag right / left to walk, up to jump or climb, down to climb down. Diagonals combine. Keyboard unchanged.
2. **Look around:** two fingers pinch to zoom (whole-world overview to close-up) and drag to pan; mouse wheel zooms (Shift+wheel cycles the hotbar); **+ / -** keys still work. A **recenter** button (target icon) appears whenever the view is off the default and snaps back to the player.
3. **Goals chip:** a small "Goal 1/5 ▸" chip (buddy face + count) top-right; tap to open the checklist card. Collapsed by default on short landscape phones; the choice is remembered.
4. **Build tray:** the always-visible part is the held block, the Build/Break switch and a tray toggle; the tray holds the 10 hotbar slots (smaller) and **Items**. Closed by default on phones; opens by itself when the coach needs a slot.
5. **Preview, then place:** on touch, a tap shows a ghost of the held block on that tile (green with a tick if it fits, red with a cross and the reason if not); tapping the ghost places it. Dragging a finger moves the ghost. Break mode previews the same way. Pinch / pan taps never place or break. (Mouse: hover ghost, click places, as before. The guided first-run glow places on one tap.)
6. **Plain goals:** every goal row, coach line, hint and refusal says what to do and with which block; the current goal's target cells glow in the world (red = missing wall / gap, gold = where the next item goes).
7. **Two modes:** **Goals** (buddies ask for rooms, coins, unlocks) and **Open play** (every block unlocked, no goals card, no coin / star counters). Chosen on the title and switched in the ☰ menu; the world is kept either way; the choice is saved.
8. **Juice:** placing pops the block (squash and settle) with a puff and sparkles; breaking sprays block-coloured chunks. Capped; fewer / no motion with reduced motion.
9. **Rain:** softer, darker and lower; no hiss. The Rain toggle stays.
10. **Life:** buddies (and the waiting visitor) walk a little, pause, turn round and idle (look around, stretch, sit-bob) inside safe bounds; never into the player's way or off an edge. Ambient birds by day, fireflies at dusk and the odd critter, all cheap and off in reduced motion.
11. **Colour (coordinator addition):** the held block has a small colour dot (on the selected slot, or the held-block button when the tray is folded); tapping it opens a folded picker of 8 kid-friendly colours plus "original"; placed blocks keep and save their colour.

## Acceptance criteria

> Numbering: AC-23.x (continues Brick Buddies AC-1..21, onboarding AC-22.x). Checked by `tests/brick-buddies-v2.spec.mjs` (Playwright, runs in `npm run smoke`) unless marked (probe) / (manual).

- [x] **AC-23.1 Joystick:** with touch on, `#joy` (role "group", name "Move") is visible, at least 88 css px, inside the screen and the four old buttons (`#tLeft #tRight #tDown #tJump`) do not exist. Dragging the knob right / left / up / down sets the matching held direction (`inp`) and releasing clears it; up jumps and climbs; keyboard movement is unchanged. A pointer cancel or the page losing focus releases it.
- [x] **AC-23.2 Pinch / pan / recenter:** a two-finger pinch out / in changes `debug.view().zoomCss` within `[minZoom, maxZoom]` (min = whole world fits, max = 96 css px per tile) and never beyond; a two-finger drag changes the camera offset; the recenter button (`#recenterBtn`, name "Recenter") is hidden at the default view, shows once zoomed or panned, and restores pan 0 and the automatic zoom. Wheel zooms on desktop. +/- keys still zoom. Zoom survives a reload.
- [x] **AC-23.3 Goal chip:** `#request` has a collapsed form that is a single chip of at most 190 x 56 css px showing "Goal N/5" (or "Goal N" after the fifth) with a toggle; at 915x412 touch it starts collapsed; opening and closing is remembered across a reload (`playpad.brickBuddies.ui.v1`); an explicit choice beats the automatic rule; the coach line stays visible beside it.
- [x] **AC-23.4 Declutter:** at 915x412 touch the default bottom chrome (joystick, tray pill) leaves at least 60 % of the screen free of controls; hotbar slots are at least 40 css px; the tray toggle opens a tray with all ten hotbar slots, the Break / Build switch and **Items** (all reachable); the tray opens itself while the coach rings a slot.
- [x] **AC-23.5 Preview then place:** a touch tap on an empty reachable tile with a block in hand places nothing and shows the ghost (`debug.aim().has`, `ghostPending`); a second tap on the ghost places the block; a tap elsewhere moves the ghost; a tap on an invalid tile previews red and places nothing; Break mode previews then breaks. A pinch or two-finger pan, including the lift of its first finger, places / breaks nothing (asserted by tile count). The coach's glow tile still places on one tap.
- [x] **AC-23.6 Plain goals:** no goal row, coach line or hint contains the old wording ("Close the gap", "Missing:"); each unmet row names an action and a block ("Place Plank blocks to fill the empty spots in your walls"), the ring gap cells are reported by `debug.goalCells()` and drawn (red), and a coach line is at most 28 characters.
- [x] **AC-23.7 Modes:** the title has a mode choice (Goals / Open play, radiogroup); Open play on Start hides `#request` and the coin / star chips, unlocks every item (a locked-by-cost item such as the Furnace places with no coins), and starts no visitor; the ☰ menu has a "Play mode" row that switches both ways without erasing the world; Goals mode resumes the saved goal; the mode is saved and old saves load as Goals.
- [x] **AC-23.8 Juice:** placing a block spawns a puff + sparkle burst and a pop animation on that tile; breaking spawns tile-coloured chunks; the live particle count never exceeds the 700 cap, no allocation per frame beyond the capped list; with reduced motion the pop and sparkles are replaced by a still, short flash (a few particles, no scale pop).
- [x] **AC-23.9 Rain:** the rain bed's peak gain is at most half of the old one (old: 0.6 bus x 0.7 sum, 0.5 hiss / 0.55 body layers), the high-frequency "hiss" layer is gone (no high-pass above 800 Hz), the master low-pass sits at or below 3500 Hz outdoors; `Rain` toggle still works. (probe reads `debug.rainTuning()`.)
- [x] **AC-23.10 Life:** over 40 simulated seconds a resident and the waiting visitor each change direction at least once and stand idle at least once, never leave their safe range (visitor: 8 tiles of its spot; resident: 10 tiles of home) and never stand on a tile that makes the player stuck; wandering never starts while the player is within 1 tile in front (no blocking); ambient critters (birds by day, fireflies at night) are capped (at most 12) and absent with reduced motion. (`debug.life()`)
- [x] **AC-23.11 Colour:** while a tintable item (bricks, walls, planks, glass, bed, table, chair, door, chest, shelf, bench, cupboard, locker, rug, barrels) is held, a small swatch dot sits on the selected slot (or on the held-block button when the tray is folded); the picker (`#swatches`, role "group" "Block colour") is collapsed until the dot is tapped, then shows "Original" plus 8 colours; picking one sets the colour for the next placed copies of that item (remembered per item); placed tiles store their tint (`tintFg` / `tintBg`), render with it (tinted textures cached per texture and colour), and keep it through door open / close; breaking a tile clears it; goal / room checks read only the base tile id, so a tinted ring of planks is still a room of planks; the tints are saved (`world.tf`, `world.tb`, `world.tints`) and a save without them loads as all original; works in Goals and Open play; the ghost preview shows the tint.
- [x] **AC-23.12 No regressions:** lint, format, secret scan, `npm run smoke` and `features/brick-buddies/probe.mjs` pass (probe expectations updated only where listed in `test-plan.md`); the first-run how-to and coach still work (help spec); `tests/viewport-fit.spec.mjs` passes with the new dock; no console errors.
- [ ] **AC-23.13 Reads better (manual, owner-judged):** the owner plays 5 minutes on the phone and confirms the controls feel right. Recorded in `product-validation.md`.

## Edge cases & error states

- Multi-touch: a third finger, a finger lifted first, a pointer cancel mid-pinch, a pinch that starts on the joystick (the joystick keeps its own pointer; the canvas gets the other two).
- A pinch that ends with one finger still down must not start a stroke or ghost move until that finger lifts and taps again.
- A ghost left on screen is cleared after 8 s idle, when the item or mode changes to something invalid, and when the menu opens.
- Zoom clamps: tiny screens (320x480) and huge screens (2560x1440) both get a valid `[min, max]` with `min <= auto <= max`.
- Open play with a hostile save (`mode: "x"`): treated as Goals.
- Reduced motion: no pop, no sparkles, no bobbing, no birds / fireflies, no wander animation beyond walking; the ghost pulse is static.
- Storage blocked: UI preferences simply do not persist; nothing throws.
- Wandering buddy next to a door, ladder or ledge: stays on flat, door-free, ladder-free tiles within range; never steps off.

## Out of scope

- A real tutorial for the pinch / joystick beyond a one-line hint and the updated how-to.
- Gamepad support, haptics, new blocks, new goals, changes to the save's world format.
- Changes to other games.

## Non-functional requirements

- **Accuracy:** goal counts and highlighted cells match the room detector (same `probe` data).
- **Risk/Security:** stored UI prefs and the saved mode are untrusted input: validated, defaulted; no `innerHTML` with stored values.
- **Compliance:** no PII; no network.
- **Quality:** functions under 40 lines (lint); frame cost at whole-world zoom within ~2x of the default view on a mid phone (measured in the probe).

## Tech Lead feasibility

- **Verdict:** PROCEED_WITH_NOTES — the camera is `cam + pan` and already clamps to the world, so continuous zoom is `N = round(zoomCss x dpr)` with the focal point held by adjusting `pan`; the light map and rim light loop over visible tiles, so the whole-world overview is the cost to measure; effort is large (one 9k-line file) so the work is staged: input, camera, HUD, goals, modes, juice / audio / life.
