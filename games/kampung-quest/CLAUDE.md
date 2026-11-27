# Kampung Quest — game-local contract

> Constraints for anyone (human or Claude) touching this game. The project-wide rules in the root `CLAUDE.md` / `docs/` still apply; this file adds the game-specific ones. Feature docs: `features/kampung-quest/` (`requirements.md`, `contract.md`, `design-review.md` = the HUD spec, `qa-report.md`, `product-validation.md`).

## Hard constraints

- **Build-free classic scripts under `window.KQ`.** No ES modules, no bundler (the `file://` rule, `docs/LEARNINGS.md`). Files load in the order listed in `index.html`; a new file must be added there. Every file is wrapped in `(function (KQ) { "use strict"; ... })((window.KQ = window.KQ || {}))`.
- **Layers (load order):** `js/data` (prayer times, azan captions) → `js/sim` (pure logic, **no THREE, no DOM**, unit-tested: `npm run test:kq`) → `js/figures` (toy cast, poses) → `js/world` (the neighbourhood) → `js/game` (controller, HUD, prayer flow). The game layer may call the others; they never call it.
- **three.js r147 is vendored** (`three.min.js`, UMD). Do not upgrade (no UMD after r160, `file://` rule). `renderer.outputEncoding = sRGBEncoding`, ACES 0.95, PCF-soft shadows.
- **Graceful degradation is mandatory.** `KQ.CAN_FETCH = location.protocol !== "file:"` gates every fetched asset (the photo textures); each has a procedural stand-in. The azan plays from an `<audio>` element (works on `file://`); if it fails to load, a synth chime plus captions replace it. WebGL missing → a friendly card, no crash. Blocked `localStorage` → play without saving, with a notice.
- **Text enters the DOM only through `textContent`** (`KQ.Game.U.el`). `innerHTML` is used only for our own SVG constants (`U.svgFrom`, `pictures.js`). The save is untrusted input (`KQ.Sim.Save` clamps and schema-checks it).
- **Lint:** functions ≤ 40 lines, depth ≤ 3, no empty `catch`, no `console.log`. Split into small functions; do not add files to the lint baseline.
- **Payload < 12 MB** (three.js, ~50 small scripts, 11 photo textures, the azan).

## Child-friendly and religious-accuracy rules (never break these)

- No violence, no fail state, no punishment, no scolding: a wrong tile gives a gentle hint ("Nearly! Next: Ruku (bow).") and the expected tile glows softly, never red or a cross. Every food is halal. Vehicles never hurt the player.
- **Prayer times** are the fixed MUIS values for 26 Nov 2026 in `js/data/prayer-times.js` (source cited there and in `assets/CREDITS.md`). Raka'at: Subuh 2, Zohor 4, Asar 4, Maghrib 3, Isyak 4. Wudu order and the posture sequence come from `KQ.Sim.Prayer` (Shafi'i, as in Singapore): do not re-implement them in the UI.
- **The azan is a real recording** (CC BY-SA 4.0, see `assets/audio/azan_license.txt`). It plays once per prayer, only when the tab is visible, the game is unmuted and unpaused; otherwise captions only. **No music, ever, during the azan** (there is no music in the game at all).
- The hero must keep the colour family (royal blue, tan arms, white gloves, red shoes) with **no quills, no joined eye-patch, no green eyes, no peach muzzle, no belly oval**.

## Module map (`js/game`)

