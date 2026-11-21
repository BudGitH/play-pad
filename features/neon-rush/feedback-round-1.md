# Neon Rush — Feedback Round 1 (2026-07-13, PLAY-005 v3)

Owner feedback on the deployed game, and how each item was addressed. All code in
[games/neon-rush/index.html](../../games/neon-rush/index.html).

## Requirements (owner's 5 items)

1. Hosted site showed a **grey model**, and after the first play the character froze in a **T-pose** — no reset/animation on retry.
2. Background should be **actual textured models**, not the neon-abstract wireframe boxes.
3. The chaser wasn't recognizable — make it a **real, readable model** (owner chose: hover police drone).
4. The **Knight** skin didn't fit the neon theme — replace with something logical (owner chose: cyborg/android → shipped Quaternius **Astronaut "Star Rider"**).
5. **Too long** (~11s) before the first obstacle/coin — halve it so play starts a few seconds in.

## What shipped

| # | Change | Where |
|---|---|---|
| 1a | `renderer.outputEncoding = THREE.sRGBEncoding` — GLB textures no longer render grey | renderer setup |
| 1b | `applySkin` fully resets the cached `AnimationMixer` (stopAllAction + weight-0 sweep + forced idle weight); mixer also ticked in the `crashed` phase; state machine tracks the **resolved** action so missing clips don't re-fade | `applySkin`, `buildGltfSkin.ctrl` |
| 2 | KayKit City Builder Bits `building_A..H.glb` cloned into a recycled `cityBuildings` pool; neon boxes retreat to a far skyline (`cityMode`) and stay as the file:// / failure fallback | `preloadCity`/`enableCityBuildings`/`resetBuilding` |
| 3 | KayKit `car_police.glb` hover cruiser (wheels hidden, red/blue roof lightbar + underglow) replaces the primitive drone visual; primitive drone stays as fallback | `preloadPatrol` |
| 4 | `MODEL_CFG.skater` → Quaternius `Astronaut` (clips verified from the GLB: `CharacterArmature|Run/Idle_Neutral/Roll`, no jump clip); `SKINS` renamed "Star Rider"; `glowMats` adds cyan accent glow; `Knight.glb` removed | `MODEL_CFG`, `SKINS` |
| 5 | `firstWave` flag: first wave of each run spawns at z=-55 (vs -110) with a short `distToNextWave`, coins guaranteed → first contact ~1–5s (was ~11s) | `ObstacleSpawner` |

New CC0 assets vendored + credited: `assets/models/Astronaut.glb`, `assets/models/city/*` (+ license files); `assets/CREDITS.md`, game `CLAUDE.md`, and `docs/ARCHITECTURE.md` updated. `Knight.glb` deleted.

## Tests / verification (headless preview, `__neon` drivers + canvas-frame capture)

- **Grey fix:** captured frames show all three skins (Urban Runner, Star Rider, Neon Bot) in full color on the textured street.
- **T-pose fix:** real retry path (`againBtn` → `startRun` → `applySkin`) — run 2 poses from the first sim step and the mixer advances (`anim:"run"`), across two consecutive runs. First rendered frame already posed (idle forced to full weight).
- **Spawn timing:** first obstacle enters within ~1s of the run starting (`activeObstacles > 0` at t=1s).
- **Graceful degradation:** verified by code trace — all-fail on any GLB set leaves the neon boxes / primitive drone / primitive skins in place (`cityMode` false, `.prim` children visible, `SKIN_BUILDERS` fallback).
- **Chaser:** police-car GLB swaps in with flashers relocated to the roof; visible when tension pulls it forward.

## QA panel (multi-lens, parallel)

- **ACCURACY:** no CRITICAL/HIGH. Spawn logic safe & survivable (wave 2 never overlaps wave 1); `firstWave` resets every run; recycle/async paths null-safe & single-shot. 3 LOW cosmetic nits — **all fixed**: (a) `update(0)` posed at zero weight → now forces idle weight 1; (b) jump-fallback run `timeScale` snapped to 1x → now always speed-tied; (c) misleading wave-gap comment → corrected.
- **QUALITY/COMPLIANCE:** PASS. Graceful degradation preserved (top priority), CREDITS/CLAUDE.md accurate, zero stale `Knight`/`Cyber Skater`/`patrol drone` references, new loaders mirror the existing `preloadModels` pattern. Fixed one stale internal comment + an `r148`→`r147` typo.

## Deploy

Fixes are only visible on an **http(s) origin** (GLBs can't load from `file://`). Rebuild `dist/` (`tools/build-dist.ps1`) and redeploy to Cloudflare Pages, then hard-refresh.
