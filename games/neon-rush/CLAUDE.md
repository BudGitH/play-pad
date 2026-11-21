# Neon Rush — game-local contract

> Constraints for anyone (human or Claude) touching this game. The project-wide rules in the root `CLAUDE.md` / `docs/` still apply; this file adds the game-specific ones.

## Hard constraints

- **Single game file + vendored deps:** all game code is in `index.html`. Its siblings: `three.min.js`, `GLTFLoader.js`, this doc, and `assets/`.
- **Three.js is vendored at r0.147.0 (UMD), not CDN.** r147 is the **last release with classic-script (`examples/js`) loaders** — needed because `GLTFLoader.js` must attach `THREE.GLTFLoader` to the global (ES-module builds break under `file://`; a CDN tag breaks the deployed CSP `script-src 'self'`). **Do not upgrade past r147** without solving the module/file:// problem, and keep `three.min.js` + `GLTFLoader.js` version-matched.
- **CSP note (deploy):** GLTFLoader loads GLB-embedded textures as `blob:` object-URLs (on Chrome via `ImageBitmapLoader.fetch`), so the site CSP **must** keep `blob:` in **both `img-src` and `connect-src`** (`_headers`). Miss either and models render grey on the deployed origin while localhost (no CSP) looks fine — see LEARNINGS PLAY-005 v4.
- **Vendored assets (`assets/`), all CC0/free — see `assets/CREDITS.md`:**
  - `models/` — 3 animated GLB characters (KayKit Rogue_Hooded → Urban Runner, Quaternius Astronaut → Star Rider, three.js RobotExpressive → Neon Bot). CC0.
  - `models/city/` — KayKit City Builder Bits (CC0): `building_A..H.glb` (textured roadside city; the neon boxes retreat to skyline duty when these load) + `car_police.glb` (the hover-patrol chaser; primitive drone is its fallback). Converted from the pack's gltf+bin to single-file GLBs with the texture embedded.
  - `audio/` — `music.ogg` (ansimuz "Cyber Runner", CC0) + 6 Kenney sci-fi SFX (CC0).
  - `CREDITS.md` **must ship** with the game (shown in small print on the setup screen too). Keep it current when assets change.
- **Graceful degradation is mandatory — the game must never DEPEND on an asset loading:**
  - GLB models + Web-Audio SFX load via `fetch`/GLTFLoader. On any failure the **primitive-built skins** (still in `SKIN_BUILDERS`) and the **synth voices** (still in `AudioManager`) take over automatically. Never delete those fallbacks.
  - **`file://` caveat:** Chrome blocks `fetch`/XHR to `file://`, so a _double-clicked_ `index.html` runs the FALLBACKS (primitive models + synth SFX) — still fully playable. Real models + SFX need an http(s) origin: the deployed Cloudflare site, any static server, or `python -m http.server`. Music (`<audio>` element) works from `file://` too. The deployed site (what players actually use) is always full-featured.
- **Audio-files are now allowed** (this supersedes the original "synth only" rule). The drone siren stays synth (it's a live proximity layer). Every file voice keeps a synth fallback.
- **Performance:** target 60fps. Pools for obstacles/coins/particles; one `AnimationMixer` per active skin updated in the fixed-step tick; `dpr` capped at 2; fixed-timestep sim; pause on `visibilitychange`.

## Module structure (inside index.html, section-bannered)

| Module             | Owns                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerController` | lane state + lerp, jump/slide physics, input (arrows + swipes), drives the GLTF mixer or the primitive `animateSkin`                                                                                                                                                                                                                                                                                                |
| GLTF skins         | `MODEL_CFG` + `buildGltfSkin` (normalize/scale/orient/hide-weapons/glowMats) + a per-skin state machine (idle/run/jump/slide crossfades, missing clips fall back to run); `preloadModels` async-loads, `applySkin` hot-swaps GLB↔primitive and fully resets the cached mixer (T-pose guard)                                                                                                                        |
| `ObstacleSpawner`  | pooled barriers/trains/coins/pickups, fairness pattern table, scrolls the road CanvasTexture                                                                                                                                                                                                                                                                                                                        |
| `CollisionEngine`  | AABB tests, hoverboard i-frames, near-miss → drone                                                                                                                                                                                                                                                                                                                                                                  |
| `UIManager`        | screen router (`show()` teardown chokepoint), HUD, shop, live region, instant-start countdown skip                                                                                                                                                                                                                                                                                                                  |
| Particle FX + sky  | `makeSpriteTexture`/`makeParticles` (pooled `THREE.Points`, additive-blend, colour→black fade); `shieldAura` (gold orbiting swirl, replaces the old shield sphere) via `updateShieldAura`; `patrolFX` hover-jet exhaust (world-space pool, replaces the police-car underglow plane) via `updatePatrolFX`; dynamic skydome (`makeSkyTexture` gradient+sun) + starfield rolled/hue-shifted by distance in `updateSky` |
| `AudioManager`     | file music (`<audio>`) + decoded SFX buffers, each with a synth fallback; drone synth; mute persistence                                                                                                                                                                                                                                                                                                             |
| `SaveManager`      | the single localStorage gateway (`playpad.neonRush.v1`, versioned, sanitized, fail-soft)                                                                                                                                                                                                                                                                                                                            |

## Instant start

First run is a snappy 3-2-1-GO at 300ms/step (~1.2s); **retries skip to a "GO!" flash** (~0.2s); **any tap/key during the countdown skips it**. Tune in `startRun`.

## Testing

`window.__neon` exposes state + deterministic drivers (`forceSpawn`/`setSpeed`/`step(ms)`/`crash`/`givePowerup`) plus `.skin` (GLB vs primitive, current anim, mixer time, visible weapons) and `.audio` (loaded SFX, music state). Headless preview throttles rAF and often can't screenshot the WebGL canvas — verify logic through `step()` and the probes; verify visuals with occasional screenshots.
