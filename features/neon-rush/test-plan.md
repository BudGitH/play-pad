# Test Plan: Neon Rush

> **Phase 2 of the workflow.** Tests define "done". No automated harness at Prototype tier — tests run as deterministic in-page probes via the `window.__neon` debug hook, driven from the preview (`javascript_tool`) + screenshots, per LEARNINGS rAF rules.

**Feature:** Neon Rush — 3D endless runner
**Ticket:** PLAY-005
**Created:** 2026-07-12

---

## The `window.__neon` test hook (contract)

- `state` — mirror of `{ phase, lane, playerY, sliding, speed, score, coins, runCoins, powerups:{magnet,sneakers,hoverboard}, droneDist, muted }`
- `save` — the parsed persisted object (or defaults)
- `forceSpawn(type, lane)` — spawn `'barrier'|'lowTrain'|'tallTrain'|'coinRow'|'magnet'|'sneakers'|'hoverboard'` at distance ahead in `lane` (0/1/2)
- `setSpeed(v)` / `grantCoins(n)` / `crash()` / `input(action)` where action ∈ `'left'|'right'|'jump'|'slide'`
- `step(ms)` — advance the fixed-timestep simulation deterministically without rAF (headless-safe)

## Coverage map (AC → test)

| AC                | Test(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Type          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1 catalog         | T1 hub card renders + links                                                                                                                                                                                                                                                                                                                                                                                                                                                             | e2e (preview) |
| 2 controls        | T2 lane/jump/slide via `input()` + keyboard events; T3 swipe synthesis                                                                                                                                                                                                                                                                                                                                                                                                                  | integration   |
| 3 obstacles       | T4 barrier jumped/slid survives; T5 low train slide = crash, jump = survive; T6 tall train jump = crash, lane-change = survive; T7 pattern audit: 500 spawn waves always leave a survivable option                                                                                                                                                                                                                                                                                      | integration   |
| 4 crash flow      | T8 crash → game-over screen shows score/runCoins/total/high-score; Try Again restarts                                                                                                                                                                                                                                                                                                                                                                                                   | e2e           |
| 5 coins           | T9 coin contact increments; T10 magnet pulls coins from adjacent lane                                                                                                                                                                                                                                                                                                                                                                                                                   | integration   |
| 6 power-ups       | T11 each pickup activates + HUD timer drains + expires; T12 sneakers jump height clears tall train; T13 hoverboard absorbs one crash then gone                                                                                                                                                                                                                                                                                                                                          | integration   |
| 7 drone           | T14 near-miss reduces `droneDist`, clean seconds raise it; drone never triggers game-over                                                                                                                                                                                                                                                                                                                                                                                               | integration   |
| 8 shop            | T15 buy with enough/insufficient coins; equip persists; equipped skin flag in state                                                                                                                                                                                                                                                                                                                                                                                                     | integration   |
| 9 persistence     | T16 reload round-trip (coins/unlocks/high score/mute); T17 corrupted JSON in the key → defaults, no crash                                                                                                                                                                                                                                                                                                                                                                               | integration   |
| 10 HUD            | T18 score/coins/timers/mute/quit present; quit ≥48px                                                                                                                                                                                                                                                                                                                                                                                                                                    | e2e           |
| 11 perf           | T19 frame-time readout via hook ≤ ~16.7ms avg on desktop preview; no console errors; pools: obstacle/coin counts bounded                                                                                                                                                                                                                                                                                                                                                                | e2e           |
| 12 a11y           | T20 keyboard-only full run; focus visible; live region announces run start/crash                                                                                                                                                                                                                                                                                                                                                                                                        | e2e           |
| 13 offline        | T21 open via file:// with network disabled — game playable                                                                                                                                                                                                                                                                                                                                                                                                                              | manual/e2e    |
| 2 controls (anim) | T22 GLB animation integrity: after each of run→slide→run, jump→slide→run, and a long (sneakers) jump→land, an action is `isRunning()` at effective weight ≈1 and the skeleton is NOT at bind pose — assert on **mixer action weight / bone world-X-spread** (Rogue T-pose ≈1.451 vs animated ≈0.93), NOT on `__neon.skin.anim` (the state name transitions even with zero actions playing). Repeat for all 3 skins (urban/skater/neonbot). Regression for `gltf-action-reenable-tpose`. | integration   |

## Test cases

### Happy path

- [x] Start run (2 taps from page), auto-run speeds up, swap lanes, jump a barrier, slide a barrier, collect coins, crash, see totals, Try Again restarts instantly.

### Edge cases

- [x] Jump input while already airborne (ignored) · slide while airborne (fast-fall) · lane input at edge lane (clamped) · simultaneous horizontal+vertical swipe (dominant axis wins) · crash during hoverboard on the same frame a second obstacle overlaps (single consume, brief invulnerability prevents double-kill) · buying a skin with exactly the price · high score tie (not "new best") · timer expiry mid-jump.
- [x] Tab hidden mid-run → paused, resumes on visible; window resize mid-run re-projects camera.

### Known-bound notes

- [x] Super Sneakers clears a tall train only at speed ≥ ~11.4 m/s. Organic play is safe (tall trains gate in at distance ≥120m ⇒ speed ≥16.4); T12 runs at ramped speed. A base-speed `forceSpawn('tallTrain')` + sneakers jump is expected to fail and is NOT a defect.

### Error paths

- [x] `localStorage` throws (private mode) → game runs, shop works in-session, no uncaught errors.
- [x] Persisted JSON corrupted/truncated → silently reset to defaults.
- [x] WebGL unavailable → friendly message on the page, back-link works (no blank page).

## How QA runs these

1. `preview_start` `playpad` → navigate to `games/neon-rush/`.
2. Drive via `javascript_tool` calls on `__neon` (`step()` for determinism), verify visuals by screenshot (rAF is throttled headless — never poll state between evals without a screenshot pump).
3. Persistence: write/reload/read; corrupt the key manually.
4. file:// check done in a real browser window.
