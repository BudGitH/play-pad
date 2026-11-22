# QA Report (Post-Run Findings): Brick Buddies onboarding

> **Phase 4 output.** Round 1 had **no sub-agent tool**: the four lenses were applied by the implementer alone. An **independent QA pass then reviewed commit `7c97902` and found 6 issues (round 2 below, all fixed)**. That pass is the fresh-eyes review round 1 lacked; it caught a real keyboard dead end that round 1 missed.

**Feature:** Brick Buddies onboarding (first-run how-to, `?` chip, coach, three-tap first goal, simple first run)
**Ticket:** PLAY-009 (follow-up)
**Run at:** 2026-11-22 (round 1: tools -> fixes -> re-run; round 2: independent QA findings -> fixes -> re-run)
**Overall result:** ☑ PASS ☐ FAIL

---

## Gate summary

| Lens (dimension) | Verdict | Findings (fixed in-run / open) | Blocking? |
| ---------------- | ------- | ------------------------------ | --------- |
| ACCURACY         | PASS    | 4 / 0 (see below)              | n         |
| QUALITY          | PASS    | 2 / 1 LOW (open, pre-existing) | n         |
| COMPLIANCE       | PASS    | 0 / 0                          | n         |
| RISK (security)  | PASS    | 0 / 0                          | n         |
| **Tests**        | PASS    | numbers below                  | n         |

## Tools run (real output)

