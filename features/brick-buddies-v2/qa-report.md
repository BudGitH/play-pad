# QA Report (Post-Run Findings): Brick Buddies v2

> **Phase 4 output.** Honest scope note: the workflow asks for a panel of independent QA agents (accuracy / quality / compliance / risk). This run had no sub-agent spawner, so the four lenses below were run by the implementing agent as separate passes against `requirements.md`, `test-plan.md` and `CODE_QUALITY.md`, plus the executable checks. **They are not independent.** Spawn the real panel before merging if the process requires it.

**Feature:** Brick Buddies v2
**Ticket:** PLAY-009 (follow-up)
**Run at:** 2026-11-23 (round 1 self-run, then fixes, then re-run)
**Overall result:** PASS on the executable gates; independent panel + owner device check still to do

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

- `npm run check`: 0 errors, 41 warnings (the same 41 as before; the game file has 0, the new spec carries a justified file-level `max-lines-per-function` disable); Prettier clean.
- `npm run secrets`: clean.
- `npm run smoke`: 63 / 63 (includes `tests/brick-buddies-v2.spec.mjs` 15 tests, `tests/brick-buddies-help.spec.mjs` 11, `tests/viewport-fit.spec.mjs`).
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
- **Where:** audio `make`, `hookBuddies`, `hookView` over 40 lines (ledger `function-length`, now the 4th recurrence: escalated to STOP_SHIP in `docs/findings-ledger.md`; the shipped file has 0 warnings; the systemic fix is PLAY-010).

### FINDING-2026-11-23-005

- **Severity:** LOW · **Dimensions:** quality, a11y
- **Where:** the folded goal chip's arrow button was 30 px; the whole chip is the control and the button is now 44 px. The probe's size rule is now slots 40 / tray + chip 44 / rest 48 (recorded in `test-plan.md`).

## Lens notes

- **ACCURACY:** goal row counts, "Goal N/5", red gap cells and the checklist all come from the same `probe` data; `findLeakCells` is a rectangular-room heuristic (walls nearest the builder, roof by column vote) and returns nothing when the frame does not look built (>= 60 % built-type tiles, <= 30 cells). Known limit: non-rectangular rooms and rooms with a tinted-glass roof get the text but no glow.
- **QUALITY:** one file, no new dependencies, `var` / function style kept, every new function under 40 lines; new test hooks are in new small groups (`hookLife`, `hookTintsAndFx`).
- **COMPLIANCE:** no PII, no network, no new storage beyond `playpad.brickBuddies.ui.v1` (documented in ARCHITECTURE). The owner's phone screenshot is committed at half size (`screenshots/before-owner-phone-landscape.jpg`); it shows only the game and a status bar.
- **RISK:** stored `mode`, `zoomPx`, `tf`, `tb`, `tints` and the UI key are validated or defaulted (hostile `mode` -> Goals, bad tints -> original, tint on an empty tile cleared on load); no `innerHTML`; pointer / wheel handlers clamp every value.

## Known gaps (not fixed)

- Radios in the mode choice are buttons with `role="radio"` but no arrow-key roving.
- The whole-world overview was measured only headless under CPU throttle, not on a real handset.
- The "squash" in the placement pop is a stretch-pop (scale >= 1), see DECISIONS.
- Open play keeps the Look / Recenter buttons and the held-block tray; it hides only goals and counters.
- Joystick is fixed at the bottom-left (no floating / left-handed option).
- AC-23.13 (owner plays it on the phone) is open by nature.
