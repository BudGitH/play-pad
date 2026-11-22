# QA Report (Post-Run Findings): Brick Buddies

> **Phase 4 output.** Merged from the multi-lens QA panel (ACCURACY · QUALITY · COMPLIANCE · RISK). Round 1 had two independent agents (ACCURACY+RISK, QUALITY+COMPLIANCE). Round 2 was one independent re-verification agent across all four lenses. Round 3 was a combined QA sweep plus product re-validation after the fidelity round. The repro scripts lived in the session scratchpad and are not committed.

**Feature:** Brick Buddies (2D side-view house and room builder, formerly "Block Haven")
**Ticket:** PLAY-009
**Run at:** 2026-11-22 (round 1 → fixes → round 2 → fixes + RT-F → round 3 → final polish)
**Overall result:** ☑ PASS ☐ FAIL

---

## Gate summary (final)

| Lens (dimension) | Agent verdict | Findings (r1 / r2 / r3)                                                                                              | Blocking? |
| ---------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| ACCURACY         | PASS          | 1 HIGH + 5 MED + 6 LOW / 2 LOW / 0                                                                                   | n         |
| QUALITY          | PASS          | 1 MED (ledger 2nd) + 6 LOW / 1 LOW / 0                                                                               | n         |
| COMPLIANCE       | PASS          | 4 MED + 6 LOW / 1 LOW-MED / 3 LOW (layout)                                                                           | n         |
| RISK (security)  | PASS          | 2 LOW / 1 MED (stale tab) / 1 MED (banner)                                                                           | n         |
| **Tests**        | PASS          | probe 38/38 (×5 consecutive after the flake fix) · smoke 24/24 · eslint 0/0 · prettier · secret scan · 90k-step fuzz | n         |

## Round 1: blocking finding (fixed)

- **F-01 · HIGH · accuracy.** `S.reqIndex` was never written, so every reload restarted the request chain.
  - **Fixed:** it is now set in `startRequest` and advanced on move-in, with an AC-7 reload check.
  - Ledger: `request-progress-not-persisted` (new).

## Round 1: non-blocking (all fixed in `d2720d3`)

- **Accuracy:**
  - F-02: whole-room claims replace the single-cell claims that let players farm coins.
  - F-03: a ladder inside a room no longer counts as a hatch.
  - F-04: reloading from a doorway no longer teleports the player.
  - F-05: the top of the world is a ceiling.
  - F-06 / F-07: doors drop with their floor, and furniture can't stand on doors.
  - F-08: no edits while paused.
  - F-09: door toggles cost no light pass.
  - F-10: the world edge counts as a wall.
  - F-11: tufts fall when the block under them goes.
  - F-12: the toast uses the requested room type.
  - F-13: a save `rev` stops a stale tab overwriting newer progress.
  - F-14: a glow cap of 256.
- **Accessibility:**
  - C-01: Start is focused on load.
  - C-02: an ✕ on invalid ghosts.
  - C-03: room label contrast.
  - C-04: 48px HUD controls.
  - C-05: accessible names start with the visible label.
  - C-06: `aria-pressed` tabs.
  - C-07: the 320px layout fits.
- **Quality:**
  - Q-01: 38 lint warnings down to 0 (ledger `function-length`, 2nd occurrence).
  - Q-03: renames.
  - Q-04: dead code removed.
  - Q-05: shared `supportOk` and `spawnParticle`.
  - Q-06: named constants.
  - Q-07: shared `.visually-hidden` and `.back-link` (ledger `duplicated-component-css`, 2nd occurrence).
- **Flaky AC-4 (found by the orchestrator):** two causes.
  - A wandering resident stood on the probe's tile. That was a probe-ordering problem.
  - Idle buddies opened doors they brushed past. That was a game wart, now fixed.

## Round 2: new findings (all fixed in `0b4c767`)

- **NEW-1 · MEDIUM:** a blocked stale tab was silent. It now shows a persistent banner with Reload now, and Start / New world are disabled.
- **NEW-2:** hotbar slots and the ≤340px pad buttons are now 48px.
- **NEW-3:** stacked starter furniture failed the support rule. `STACKABLE` and partner credit fix it.
- **NEW-4:** the canvas focus ring flickered for WASD players. It now shows only after Tab.
- **NEW-5:** a rebuilt resident room now explains itself on the card. Releasing the claim was deferred (LOW).
- **NEW-6:** the probe now honours `SHOTS`, and the ARCHITECTURE save keys are corrected.

## Round 3 (after the RT-F fidelity round)

There were no new accuracy, risk or save-format defects.

- Old saves from `a335b93` and `44e307e` load identically.
- 21 hostile saves cause no errors.
- 60 fps over a 30 s soak, with `drawRimLight` at 0.4–0.8% of CPU.

The polish items were sent to the final pass:

- **N-7 · MEDIUM:** a 560×336 stale banner on desktop, from one CSS rule.
- **R3-2 / R3-3:** HUD overlaps at 568×320 and with the build sheet open.
- **R3-4:** no title hint on landscape phones.
- **R3-5:** the tip did not mention the route to the plot.

## Not verified (needs a human)

- The audio mix by ear on a phone, including whether the thunder startles small children.
- Real-device touch and Safari.
- Real-GPU frame rate on a mid-range phone.
- Visual fidelity against the reference (AC-16): the owner judges this.