| Command                                                                            | Result                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` (eslint + prettier)                                                | 0 errors; 41 pre-existing warnings in other files (identical to `main` before this work); **0 warnings in the files touched** (`games/brick-buddies/index.html`, `tests/brick-buddies-help.spec.mjs`, `features/brick-buddies/probe.mjs`); prettier clean |
| `npm run secrets`                                                                  | `Secret scan: clean`                                                                                                                                                                                                                                      |
| `npm run smoke` (Playwright; now includes `tests/brick-buddies-help.spec.mjs`)     | **46 passed** (37 existing + 9 new in `tests/brick-buddies-help.spec.mjs`)                                                                                                                                                                                |
| `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node features/brick-buddies/probe.mjs` | **50/50 checks passed** (was 41/41; +9 net: 8 new AC-22 checks, and the old first-run AC-18 hut check became two (AC-22.4 pre-built hut + the full recipe on bare ground); 0 console / page errors, 463 same-origin requests, nothing fetched)            |

## Findings

### Fixed in-run

- **A-01 · MED · accuracy (found by the real-input flow, not by reading).** A door is two tiles tall and a bed two wide; the coach glow covered both tiles but only the anchor tile placed the item, so tapping the "wrong" half was refused ("A block is in the way"). **Fixed:** `coachAnchor` resolves a tap on any tile of the glowing footprint to the planned anchor, and the target is cleared after a success so a drag does not re-place it. Checks: probe AC-22.7 taps the LAST footprint tile of bed / torch / door; spec taps the second half of the bed.
- **A-02 · MED · accuracy.** Standing in the doorway when the door was next produced a plain refusal toast. **Fixed:** the coach reports `step` ("Step aside" + arrow, walk pad ringed on touch). Probe covers it.
- **A-03 · LOW · accuracy.** With every hut job done and Pip not yet moving the coach went blank for up to 0.25 s (the card jumped). **Fixed:** a "<Name> is coming!" step covers the gap.
- **A-04 · LOW · accuracy.** The coach's own edge label and the existing "Pip" edge arrow overlapped at the left edge while walking. **Fixed:** the buddy arrow yields while the coach is in its `walk` step.
- **Q-01 · LOW · quality.** Three new functions were over the 40-line lint limit (`planHutCoach`, `drawCoach`, `installHook`) and the spec had a 71-line describe. **Fixed:** split by decision vs drawing; `hookConstants` extracted. Ledger: `function-length` (3rd).
- **Q-02 · LOW · quality / a11y.** Coach text said "Click" to keyboard-only players. **Fixed:** the words follow the input in use (`Tap the glowing spot` / `Click the glowing spot` / `Press F on the glow`) and the slot's key is shown on desktop (`Pick the bed (5)`).

### Open (non-blocking)

- **Q-03 · LOW · quality.** The deep probe (now 50 checks, ~4 min) is still not in CI (ledger `checkable-but-unenforced`, PLAY-012). The fast first-run checks (`tests/brick-buddies-help.spec.mjs`, 9 tests) do run in CI via `npm run smoke`.

## Lens notes

- **ACCURACY** - Every AC-22 criterion has a test that drives the real input path (clicks / taps / keys); the coach is derived from world state, so loads, undo and a rearranged hotbar cannot strand it (probe + `wreckHut` fixture). The reward still pays (+40) with only three placements; the full 33-block recipe still works on bare ground. `phase` never changes under the how-to (smoke drivers unaffected).
- **QUALITY** - Files touched lint with 0 warnings; why-comments on the non-obvious decisions (separate storage key, `phase` untouched, tap-any-tile-of-the-glow); dead CSS (`.steps`) removed with the markup; probe fixtures documented (`wreckHut`, `freshHelp`).
- **COMPLIANCE** - No PII, no new dependency, no network (probe AC-14), docs updated per CLAUDE.md (ARCHITECTURE, DECISIONS, LEARNINGS, IDEAS, ledger); `_redirects` needs no change (no new top-level file; `features/*` and `tests/*` are already redirected).
- **RISK** - No `innerHTML`; all dynamic text via `textContent` / DOM nodes; the only new storage is one constant-key flag read and written inside try/catch (spec + probe run with `localStorage` throwing: no errors); the versioned save is untouched (key and format asserted).

## Round 2: independent QA on `7c97902` (all fixed)

- **R2-1 · HIGH · accuracy / a11y (keyboard-only stuck).** The coach said "Press F on the glow", but F places on the aim tile one ahead of the player, so with the aim left and the glow up-right nothing happened; and until the first F the aim mode was "mouse", so a keyboard player saw "Click the glowing spot". **Fixed:** with the coached item in hand, F (and now Enter) places on the coach's spot (`doAimAction`), no aiming needed; the wording is keyboard-first until a mouse has actually moved over the world (`mouseUsed`): "Press F on the glow", then "Click the glowing spot". The how-to says "Pick a block. Click or press F." on non-touch. Tests: probe "keyboard only" (digit + F with the aim cursor elsewhere, digit + Enter for the door) and spec "with no mouse, a digit then F places the bed".
- **R2-2 · MED · accuracy (dead end).** If the child filled the hut with planks the coach pointed at occupied tiles. **Fixed:** the coach detects a blocked spot (`code === "blocked"`): "Switch to Break" with the Break button ringed, then "Break the plank" with the blocking tile glowing, then moves on (a bed is two tiles: it walks through each plank). Tapping the glow with the wrong item in hand now says "Pick the bed first" and places nothing (`coachWrongItem`). Tests: probe "a blocked spot ..." and spec "a hut filled with planks ...".
- **R2-3 · MED · quality.** The coach matched `canPlace` reason strings with regexes / equality. **Fixed:** `canPlace` / `placeRule` / `tryPlace` results now carry a `code` (`far | bounds | bedrock | there | blocked | standing | support | locked`) next to the unchanged `reason` words; the coach branches on `code` only.
- **R2-4 · LOW · ux.** The title still carried two long key lists. **Fixed:** one very short line each ("A D walk · F or click to place · ? help" / "Pads walk · tap to place · ? help"); the long lists stay in the pause menu. Probe AC-17 now asserts the short wording.
- **R2-5 · LOW · ux.** Older saves had no coach line during the ~5 s the buddy walks in. **Fixed:** "<Name> is coming!" while arriving (probe "an older save ...").
- **R2-6 · LOW · ux.** How-to step 4 was symbols. **Fixed:** three ticked picture boxes (bed, torch, door) then Pip's home, matching the coach's ticks; checked at 390x844 and 568x320 (`screens/after-2-*`).

Round-2 results: see the table above (re-run after the fixes).

## Not independently reviewed

- Round 2 was the independent pass on the diff (above). Still recommended: the how-to on a real small Android handset, and a real child (AC-22.10).

## Regression checks (one per fix)

| Fix                      | Check                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| A-01 tap any glow tile   | probe AC-22.5-8 (taps the last tile of each footprint); spec (second half of the bed)            |
| A-02 step aside          | probe AC-22.5-8 (door, standing in the doorway)                                                  |
| A-03 / A-04              | probe flow sequence (`moving` -> `next`); visual check in `screens/after-3-*`                    |
| Q-02 input-aware wording | probe expects `Pick the bed (5)` / `Click the glowing spot`; spec (touch) `Tap the glowing spot` |
