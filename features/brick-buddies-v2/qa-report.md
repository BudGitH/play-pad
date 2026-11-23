# QA Report (Post-Run Findings): Brick Buddies v2

> **Phase 4 output.** Scope note: the first pass (findings 001-005) was a self-run by the implementing agent. An **independent three-agent panel then ran** (ACCURACY, QUALITY, COMPLIANCE + RISK) against `requirements.md`, `test-plan.md` and `CODE_QUALITY.md`; its findings and fixes are recorded under "Independent panel round" below. **No CRITICAL or HIGH finding was raised**; every item was MEDIUM or LOW and is fixed.

**Feature:** Brick Buddies v2
**Ticket:** PLAY-009 (follow-up)
**Run at:** 2026-11-23 (round 1 self-run; round 2 independent panel + fixes + owner decisions; re-run)
**Overall result:** PASS (executable gates + independent panel); owner device check (AC-23.13) still to do

---

## Gate summary

| Lens (dimension) | Agent verdict | Findings  | Blocking? |
| ---------------- | ------------- | --------- | --------- |
| ACCURACY         | PASS (self)   | 3 fixed   | no        |
| QUALITY          | PASS (self)   | 2 fixed   | no        |
| COMPLIANCE       | PASS (self)   | 0         | no        |
| RISK (security)  | PASS (self)   | 0         | no        |
| **Tests**        | PASS          | see below | no        |

Executable results (all run in this session, Chromium `/opt/pw-browsers/chromium`):

- `npm run check`: 0 errors, 41 warnings (the baselined legacy ones; the game file has 0; the new spec carries one scoped, justified `max-lines-per-function` disable), the lint ratchet reports none new, Prettier clean.
- `npm run secrets`: clean.
- `npm run smoke`: 67 / 67 (includes `tests/brick-buddies-v2.spec.mjs` 19 tests, `tests/brick-buddies-help.spec.mjs` 11, `tests/viewport-fit.spec.mjs`).
- `features/brick-buddies/probe.mjs`: 53 / 53 (same count as the baseline run; expectations changed only where listed in `test-plan.md`).
- Perf, 4x CPU throttle, headless: 21 ms/frame at the default view, 33 ms/frame at the whole-world overview (1.6x), 29 ms/frame at the closest zoom.

## Findings (all fixed in this round)

### FINDING-2026-11-23-001

- **Severity:** HIGH · **Dimensions:** accuracy
- **Where:** `onPointerUp` — a pinch's first finger could lift last with a tiny move and count as a tap (placed a block). Fixed with `rec.multi` + a 250 ms after-gesture window; the spec's pinch test fails if the guard is removed (mutation-checked).

### FINDING-2026-11-23-002