| Area          | Files                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Boot / loop   | `boot.js`, `boot-ui.js`, `loop.js`, `sim-setup.js`, `settings.js`, `hooks.js` (`__kq`)                                                                                                                                                                                   |
| Hero / camera | `player.js` (walk, jump), `input.js`, `camera.js`, `collide.js` (pure circle-vs-box maths: settle, separate, openHeading, armLength; `js/sim/jump.js` is the jump arc)                                                                                                   |
| NPCs          | `npc-manager.js` (routines, reveal, separation), `npc-agent.js` (walk, poses), `npc-goals.js` (seats, prayer rows), `pathing.js`, `seats.js`                                                                                                                             |
| World extras  | `collectibles.js` (cans, litter, Mimi), `markers.js` (beacons, footprints, giver stars)                                                                                                                                                                                  |
| Crowd         | `crowd.js` (population, range, cap, draw), `crowd-zones.js` (every fixed spot), `crowd-members.js` (spot behaviours), `crowd-walkers.js` (strollers on the walk graph); pure rules `js/sim/crowd.js`; renderer `js/figures/crowd-{geo,kit}.js`, poses `crowd-poses.js`   |
| HUD / UI      | `hud.js`, `hud-view.js`, `minimap.js`, `ui-core.js` (sheets, focus trap, toasts), `ui-dialogue.js`, `ui-menus.js`, `ui-screens.js`, `pictures.js`, `names.js`, `speech.js`                                                                                               |
| Prayer        | `prayer-flow.js` (controller), `prayer-ui.js` (screens), `prayer-text.js` (dhikr, captions)                                                                                                                                                                              |
| Play          | `interact.js`, `mission-flow.js`, `services.js`, `actions.js`, `nudge.js` (first-meal nudge + hawker beacon, food / energy low notes; decisions in `js/sim/hints.js`)                                                                                                    |
| Greetings     | `greetings.js` (salaam bubbles over passing citizens and for the hero; pooled DOM, no draw calls; hook `__kq.greetings()`); decisions, chances, cooldowns and caps are pure in `js/sim/greet.js`. The salaam exchange is only between Muslim people, others say "Hello!" |
| Sound         | `audio.js` (synth UI sounds, footsteps, azan element, lifecycle gates), `ambience.js` (synth day/night/place soundscape, ducked to silence under the azan and prayer; probe `Audio.debug().ambience`); `greetings.js` (salaam bubbles, rules in `js/sim/greet.js`)       |

State lives in one object, `KQ.Game.S` (created in `boot.js`). The pure sim objects are `S.sim.{clock, prayer, needs, hints, economy, missions}`.

## Rules that are easy to break

- **The pause / hidden gate sits where time and sound are produced** (`Loop.frame`, `Audio.voice`), not in callers (`docs/LEARNINGS.md`, 2026-11-21 audio rows). `Audio.debug()` counts every trigger and every refusal so a probe can assert the lifecycle.
- **Sun times.** The world follows `KQ.PRAYER_TIMES` itself (`js/data/prayer-times.js` must load before the world scripts): sunrise = Syuruk, sunset = Maghrib. `world.update` is given the real clock minute; do not remap it.
- **Prayer flow slows the clock to 25 %** (`FLOW_RATE`) while a flow is active or a prayer screen is open, so a 50-tap Zohor does not run into Asar. A prayer that falls due during a menu is queued (`PrayerFlow.maybeShowCard`) and shown after the menu closes.
- **Indoor NPCs** (`routine.indoors`) are hidden, but stand at their block's door when the hero is within 15 m (so the first mission giver is always reachable at 07:00).
- **Time of day for tests:** `__kq.setMinute(m)`, `__kq.forcePrayer("zohor")`, `__kq.step(ms)` advance deterministically even when headless rAF is throttled.
- **Characters never move without `Collide.settle`.** Hero, NPCs and their separation all end in a push-out against the colliders (body radius `Player.RADIUS` 0.33, `NpcAgent.RADIUS` 0.31); NPCs are placed with `placeAt` / `stepOut` (free spot, facing open space); stuck means no progress toward the waypoint, and two skips ask for a new route. The camera arm is floored at 0.35 m and rises as it shortens. Audit: `tests/kampung-quest-collision.spec.mjs`.
- **Jump** (Space, touch Jump button, `__kq.input("jump")`): height only (`Sim.Jump`, peak 0.8 m, no double jump), colliders stay horizontal; Space is taken only while `Actions.canJump()`.
- **The crowd is instanced, not rigged.** The 16 cast neighbours are full rigs (14 meshes each); the extras are `KQ.Figures.CrowdKit`: one InstancedMesh per part type (about 25 draw calls for any headcount), poses from the same `F.POSES` functions baked into a (pose, phase bucket, kid) bank. Never add a per-person mesh or light. New activity = a pose in `crowd-poses.js` + a slot kind in `crowd-zones.js` + a curve in `Sim.Crowd`. Extras appear and vanish only out of sight (`mayPop`), never walk except on the walk graph or inside a collider-checked play area, hold seats in the shared `npcs.seats` as `taken === "crowd"`, and are not talkable. Caps per tier are `Sim.Crowd.TIER_CAPS`; the draw-call budget is asserted in `tests/kampung-quest-crowd.spec.mjs` and AC-14.
- **Hair / hat outfit:** `hat: "none"` + `hair: "classic"` is the hero's own blue cap (the save default); other combinations come from `Player.HEAD_STYLES`.

