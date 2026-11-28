# Notes: iPad loading and performance (section H, AC-P21..P23)

Workstream notes for `features/kampung-quest-playability/` (to be folded into the brain docs at CAPTURE).

## How it was measured

- `ipad/measure.mjs` loads the game in headless Chromium with iPad emulation (`iPad Pro 11 landscape`, `iPad (gen 7)` portrait), the iPadOS **desktop** user agent (`Macintosh`, `navigator.platform = "MacIntel"`, 5 touch points: what real iPadOS 13+ Safari reports), a **4x CPU throttle** (CDP `Emulation.setCPUThrottlingRate`), SwiftShader WebGL. Per run: time to Start enabled (`__kq.loaded`), Start tap to playing, long tasks (`PerformanceObserver("longtask")`) while loading and in the first 10 s of real play, peak JS heap (`performance.memory`), estimated texture memory (unique scene textures, w x h x 4, x 4/3 when mipmapped), programs, draw calls. Both regions.
- Before / after were run **interleaved** (before, after, before, after...) on the same box, three runs each, median reported. The "before" tree was the untouched `HEAD` served from a copy on port 5606, the "after" tree this worktree on 5605.
- Helpers: `ipad/profile-boot.mjs` (CPU profile, top self time), `ipad/profile-world.mjs` (times every world-builder step, or with `--start` the game modules during the Start tap; it wraps functions through request interception, no game change), `ipad/textures.mjs` (texture list), `ipad/check.mjs` (one load + boot marks + errors), `ipad/shoot.mjs` (screenshots), `ipad/table.mjs` (the tables below).
- **The box was shared with seven other agents (load average 8-11 on 4 CPUs)**, so absolute numbers swing by +-50 % run to run. Compare the columns, not the numbers with a device.

## What emulation cannot prove

- **GPU.** SwiftShader is a CPU rasteriser in Chrome's GPU process. A big share of "loading" here is SwiftShader JIT-compiling pipelines on the first draw and rasterising the 1024 px shadow map: one ~5 s main-thread task right after the warm-up render is the renderer waiting for the GPU process. On an iPad (ANGLE over Metal) the shader compile is real but much shorter, and raster is not the bottleneck. Frame rate in play (2-3 fps here) says nothing about an iPad.
- **Safari.** The engine is Chromium, not WebKit: `img.decode()` behaviour, texture upload paths, `performance.memory` (Safari has none), long-task reporting (Safari has none) and the per-tab memory limit (Safari kills or reloads a tab at roughly 1-1.5 GB on recent iPads, less on old ones) are not reproduced. Texture-memory numbers are estimates of what WebGL holds, not Safari's process footprint.
- **Touch and pointer.** Playwright's device emulation reports `pointer: coarse` with `hasTouch`; the "Magic Keyboard" case is emulated as a desktop context (`pointer: fine`, no touch emulation) with the iPad navigator facts. Real iPadOS can report either, which is why detection no longer depends on the media query.
- So: the measurements prove the **CPU-side** boot work went down and that nothing new runs during play; they do not prove frame rate or memory headroom on a real iPad. A check on a real iPad (Safari Web Inspector: Timelines, and the `kq:*` performance marks this adds) is still needed.

## Baseline findings (before)

Load timeline, iPad Pro 11 kampung, quiet run at 4x: scripts 0.5 s, **world build 23.6 s in ONE task**, actors 0.6 s, textures already loaded, shader warm-up 7.5 s, azan + posture pictures 0.8 s; Start enabled at 33.3 s.

- `geo.js` `slice()` (splitting heavy merge buckets into 72 m ground cells) rebuilt its output with `concat` per primitive: **quadratic**, 3.1 s of a 14 s unthrottled boot (12 s at 4x). The single biggest cost.
- `appendGeo` cloned / `toNonIndexed()` every primitive (every box, plane and cylinder) before transforming it.
- `AOField.build` rasterised and blurred a 1024 x 1024 float field (1.3 s at 4x).
- Posture pictures: ten renders, each with a synchronous GPU read-back and a PNG encode, in one task (0.4 s unthrottled).
- Haramain builds Makkah and Madinah together, but the whole holy world builds in ~2.1 s at 4x; Madinah's share is ~0.26 s (`HolyMadinah`, `HolyNabawi*`), so deferring it was not worth the restructuring. Its largest parts are `HolyHaram.build` (0.5 s) and the camel herd (0.35 s, `CamelHerd.create` / `CamelMesh.parts`).
- Textures: 76 in the kampung scene, ~127 MB estimated (the 2048 px decal atlas 21 MB, nine 1024 px photos, 17 NPC print atlases of 512 px). Programs at Start: 41 (kampung), 30 (haramain).
- iPad detection: `G.Env.coarse` came only from `(pointer: coarse)`. An iPad with a Magic Keyboard / trackpad that reports `pointer: fine` got the **desktop** layout (no joystick), the **high** tier, and no pixel-ratio cap.
- No `webglcontextlost` handling: Safari's memory-pressure context loss left a frozen canvas.