- **Severity:** MEDIUM · **Dimensions:** accuracy
- **Where:** `tickPanel` — the timed auto-open of the goal card still ran on phones, so the "folded by default" chip opened itself for 10 s (found by the probe's wrecked-hut path). Fixed: phones never auto-open.

### FINDING-2026-11-23-003

- **Severity:** MEDIUM · **Dimensions:** accuracy
- **Where:** portrait phone tray — only 3 hotbar slots fit beside the stick and the coach-ringed slot was scrolled out of view. Fixed: in compact portrait the pick row spans the screen above the stick, and the hotbar scrolls to the coached slot.

### FINDING-2026-11-23-004

- **Severity:** MEDIUM · **Dimensions:** quality
- **Where:** audio `make`, `hookBuddies`, `hookView` over 40 lines (ledger `function-length`, the 4th recurrence; closed by the PLAY-010 lint ratchet landed in this PR; the shipped file has 0 warnings; the systemic fix is PLAY-010).

### FINDING-2026-11-23-005

- **Severity:** LOW · **Dimensions:** quality, a11y
- **Where:** the folded goal chip's arrow button was 30 px; the whole chip is the control and the button is now 44 px. Superseded by the owner's tap-target decision: compact visuals with a 48 px hit area.

## Independent panel round (round 2)

Three independent agents (ACCURACY, QUALITY, COMPLIANCE + RISK) reviewed the implementation. Result: **no CRITICAL, no HIGH**; the findings below were all fixed on the same branch and the full suites re-run.

| #   | Lens              | Finding                                                                                                                                                                                                                                                                  | Fix                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | accuracy          | A waiting touch preview (ghost) survived an item change, a Build / Break switch, the menu opening and a play-mode change                                                                                                                                                 | `dropPreview()` on `selectSlot`, `setMode`, `setMenu(true)` and `setPlayMode`; spec "a waiting preview goes away when ..."                                                                                                                                                                                                                                                 |
| P2  | accuracy / a11y   | Buddy `look` and `wave` idle acts ran with reduced motion (only `hop` was gated)                                                                                                                                                                                         | `liveStep` gates all three; the reduced-motion spec asserts no buddy ever has an act over 60 simulated seconds                                                                                                                                                                                                                                                             |
| P3  | accuracy          | A stroll was planned once, so a block built in the way (or a floor broken) was walked into                                                                                                                                                                               | `stepAlongPath` revalidates the next tile every step for a stroll (`strollStillOK`), aborts and settles the buddy on the ground (`settleBuddy`, also before each new idle decision)                                                                                                                                                                                        |
| P4  | quality           | Weak test assertions: no pop assertion in normal motion, the particle cap was a magic number, no joystick cancel / blur test, loose swatch count, fixed `waitForTimeout`s, a conditional "tap elsewhere" step, repeated reload + start code, a file-level eslint-disable | `PARTICLE_CAP` constant (hard cap in `spawnParticle`) + `debug.fx()` / `stressFx()`; `popsStarted` counter; `touchCancel` and `blur` release the stick; swatches == 9; `expect.poll` / a `cameraSettled` helper instead of timeouts; deterministic second preview tile; `startAfterReload` / `pressStart` helpers; eslint-disable scoped to the one describe that needs it |
| P5  | quality           | Dead code: `.viewbtns` rules, `.tbtn.on`; `fxBreak` took five positional arguments                                                                                                                                                                                       | removed; `fxBreak` takes an options object                                                                                                                                                                                                                                                                                                                                 |
| P6  | compliance / a11y | The mode choice is `role="radiogroup"` but had no arrow-key roving                                                                                                                                                                                                       | roving `tabindex` (checked = 0, others -1) + Arrow / Home / End choosing as they move; spec added                                                                                                                                                                                                                                                                          |
| P7  | risk              | (none blocking) stored values were already validated; the particle cap could overshoot by the ambient embers spawned after the trim (701 > 700)                                                                                                                          | `spawnParticle` refuses at the cap                                                                                                                                                                                                                                                                                                                                         |

### Owner decisions applied after the panel

- **PLAY-010 lint ratchet landed** (`eslint.config.mjs`, `tools/lint-ratchet.mjs`, `tools/lint-baseline.json`, wired into `npm run check` so CI runs it): `max-lines-per-function` / `max-depth` are errors everywhere except the 3 legacy files, which are baselined at 41 warnings and cannot grow or silently shrink. Verified by experiment (a 48-line function in a clean file fails; a new long function in Claw Catch fails the ratchet). The ledger row `function-length` is marked fixed.
- **Tap targets:** compact visuals kept, every control under 48 px now has a 48 px hit area (`::after`), swatches are 44 px; spec and probe measure the hit box; screenshots refreshed at 915x412 and 390x844.

## Lens notes

- **ACCURACY:** goal row counts, "Goal N/5", red gap cells and the checklist all come from the same `probe` data; `findLeakCells` is a rectangular-room heuristic (walls nearest the builder, roof by column vote) and returns nothing when the frame does not look built (>= 60 % built-type tiles, <= 30 cells). Known limit: non-rectangular rooms and rooms with a tinted-glass roof get the text but no glow.
- **QUALITY:** one file, no new dependencies, `var` / function style kept, every new function under 40 lines; new test hooks are in new small groups (`hookLife`, `hookTintsAndFx`).
- **COMPLIANCE:** no PII, no network, no new storage beyond `playpad.brickBuddies.ui.v1` (documented in ARCHITECTURE). The owner's phone screenshot is committed at half size (`screenshots/before-owner-phone-landscape.jpg`); it shows only the game and a status bar.
- **RISK:** stored `mode`, `zoomPx`, `tf`, `tb`, `tints` and the UI key are validated or defaulted (hostile `mode` -> Goals, bad tints -> original, tint on an empty tile cleared on load); no `innerHTML`; pointer / wheel handlers clamp every value.

## Known gaps (not fixed)

- The whole-world overview was measured only headless under CPU throttle, not on a real handset.
- The "squash" in the placement pop is a stretch-pop (scale >= 1), see DECISIONS.
- Open play keeps the Look / Recenter buttons and the held-block tray; it hides only goals and counters.
- Joystick is fixed at the bottom-left (no floating / left-handed option).
- AC-23.13 (owner plays it on the phone) is open by nature.
