# PLAY-015 notes: Kampung Quest spec failures (AC-1, AC-4)

Evidence: CI logs of Probes run 46156403297 (main, b7bb460) via `gh run view --job`, plus local runs on
2 CPUs (`taskset -c 0,1`, `PW_PORT=5611`).

## Two mechanisms behind most of it

1. **Real-time timers vs drawn frames.** `UI.toast` removes its chip with a wall-clock `setTimeout`
   (3.6 s; 2.8 s for the vehicle line; `ritual-min.js` pulse 2.6 s). `__kq.step(ms)` draws one frame, and in
   software GL a drawn frame costs ~0.6 s locally (the page cannot answer the NEXT `page.evaluate` until the
   GPU is done; measured: `ritual()` 600 ms right after a drawn step, 2 ms after a no-op). On a shared runner
   it is several seconds, so the toast was gone before the assertion ran. Reproduced exactly (same messages as
   CI) by making every frame slow in the old specs (`Ambience.update` spinning 90 ms / 1000 ms): old spec fails,
   new spec passes.
2. **Compute / draw bound tests with the default 30 s budget**, or a loop that draws every 2 s.

## Per test

| Test | Symptom (CI) | Root cause (evidence) | Class | Change |
| --- | --- | --- | --- | --- |
| map `AC-P4 target clears itself` (~378) | `.kq-toast` "You are here: Library" not found, both attempts, 2 runs | toast is a 3.6 s wall-clock chip (`js/game/map-target.js:61`, `ui-core.js:178-183`); `step(300)` draws a frame after raising it, then the page is busy with the GPU | timing-fragile wait | Run unrendered frames in one `evaluate` until the target clears, read `.kq-toast` in the same task (`tests/kampung-quest-map.spec.mjs` ~375). Assertion kept (toast shown, target cleared). Old spec reproduced failing with slow frames, new passes. |
| vehicles `a no-drive zone stops the car` (~231) | `#kqToasts` was "" | spec's own comment: 2.8 s toast "must still be up" after `step(4500)` of drawn frames | timing-fragile wait | Drive 135 frames in one `evaluate` (last one drawn, as `step` does), record whether the toast text was ever in `#kqToasts`; assert `toasted` true. Old spec reproduced CI's `Received string: ""` with slow frames, new passes. |
| actions `AC-P24.1` (~119) | `Test timeout of 30000ms` in `nearNpc`, both attempts | first test after boot; four `goTo` + `nearNpc` each draw a new area in software GL (7-8 s locally, >30 s on the runner). The file had no describe budget (other KQ specs do) | undersized test budget (not reproduced: 7.3-8.5 s locally, also with 2 workers on 2 CPUs) | `describe.configure({ timeout: 120_000 })`. This is a budget, not a condition wait: there is nothing to poll, the cost is drawing. |
| haramain-world `a varied crowd` (~290) | `Test timeout of 30000ms`, both attempts | first test that runs `survey()`: 8 spots x 240 sim frames in one evaluate (8.8 s locally, ~3.5x on the runner) | undersized test budget (not reproduced) | `describe.configure({ timeout: 120_000 })`. |
| rituals `tawaf by Walk for me` (~230) and `sa'i starts at Safa` (~273) | `Test timeout of 240000ms` | loops `step(2000)` + `ritual()` ~110 times; each iteration draws one frame (~0.6 s local, 3x+ on CI) -> 85 s local, over 240 s on the runner. Measured: sim 7 s, drawing 70 s | timing-fragile loop (cost), condition kept | New helper `walkToEnd(every)`: 18 s chunks of unrendered frames, stops as soon as `RitualTrek.isAuto()` is false, draws once per chunk, samples `{z, pose}` every 45 frames for the sa'i brisk-between-lights check (same sample spacing as before). 85 s -> 20 s and 16 s. Assertions unchanged. |
| cards `a card the child hid by hand ... chip pulses` (flaky on play1, passed on retry; not in the AC-1 list) | `pulsing` false | pulse is a 2.6 s wall-clock class (`ritual-min.js:22,131`), same mechanism as the toast | timing-fragile wait | Read `__kq.card()` in the same task as the 6 frames after `stopAuto()`. |
| haramain-world `each region keeps its own save slot` (found locally, failed once) | `TypeError: Cannot read properties of undefined (reading 'ready')` in `__kq.loaded` | `hooks.js` loads before `boot.js` (index.html:379-380); a poll landing between them reads `G.Boot.ready` with `G.Boot` undefined, and `expect.poll` rethrows | real (test-hook) bug in the game | `games/kampung-quest/js/game/hooks.js`: `loaded` returns `Boolean(G.Boot && G.Boot.ready)`. |
| smoke `Kampung Quest reaches its in-round state` (AC-4) | 45 s test timeout while polling `ready` (`round-drivers.mjs:133`) | the 45 s describe budget covers goto + networkidle + `loaded` (7-8 s local, ~3x CI) + Start->ready (3-5.5 s local) + heartbeat; `loaded` poll had its own 40 s cap | timing-fragile budget (condition waits already existed) | `round-drivers.mjs`: KQ driver gets `testTimeoutMs: 180_000` (applied by `smoke.spec.mjs` via `test.setTimeout`), `loaded` poll 90 s, `ready` poll 45 s. Other games keep 45 s / 15 s. |

## Not touched

`Target page, context or browser has been closed` in play 2/3, core 2 and the other play-1 crashes are AC-2
(software-GL renderer crash), not spec logic.

## Verification (all `taskset -c 0,1`, `PW_PORT=5611`, `--project=kampung-quest --grep-invert @slow`)

| Command | Result |
| --- | --- |
| `kampung-quest-map.spec.mjs --repeat-each 3` | 48 passed |
| `kampung-quest-vehicles.spec.mjs --repeat-each 3` | 39 passed |
| `kampung-quest-actions.spec.mjs --repeat-each 3` | 75 passed |
| `kampung-quest-haramain-world.spec.mjs --repeat-each 3` | 51 passed |
| `kampung-quest-rituals.spec.mjs --repeat-each 3` | 57 passed |
| `kampung-quest-cards.spec.mjs` (once) | 16 passed |
| `smoke.spec.mjs -g "Kampung Quest" --project=core --repeat-each 5` | 10 passed (5 x phone + desktop) |
| play 1 set (actions, map, cards, hero), `--workers 2` on 2 CPUs, before the fixes | 62 passed (CI failures do not reproduce here without a slow-frame emulation) |

`npx eslint` and `npx prettier --check` on every changed file: clean; `node tools/lint-ratchet.mjs`: ok.