## Changes

| Area                      | Change                                                                                                                                                                                                                                                                                                                                                                                                   | Files                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Detection (AC-P21)        | `G.Env.ipad` = `/iPad/` UA, or Mac UA / `MacIntel` with `maxTouchPoints > 1`; `G.Env.tablet` = iPad or touch with a short screen side >= 600 px; `G.Env.coarse` = coarse pointer **or iPad**. Root gets `kq-touch-ui` / `kq-tablet`; the stylesheet mirrors its two `(pointer: coarse)` blocks on `.kq-touch-ui`, so a keyboard iPad keeps the joystick and Jump.                                        | `settings.js`, `boot-perf.js`, `styles.css`                                                                           |
| Tier / DPR (AC-P21)       | iPads start on **low** (same as phones: an iPad gen 7's A10 is weaker than the phones that already start low; a stronger iPad can pick Medium in Pause). Pixel-ratio cap on tablets: low 1, med 1.25, high 1.5 (phones keep 1.5); an iPad screen has 2-3x a phone's CSS pixels.                                                                                                                          | `boot.js` (comment), `loop.js` (`touchCap`)                                                                           |
| World build (AC-P22)      | `slice()` writes into typed arrays sized once (linear). `appendGeo` transforms positions / normals straight from a cached non-indexed copy of the shared unit primitives (no clone per box; same maths as `applyMatrix4` incl. the normal matrix).                                                                                                                                                       | `world/geo.js`                                                                                                        |
| Low-tier budget (AC-P22)  | On the low tier: the occlusion field is 512 px (blur radii scaled; ~6x faster), and the nine 1024 px photos load from `assets/textures/half/` (same CC0 files, 512 px, +0.5 MB payload).                                                                                                                                                                                                                 | `world/aofield.js`, `world/textures.js`, `boot-perf.js` (`worldBudget`), `assets/textures/half/`, `assets/CREDITS.md` |
| Textures (AC-P22)         | Photos load through an `Image` + `img.decode()` (decoded off the main thread before WebGL sees them), still counted by `THREE.DefaultLoadingManager`, same stand-in on error. All scene textures are then uploaded with `renderer.initTexture`, a few per frame on the deferred queue, with the bar moving ("Getting the textures ready...").                                                            | `world/textures.js`, `boot-perf.js` (`uploadTextures`)                                                                |
| Warm-up (AC-P23)          | The loader's warm-up render runs with frustum culling off, so every mesh's buffers are on the GPU before Start (no first-sight uploads while walking). Higher tiers are still compiled only behind the Pause menu (unchanged).                                                                                                                                                                           | `boot.js`, `boot-perf.js` (`drawEverything`)                                                                          |
| Posture pictures (AC-P23) | Split into one job per picture (`Pictures.postureJobs`), queued after Start is enabled and run **only while not playing** (title, Pause). A prayer screen that needs one before then renders the rest at once (`finishPostures`), so a picture is never missing.                                                                                                                                         | `pictures.js`, `boot.js`                                                                                              |
| Progress (AC-P22)         | Real stages: world 4 -> 40 %, actors 50 %, photo downloads 50 -> 66 % (per file), uploads 66 -> 86 % (per texture), shaders 86 %, azan 90 %, ready 100 %. `G.BootPerf.mark()` records `kq:world`, `kq:actors`, `kq:textures-loaded`, `kq:textures-uploaded`, `kq:compile-<tier>`, `kq:render-<tier>`, `kq:shaders`, `kq:ready` as Performance marks (readable in Safari's Web Inspector on a real iPad). | `boot.js`, `boot-perf.js`                                                                                             |
| Context loss (AC-P23)     | `webglcontextlost`: save, pause, show the "The 3D view is having a rest" card with **Reload** (saves first); `webglcontextrestored`: hide the card and resume (three r147 rebuilds its GL state).                                                                                                                                                                                                        | `boot-perf.js` (`watchContext`), `index.html` (`#kqLost`)                                                             |
| Head                      | `<link rel="preload" href="three.min.js" as="script">` (the biggest script starts downloading with the styles). No bundler, no modules.                                                                                                                                                                                                                                                                  | `index.html`                                                                                                          |

## The deferral mechanism others should use: `KQ.Game.Defer`

`js/game/defer.js`, loaded before `boot.js`. A time-sliced job queue: at most 8 ms of jobs per animation frame, run after the frame has drawn.

```js
G.Defer.add(fn, "label"); // queue; fn() returning true = "call me again" (work in pieces)
G.Defer.add(fn, "label", { when: G.Defer.notPlaying }); // only on the title screen / Pause menu / hidden tab
await G.Defer.drain((done, total) => bar(done / total), 30); // during loading: run now, sliced, with progress
G.Defer.flush(); // need it this instant (tests, or a screen that needs the result)
G.Defer.stats(); // { pending, done, added, longestMs, longest }
```

How to apply it to new content (vehicles, animals, hero models, map art):

- **Anything built after the first frame** (an extra herd, far props, a second hero model, a big map canvas): queue it in chunks that each take a few ms; return `true` from the job until done. Never build a whole herd / atlas in one call during play.
- **One-off GPU work** (render-to-texture pictures, a new material's first compile): use `{ when: G.Defer.notPlaying }` so it runs on the title or Pause screen, and give the consumer a "finish now" fallback like `Pictures.finishPostures()`.
- **Before Start** (part of loading): queue the jobs and `await G.Defer.drain(onStep, 30)` from `boot.js` so the bar moves.
- **Known first-frame cost not yet moved**: the first `Crowd.update` (slot prune against colliders + instant fill) and the first `Vehicles.update` (placing vehicles) together take ~0.45-0.8 s at 4x in the Start tap. Both live in other workstreams' files (crowd, vehicles). The fix is to place vehicles and run `CrowdZones.prune` at boot (behind the bar) instead of on the first frame; the crowd's instant fill could then be the only first-frame work.

## Before / after (4x CPU throttle, median of 3 interleaved runs)

**iPad Pro 11 landscape / kampung** (median of 3 / 3 runs)

| metric                           | before | after |
| -------------------------------- | -----: | ----: |
| Start enabled (ms)               |  37435 | 21549 |
| Start tap to playing (ms)        |   8193 |  7497 |
| longest load task (ms)           |  20872 | 10778 |
| load tasks > 400 ms              |      8 |     7 |
| play: median task (ms)           |    909 |   923 |
| play: longest task (ms)          |   1733 |  1401 |
| play: spikes (>400 & >2x median) |      0 |     0 |
| JS heap peak (MB)                |   94.6 |  79.3 |
| textures (MB est.)               |  127.3 |  95.3 |
| programs at Start                |     41 |    41 |
| draw calls                       |    283 |   283 |

**iPad Pro 11 landscape / haramain** (median of 3 / 3 runs)

| metric                           | before | after |
| -------------------------------- | -----: | ----: |
| Start enabled (ms)               |  14183 | 12313 |
| Start tap to playing (ms)        |   7206 |  5142 |
| longest load task (ms)           |   5022 |  6206 |
| load tasks > 400 ms              |      7 |     6 |
| play: median task (ms)           |    666 |   515 |
| play: longest task (ms)          |   1542 |  1113 |
| play: spikes (>400 & >2x median) |      1 |     0 |
| JS heap peak (MB)                |  171.5 | 134.7 |
| textures (MB est.)               |   88.7 |  76.7 |
| programs at Start                |     30 |    31 |
| draw calls                       |    177 |   177 |

**iPad (gen 7) / kampung** (median of 3 / 3 runs)

| metric                           | before | after |
| -------------------------------- | -----: | ----: |
| Start enabled (ms)               |  34978 | 15160 |
| Start tap to playing (ms)        |   7509 |  4609 |
| longest load task (ms)           |  20603 |  7559 |
| load tasks > 400 ms              |      7 |     6 |
| play: median task (ms)           |    925 |   773 |
| play: longest task (ms)          |   1607 |  1238 |
| play: spikes (>400 & >2x median) |      0 |     0 |
| JS heap peak (MB)                |  198.8 |  80.2 |
| textures (MB est.)               |  127.3 |  95.3 |
| programs at Start                |     41 |    41 |
| draw calls                       |    284 |   285 |

**iPad (gen 7) / haramain** (median of 3 / 3 runs)

| metric                           | before | after |
| -------------------------------- | -----: | ----: |
| Start enabled (ms)               |  13427 | 11078 |
| Start tap to playing (ms)        |   5440 |  5560 |
| longest load task (ms)           |   4520 |  6291 |
| load tasks > 400 ms              |      6 |     6 |
| play: median task (ms)           |    564 |   615 |
| play: longest task (ms)          |    885 |  1107 |
| play: spikes (>400 & >2x median) |      0 |     0 |
| JS heap peak (MB)                |  202.1 |   115 |
| textures (MB est.)               |   88.7 |  76.7 |
| programs at Start                |     30 |    31 |
| draw calls                       |    177 |   177 |

Summary: time to Start enabled is down **42-57 % in the kampung** (37.4 -> 21.5 s, 35.0 -> 15.2 s) and **13-17 % in Haramain** (14.2 -> 12.3 s, 13.4 -> 11.1 s); the longest kampung load task is roughly halved; estimated texture memory is down 25 % (kampung) / 14 % (Haramain); no new one-off stalls in the first 10 s of play (spikes 0-1 before, 0 after); no console errors in any "after" run (one "before" Haramain run logged `Cannot read properties of undefined (reading 'ready')`). Earlier quieter runs on the same box: kampung Pro 11 33.3 s -> 12.8 s.

Where it did not improve: Haramain's longest load task went up (5.0 -> 6.2 s, 4.5 -> 6.3 s). That task is the warm-up render, which now draws every mesh (culling off) so buffers upload before Start; in SwiftShader that is GPU-process raster time the main thread waits on. On a real GPU it is mostly the buffer uploads that otherwise happen on the first frames of play. Worth checking on a real iPad; if it hurts, apply `drawEverything` only to the kampung.

Notes on the table: "Start tap to playing" is dominated by Playwright's tap actionability wait (it waits for stable animation frames while the title orbit renders in software GL) plus the first full-size frame; it did not change meaningfully. "Play" long tasks are every frame in software GL (2-3 fps), so the column to read is **spikes** (a task over 400 ms and over twice the median frame). Heap peaks swing with GC timing.

## Tests

- `tests/kampung-quest-ipad.spec.mjs` (project `kampung-quest`): iPad (touch + iPadOS UA) detected as tablet, low tier, pixel ratio <= 1, touch controls, the loading bar passes >= 4 increasing values, boot marks present, no console errors; the first 24 frames after Start have no one-off stall (worst <= 3x median + 150 ms: relative, so software GL in CI does not flake); posture pictures wait during play and finish behind Pause; context loss shows the card and restore hides it; a keyboard iPad (`pointer: fine`) still gets the touch controls and low tier; a Mac (no touch points) does not. `@slow`: iPad gen 7 at 4x reaches Start enabled in < 30 s and the deferred queue drains behind Pause.

## Learnings

- `Array.prototype.concat` in a per-item loop is quadratic; merging tens of thousands of primitives this way cost more than the rest of the world build together. Size typed arrays once.
- iPadOS Safari is a "Macintosh" with touch points; never gate touch UI, tier or DPR on `(pointer: coarse)` alone.
- In headless SwiftShader the long task after the first render is the GPU process (JIT pipelines + raster), not JavaScript: read CPU profiles (`profile-boot.mjs`) and per-step timers (`profile-world.mjs`) before optimising, and say so when reporting loading numbers.
- `renderer.compile()` only builds programs; the first `render()` still uploads buffers for what the camera sees. Rendering once with culling off behind the loader moves those uploads out of play.
- `P.cached()` in `geo.js` holds materials as well as geometries: mark only `isBufferGeometry` values as shared (a first version broke the Haramain boot).

## Decisions

- **iPad start tier = low, not med.** No reliable way to tell an iPad gen 7 (A10) from an M-series iPad in Safari (the GPU string is "Apple GPU" for all); low is safe and the player can raise it in Pause. Rejected: med for all iPads (risk on the oldest supported iPads), UA-version heuristics (iPadOS reports a Mac UA).
- **Half-size photos as files, not runtime downscaling.** Rejected: canvas downscale (main-thread draw + a readback upload per texture), `createImageBitmap` with resize options (uneven Safari support).
- **Keep Makkah + Madinah built together.** Madinah is ~0.26 s of a ~2.1 s holy-world build at 4x; splitting `holy-world.js` would collide with the camel / horse work for little gain.
- **Posture pictures only while not playing**, with a synchronous fallback, rather than before Start (keeps Start sooner) or during play (each render is a GPU read-back).
