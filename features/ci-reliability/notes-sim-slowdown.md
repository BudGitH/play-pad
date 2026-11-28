# Sim slowdown in `smoke:kq:play5`: not the sim, a GPU backlog

## Symptom

- CI, PR #29, 2-core runner, 1 worker: leg `npm run smoke:kq:play5` took 28.0 min (previous commit: 38/38 in 12.1 min).
- Two tests hit "Test timeout of 240000ms exceeded", then "Target page ... closed": `vehicle-life.spec.mjs:214` (actor in the car's lane, 480 sim frames) and `vehicles-ground.spec.mjs:408` (`runBus`, up to 2100 sim frames). Both also failed on `main` at b7bb460.
- Locally on 2 CPUs (`taskset -c 0,1`) the leg passed in 6.2 to 6.5 min.

## What it is not (hypotheses a, b, c)

Measured with a throwaway copy of both specs (outside the repo) that wrapped `Loop.frame`, `renderer.render`, `requestAnimationFrame` and `Traffic.debug`, and snapshotted scene, crowd, collider and traffic counts before and after every test.

| Hypothesis                            | Result                                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) per-frame sim cost grows          | No. 0.2 to 2.0 ms per `Loop.frame` in every test, in file order, with no trend. Scene objects 1036 to 1116, textures 88 to 102 (one-off uploads), colliders 419 to 423, crowd 0 to 170 (it repopulates by time of day and place), traffic cars constant 4. |
| (b) the game's own rAF keeps drawing  | No. `?still=1` sets `S.frozen`; `raf()` returns before `advance()`. rAF fired 1 to 6 times per test and drew nothing.                                                                                                                                      |
| (c) skipRender frames still hit a GPU | No. Frames with `skipRender` issued no `render()`.                                                                                                                                                                                                         |

## Measurements that found it

Per test, local 2 CPUs, before the fix (wall seconds, drawn frames = calls of `renderer.render`):

| Test                                             | Wall  | Sim frames | Drawn frames |
| ------------------------------------------------ | ----- | ---------- | ------------ |
| ground: AC-P13 top speeds                        | 17.3  | 6860       | 60           |
| ground: bus brakes for the hero (`:401`)         | 106.1 | 240        | 242          |
| ground: bus leaves town (`:408`, the CI failure) | 0.7   | 613        | 0            |
| life: scooter approaches                         | 37.9  | 3036       | 105          |
| life: car stops short of the hero (`:212`)       | 136.8 | 480        | 334          |
| life: car stops short of an actor (`:214`, CI)   | 1.4   | 480        | 3            |

The slow tests are the ones that draw hundreds of frames, and the CI failures are the tests right AFTER them. Total JS time inside the slow test was about 3 s of 135 s.

Reproduction without Playwright's runner (`laneCase` driver, fresh page, `taskset`):

| CPUs         | `laneCase` evaluate | Next `page.evaluate` (a trivial one)     |
| ------------ | ------------------- | ---------------------------------------- |
| 2 (`-c 0,1`) | 2.9 s               | **133 s** (in-page time before it: 0 ms) |
| 1 (`-c 0`)   | 6.5 s               | **140 s**                                |

Reproduction of the CI signature with the old code, one CPU shared with a busy-loop (about half speed, a stand-in for a 2-core runner): `:212` 14.9 s, then `:214` **4.7 min** (282 s, over the 240 s CI budget). The GPU process sat at 100 to 200 % CPU for that time.

## Root cause

`__kq.place()` ends with `Loop.step(100)`, and `step` draws its last frame, also under `?still=1` (`skipRender` is only for the earlier steps). `laneCase` and `busBrakesForHero` call `place` once per sim frame, so one evaluate queues 334 and 242 software-GL frames (about 0.4 s each with the hero, a car and the crowd in view). The renderer process only queues GL commands, so the evaluate returns in seconds; the GPU process (SwiftShader) then needs minutes, and the NEXT page task cannot start until it has drained. Playwright bills that wait to whichever test runs next. That test's own work (480 sim frames, about 1 ms each) is innocent.

Why intermittent: the backlog is roughly (drawn frames) x (software-GL frame time). On a 2-core runner a frame costs about twice the local time, so the next test sits near or over its budget (about 130 s locally, about 280 s with half the CPU) and passes or fails with the runner's speed. A failed serial describe then retries from the top, which is how one leg reached 28 min.

The "one shared page per file" state was not a factor: nothing accumulates that costs time.

## Fix

- `games/kampung-quest/js/game/loop.js`: `Loop.step(ms, quiet)`. With `quiet` no frame is drawn, including the last.
- `games/kampung-quest/js/game/hooks.js`: `__kq.step(ms, quiet)` and `__kq.place(x, z, heading, quiet)` pass it through. Default behaviour is unchanged, so every other spec (stats, screenshots, draw-call budgets) is untouched.
- `tests/vehicle-life-drivers.mjs`, `tests/kampung-quest-vehicles-ground.spec.mjs`: every `place` and `step` in sim-only drivers passes `quiet`. The budget drivers (`callsAt`, `makkahCalls`) keep their drawn frame because they read `stats().calls`.
- `docs/LEARNINGS.md` and the hook list in `games/kampung-quest/CLAUDE.md` updated.

## Verification (same machine, `CI=1`, 1 worker, same two files)

| Setup                              | Before                           | After                                                            |
| ---------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| 2 CPUs, `smoke:kq:play5` specs     | 38 passed, 6.5 min               | 38 passed, **1.3 min**                                           |
| 2 CPUs, slowest test bodies        | 137 s, 106 s, 38 s               | 0.4 s, 0.8 s, 2.6 s                                              |
| Drawn frames in the two files      | about 1,100                      | 140 (budget drivers, `setMinute`, game-side)                     |
| Per-frame sim cost across the file | 0.2 to 2.0 ms, no trend          | 0.2 to 1.9 ms, no trend (unchanged, as it was never the problem) |
| 1 CPU shared with a busy-loop      | `:214` 282 s (over 240 s budget) | all 38 pass in **3.7 min**                                       |

Lint and format: `npx eslint` and `npx prettier --check` clean on the changed files.

## Unresolved

- Other specs call `place` / `step` / `teleport` / `setMinute` in loops (for example `kampung-quest-collision`, `-mobile`, `-ac`, `-prayer`); they may carry the same hidden cost. Not measured here. A cheap check: count `renderer.render` calls per test and look at the test after the biggest.
- `setMinute` and `teleport` still draw one frame each (no `quiet` yet); harmless unless called in a loop.
- The `kampung` describe in `vehicle-life.spec.mjs` sets `timeout: 300_000`, while CI reported 240000 ms for `:214`; I did not find where 240 s came from for that test.
