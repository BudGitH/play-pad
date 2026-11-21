# Test Plan: Claw Catch

> **Phase 2 of the workflow.** Tests define "done". At Prototype tier there is no automated harness (`docs/CONVENTIONS.md`), so these are **manual / preview-driven checks** run via the browser preview MCP (`preview_eval`, `preview_screenshot`, `preview_console_logs`). Several physics/scoring invariants are written so they can be asserted programmatically through `preview_eval` against the game's exposed test hook (`window.__claw` snapshot of state).

**Feature:** Claw Catch
**Ticket:** PLAY-003
**Created:** 2026-06-27

---

## Coverage map (AC → test)

| Acceptance criterion | Test(s) | Type |
|---|---|---|
| AC-1 (hub + loads clean) | T-load, T-registry | e2e |
| AC-2 (themes/duration/difficulty) | T-theme-switch, T-config-persist | e2e |
| AC-3 (move: joystick + keyboard, bounded) | T-move-keys, T-move-joystick, T-bounds | e2e |
| AC-4 (flick swing + settle) | T-swing-flick, T-swing-settle | integration (state hook) |
| AC-5 (grab sequence once, input-locked) | T-grab-sequence, T-grab-nodouble | integration |
| AC-6 (catch on-target, miss off-target) | T-catch-hit, T-catch-miss | integration |
| AC-7 (rarity scoring = shown value) | T-score-matches-key | integration |
| AC-8 (capped refill) | T-refill-cap, T-refill-resume | integration |
| AC-9 (round end + results actions) | T-round-end, T-results-actions | e2e |
| AC-10 (reduced motion + responsive) | T-reduced-motion, T-phone-width | e2e |

## Test cases

### Happy path
- [ ] **T-load:** Open `games/claw-catch/` → setup screen renders; `preview_console_logs` shows no errors.
- [ ] **T-registry:** Open hub `/` → a "Claw Catch" card renders with icon, accent, and "1" player from `window.GAMES`.
- [ ] **T-theme-switch:** Click each of the 3 theme cards → `aria-pressed` moves; cabinet gradient + prize-key emoji/values update to the selected theme.
- [ ] **T-config-persist:** Pick 0:30 + Tricky, Start → in-game clock starts at 0:30 and difficulty constants applied (assert via `window.__claw.cfg`).
- [ ] **T-move-keys:** Dispatch ArrowRight/`KeyD` keydown → `window.__claw.cartX` increases; ArrowLeft/`KeyA` decreases.
- [ ] **T-move-joystick:** Pointer-drag the joystick knob right → cart moves right; release → knob returns to centre and cart coasts to a stop.
- [ ] **T-grab-sequence:** Press grab → `window.__claw.phase` transitions DROP→CLOSE→LIFT→RETURN→RELEASE→IDLE in order, then idle.
- [ ] **T-catch-hit:** Position a prize directly under the tip, grab → prize removed from bin, score increases by that prize's value, "+N" popup shown.
- [ ] **T-round-end:** Let a 0:30 round run to 0:00 → results screen appears with final score, prizes caught, best catch.
- [ ] **T-results-actions:** Play again → new round; Change settings → setup; Back to PlayPad → hub.

### Edge cases (boundaries)
> zero · one · many · max · empty · walls · overlap · background
- [ ] **T-bounds:** Hold ArrowRight to the wall → `cartX` clamps at `maxX`; hold ArrowLeft → clamps at `minX`; claw never renders outside the cabinet.
- [ ] **T-grab-empty:** Grab with empty bin → full sequence runs, score unchanged, no error.
- [ ] **T-grab-nodouble:** Press grab twice quickly → only one sequence runs (second press ignored while `phase !== IDLE`).
- [ ] **T-catch-miss:** Prize far from tip x, grab → not caught, prize remains, score unchanged.
- [ ] **T-overlap:** Two prizes overlapping under the tip → at most one caught per grab (`bin.length` drops by ≤1).
- [ ] **T-refill-cap:** Idle the round → `window.__claw.bin.length` rises over time but never exceeds `window.__claw.cfg.binCap`.
- [ ] **T-refill-resume:** Catch prizes down below cap → refills resume on the timer.
- [ ] **T-background:** Switch tab a few seconds then back → clock reflects real elapsed time; round still ends at 0:00.
- [ ] **T-quit-midseq:** Quit during a grab sequence → returns to setup, `window.__claw.running===false`, no lingering overlay, RAF cancelled.

### Error paths
- [ ] **T-no-html-injection:** All dynamic readouts (score, "+N", clock) set via `textContent`; grep the source for `innerHTML` on dynamic values → none on user/score paths.
- [ ] **T-audio-optional:** With sound off, gameplay unaffected; with sound on but AudioContext blocked, a missed beep never throws.

### Non-functional checks
- [ ] **Accuracy — T-score-matches-key:** For each prize value V shown in the prize key, a catch of that prize awards exactly V (assert `scoreDelta === prize.points`). Clock ends at exactly `0:00`. `bin.length <= binCap` invariant holds across a full round.
- [ ] **Physics — T-swing-flick / T-swing-settle:** After a quick cart move then stop, `window.__claw.theta` is non-zero (|θ| above a small epsilon) immediately, and trends toward ~0 over ~1–2 s with no input (monotone-ish decay via damping).
- [ ] **Risk:** No network requests (`preview_network` empty), no storage writes, no secrets in source.
- [ ] **Compliance:** Section-banner + "why" comments present; named constants for all physics/difficulty/scoring knobs (no magic numbers in the loop).
- [ ] **Quality — T-reduced-motion / T-phone-width:** With `prefers-reduced-motion`, a grab still completes and scores (state-driven, not transitionend). At 390px width the cabinet, HUD, and control deck fit with no overflow; controls ≥48px.

## How to run

```
# Prototype tier — no automated harness. Run the app and drive the checks via the preview MCP:
python -m http.server 5500   # then open http://localhost:5500/games/claw-catch/
# Assert physics/scoring invariants through the state hook:
#   preview_eval → JSON.stringify(window.__claw)   (cartX, theta, phase, bin, score, cfg)
```

## Definition of done
- [ ] All checks above pass (manually / via preview MCP).
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] Lite design path: surfaces match `DESIGN-SYSTEM.md` tokens; verification screenshots captured.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).