## Mobile and touch

- **Touch is first-class** (owner priority): joystick (left), drag-to-look and two-finger pinch on the scene, joystick-rim run (no Run button), Jump button, the floating Talk button, the dock, every menu and the wudu / prayer tiles. All HUD buttons are >= 48 px; `touch-action: none` on the stage, `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` blocked, `viewport-fit=cover` plus `env(safe-area-inset-*)`.
- **Quality:** coarse pointers and software GL (SwiftShader / llvmpipe) start on `low`; pixel ratio is capped at 1.5 on touch devices; the loop drops one tier after ~3 s under 40 fps (`Loop.monitor`).
- **Audio on iOS:** `Audio.unlock()` runs on Start and on later touches (resumes a suspended context after returning to the tab); the azan `<audio>` element is created at Start and primed with a silent play+pause inside that gesture. It is NOT created at load (an idle media request keeps the page from ever being "network idle").
- **Prayer panels:** a side panel when the viewport is >= 700 x 340 (the hero stays centred in the rest via `Camera.setShift`), a bottom sheet otherwise. `PrayerFlow.refit()` re-frames / switches the panel on rotation or resize.
- **Phone "lite" HUD:** on phones the status card (clock + icon-only prayer strip, only the due prayer named) and the mission card (one-line chip) fold; a tap opens them, a new mission step peeks for 7 s (`HudLayout.toggle/peek`). In phone landscape the azan card sits in the band above the dock; Talk (z 9) stays above it. Toasts are held while a modal sheet is open. Sheets close on a backdrop tap, except Pause.
- `tests/kampung-quest-mobile.spec.mjs` drives an emulated iPhone 13 (landscape) and Pixel 7 with raw CDP touches.

## Test hooks (`window.__kq`)

`ready` (game running), `loaded` (assets ready, Start enabled), `state()`, `step(ms)`, `setMinute(m)`, `teleport(poiId)`, `place(x, z, yaw)`, `interact()`, `action(name)`, `input(action, on)`, `forcePrayer(name)`, `freeze(bool)`, `stats()` (`fps`, `frames`, `calls` incl. shadows, `tris`, `programs`), `npc(id)`, `start(fresh)`. URL flags: `?q=low|med|high`, `?autoq=0` (no auto-downgrade), `?still` (no rAF loop; drive with `step`).

## How to run and test

- Run: `node tools/serve.mjs 5599` then open `/games/kampung-quest/`, or open `index.html` from disk (`file://`: photo textures are drawn in code).
- `npm run test:kq` (sim unit tests, in CI), `npm run smoke` (all browser specs incl. `tests/kampung-quest-ac.spec.mjs` and `tests/kampung-quest-mobile.spec.mjs`, minus `@slow`), `npm run smoke:core` / `smoke:kq` / `smoke:kq:ac` / `smoke:kq:mobile` (CI runs core and the two kq legs as separate jobs), `npm run perf:kq` (the 4x-throttled CPU frame probe; runs in `probes.yml`), `npx eslint games/kampung-quest tests`.
- **Interact priority:** an NPC with mission business beats a service counter (`KQ.Sim.Missions.pickTarget`); after talking, the counter wins again until the hero walks 4.5 m away.
- **Saves** carry a `rev`; a stale tab is refused (`storage` listener toasts it). A tracker ahead of the clock is rebuilt (`Prayer.update`).
- **Perf:** `stats().calls` includes the shadow pass; static batches are split into 72 m ground cells; the low tier keeps 3 point lights and only the hero + 3 nearest NPCs cast shadows; `boot.js` compiles the start tier and every tier below it behind the loading screen (one frame yielded between tiers; R3-PERF-01), and builds the higher tiers one per 500 ms tick only while the Pause menu is open.
- Screenshots / probes use headless Chromium with `--use-gl=angle --enable-unsafe-swiftshader`; boot takes ~10-15 s in software GL.
