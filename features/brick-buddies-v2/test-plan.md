# Test Plan: Brick Buddies v2

> **Phase 2 of the workflow.** Tests define "done". The new Playwright spec was written before the implementation was finished; the long probe keeps its older checks.

**Feature:** Brick Buddies v2 (phone-first controls, goal clarity, two play modes, colour, life)
**Ticket:** PLAY-009 (follow-up)
**Created:** 2026-11-23

---

## Coverage map (AC -> test)

| Acceptance criterion           | Test(s)                                                                                                                                       | Type                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| AC-23.1 joystick               | `tests/brick-buddies-v2.spec.mjs` "a single joystick replaces the four arrow buttons" (real multi-touch via CDP); probe AC-12 pad layout      | e2e (touch)           |
| AC-23.2 pinch / pan / recenter | spec "two-finger pinch zooms within limits..." (touch), "the mouse wheel zooms..." (desktop)                                                  | e2e                   |
| AC-23.3 goal chip              | spec "the goal is a small chip, folded by default here, and the choice is remembered"; probe AC-19 / AC-22.3 overlaps                         | e2e                   |
| AC-23.4 declutter              | spec "the bottom chrome is small; the tray folds away..." and "on a desktop the tray starts open"; probe AC-12 / AC-19 layout                 | e2e                   |
| AC-23.5 preview then place     | spec "a tap previews, a second tap on the preview places; pinches never build", "an invalid tile previews red"; help spec (glow places once)  | e2e (touch)           |
| AC-23.6 plain goals + red gap  | spec "goals say what to do with which block, and the open gap glows red"; probe AC-17 (rows named, now up to 60 chars)                        | e2e + probe           |
| AC-23.7 modes                  | spec "the mode choice..." and "an old save without a mode loads as Goals"                                                                     | e2e                   |
| AC-23.8 juice                  | spec place assertions (`particleCount`, `popCount`), "reduced motion: no pop, no ambient critters"                                            | e2e                   |
| AC-23.9 rain                   | spec "the rain is softer: lower gain, darker filter, no hiss layer" (`debug.rainTuning()`)                                                    | e2e                   |
| AC-23.10 life                  | spec "buddies stroll, turn and idle inside their range; ambient critters are capped"                                                          | e2e (simulated 120 s) |
| AC-23.11 colour (tint)         | spec "colour: the dot opens a swatch picker; tinted blocks render, save, and still count"; old-save migration in "an old save without a mode" | e2e                   |
| AC-23.12 regression            | `npm run check`, `npm run secrets`, `npm run smoke`, `features/brick-buddies/probe.mjs`                                                       | lint + smoke + probe  |
| AC-23.13 reads better (manual) | owner plays on the phone                                                                                                                      | manual                |

(AC numbers follow `requirements.md`: colour is AC-23.11, no regressions AC-23.12, the manual owner check AC-23.13.)

## Probe expectations changed on purpose (`features/brick-buddies/probe.mjs`)

| Check                          | Old                                          | New                                                                | Why                                                           |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| AC-12 pad buttons              | `#tLeft #tRight #tDown #tJump` exist, >=48px | `#joy` exists (>=88px); hotbar slots >=40px, others >=44px         | one joystick replaces the pads; owner asked for smaller slots |
| AC-17 rows                     | rows <= 36 characters                        | rows <= 64 characters; prefix "Still to do:" is screen-reader only | concrete wording names the action and the block               |
| first-run / coach "pad ringed" | left pad `#tLeft` has `coach-pulse`          | `#joy` has `coach-pulse`                                           | the joystick is the only walk control                         |
| AC-19 / AC-22.3 overlap boxes  | `.hotrow .tc` boxes                          | `#joy .tray-bar #hotbar` boxes                                     | dock rebuilt                                                  |
| anything tapping `#reqToggle`  | arrow button                                 | whole `.req-head` is the toggle (the arrow still works)            | folded card is a chip                                         |

## Test cases

### Happy path

- [x] Joystick right / left / up / down set the held directions; release clears them; up jumps.
- [x] Pinch out zooms in, pinch in zooms out, both clamped; recenter returns to automatic zoom and no pan; wheel zooms.
- [x] Goal chip folds / opens; remembered in `playpad.brickBuddies.ui.v1`.
- [x] Tap -> ghost (valid: tick badge), tap ghost -> placed + pop + puff; Break previews then breaks.
- [x] Open play: no goals card, no counters, Furnace usable with no coins; menu switches back to Goals and a goal appears.
- [x] Colour dot -> 9 swatches -> Red; placed block tinted; saved; reload keeps it.

### Edge cases (boundaries)

- [x] Pinch whose first finger lifts first builds nothing (planks count unchanged).
- [x] Pinch past both limits stays inside `[minZoom, maxZoom]`.
- [x] Invalid tile: ghost red with a cross, nothing placed.
- [x] Old save (no `mode`, `zoomPx`, `tf`, `tb`, `tints`) loads as Goals with no tints.
- [x] Reduced motion: no pop, no critters.
- [x] Storage blocked: the help spec's blocked-storage test (UI prefs fail soft).

### Non-functional checks

- [x] **Risk:** stored `mode`, `zoomPx`, `tints`, `tf`, `tb`, UI prefs are validated / defaulted (never trusted); no `innerHTML`.
- [x] **Quality:** every new function under 40 lines (`npm run check`).
- [ ] **Performance:** frame cost at the whole-world zoom (measured in the QA report, not asserted).

## How to run

```
npm install
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test tests/brick-buddies-v2.spec.mjs tests/brick-buddies-help.spec.mjs
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run smoke
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/brick-buddies/probe.mjs
```

## Definition of done

- [x] All tests above pass.
- [x] Every acceptance criterion in `requirements.md` is covered.
- [x] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).
