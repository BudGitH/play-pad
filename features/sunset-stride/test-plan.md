# Test Plan: Sunset Stride (revamp of Neon Rush)

**Requirements:** `requirements.md` · **Tier:** Standard (full edge/error matrix) · **Hook:** `window.__stride` (deterministic `step(ms)`, `forceSpawn`, `crash`, `hit`, probes)

## Coverage map (AC → test)

| AC   | Test(s)                                                                                                                                                                                                                                                                             | Kind           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| AC1  | grep: no "Neon Rush" in shipped files; `_redirects` has the 301; hub card renders "Sunset Stride"                                                                                                                                                                                   | static + smoke |
| AC2  | screenshot 390×844 + 1280×720 per obstacle type; mean luminance of the frame ≥ threshold (computed in the probe script)                                                                                                                                                             | probe + visual |
| AC3  | `__stride.skin.weights.__sum ≈ 1` sampled in countdown / run / jump / slide / stumble / caught; `skin.handSpan` well under the T-pose arm span while running                                                                                                                        | probe          |
| AC4  | bone spread changes between two steps while running; slide: `skin.weights.slide ≈ 1`, `skin.scaleUniform === true`, lowest bone ≤ 0.3 m (the code targets ≈ 0.09 m)                                                                                                                 | probe          |
| AC5  | `__stride.hit()` → dogs `z > 0`, in frustum, nearest gap ≤ 2.2; `step(6000)` clean → gap ≥ 3.5; dogs never at z < 0                                                                                                                                                                 | probe          |
| AC6  | stumble vs caught; side-scrape bounce; buffered jump on landing; jump cancels slide; close call +10 and gap +                                                                                                                                                                       | probe          |
| AC7  | save round-trip under new key; legacy import once; corrupt JSON → defaults                                                                                                                                                                                                          | probe          |
| AC8  | route-abort every `/assets/**` request → game starts, `skin.kind === "primitive"`, `dogs.kind === "primitive"`, zero page errors                                                                                                                                                    | probe          |
| AC9  | pause on hide/blur, countdown, draw calls ≤ 170 high, `prefers-reduced-motion` → no shake/FOV kick, no WebGL → notice                                                                                                                                                               | probe + smoke  |
| AC10 | `npm run smoke`, `npm run check`, `npm run secrets`                                                                                                                                                                                                                                 | CI             |
| AC12 | `__stride.audio.played` deltas over a scripted run (step ≥ 3, jump, land, swoosh ≥ 2, slide, coin ≥ 3, bump, bark), `streak` ≥ 3, wind on; `__stride.fx` emitted > 40, live ≤ pool size, tier `mult` low < medium < high; screenshots of coins / landing / skid / power-up / impact | probe + visual |

## Test cases

### Happy path

1. Open game → setup shows "Sunset Stride", bank row, how-to; **Start running** → countdown → `phase === "running"`, score advances.
2. Arrow / swipe lane change moves `player.lane`; jump raises `playerY`; slide sets `sliding` and the slide pose weight → 1.
3. Collect coin → `runCoins` +1, score +5; power-up pickup → chip shows, timer drains.
4. Hit once → stumble (still running); wait → dogs fall back; hit twice quickly → `phase === "crashed"` → results with "Caught!".
5. Shop: buy skin with enough coins → equipped, persisted, runner texture changes.

### Edge cases (boundaries)

- Hit exactly as a stumble i-frame ends; hit during a slide under a bar (should not collide); jump over a bar (collides — bar is tall).
- Side-scrape into a van while mid lane change (bounce, never fatal) vs frontal hit into the van (stumble).
- Input while paused ignored; held key from resume doesn't skip the 3-2-1.
- Speed ramp capped at `SPEED_MAX`; stumble slow-down never drops below 55 % of speed.
- Power-up on the same z-slab as an obstacle in the same lane is not spawned.

### Error paths

- All `/assets/**` requests fail → fallbacks, no uncaught errors (console "Failed to load resource" for the aborted requests is expected in the test).
- `localStorage` throws / corrupt JSON → defaults, game still plays.
- WebGL context creation fails → `#glFail` notice, setup stays usable.

### Non-functional checks

- Draw calls (main pass) ≤ 170 high / ≤ 110 low; `renderer.info.memory.geometries` does not grow run-over-run (no leaks).
- 60-second soak with `step()` at max speed: no NaN positions, pools stable.
- `npm run check`, `npm run secrets`, `npm run smoke` green.

## How to run

```bash
npm ci && node tools/serve.mjs 5599 &
node tests/probes/stride-probe.mjs        # headless WebGL probes (swiftshader), prints JSON per AC
npm run smoke && npm run check && npm run secrets
```

## Definition of done

All ACs have a passing probe or smoke check, QA panel round clean, product validation PASS, docs updated, PR merged.
