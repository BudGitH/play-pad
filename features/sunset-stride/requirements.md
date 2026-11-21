# Feature: Sunset Stride — Neon Rush revamp (look, models, chasers, mechanics)

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** APPROVED — owner request 2026-11-21 ("Revamp the look and feel… call it a more chill name…"), decisions delegated ("create PR then merge when confident")
**Owner:** @BudGitH
**Ticket:** PLAY-007
**Created:** 2026-11-21
**Feature tier:** Standard (project tier; public open-source)

---

## What & why

- **What:** Neon Rush becomes **Sunset Stride** — the same 3-lane 3D endless runner, rebuilt around a bright **golden-hour town** instead of a dark neon night, with a **real runner** (animated human, no T-pose), a **real slide** (not a squash), **chasers that come from behind the runner**, and better mechanics.
- **Why (owner feedback, verbatim themes):** the theme was "too difficult to see"; models T-posed and did not "work like an actual runner"; the slide was "squashed"; the chasers did not come from behind the player; the characters (hooded rogue, astronaut, robot, hoverboard) did not "make sense"; wants "real world textures and animations" and "better mechanics"; wants a "more chill name".

## Business requirements & success metrics

- **Business outcome:** the flagship solo game is readable at a glance on a phone in daylight, feels like running, and still carries the progression loop (coins → skins → high score) that makes players come back.
- **Success metrics:** (1) a first-time player identifies lanes, obstacles and what to do about each one (jump / slide / dodge) within the first run without reading the how-to; (2) zero frames in which a character shows a T-pose / bind pose during setup, countdown, run, slide, jump, stumble or caught; (3) the chasers are visible behind the runner when close and the player can see why a hit was (or was not) fatal.
- **Must-have business rules:**
  - Still works from `file://` and offline: every GLB / texture / audio file has a fallback (procedural textures, primitive runner and dogs, synth SFX). The game never _depends_ on an asset loading.
  - No backend, no network at runtime; deployed CSP stays unchanged (`blob:` in `img-src` + `connect-src` for GLB textures stays).
  - All assets CC0 (or MIT for libraries) and credited in `assets/CREDITS.md` + the setup screen.
  - Returning players keep their coins and best score (one-time import from the old `playpad.neonRush.v1` key); the old URL `/games/neon-rush/` redirects to the new one.

## Target personas & success bar

- **Personas served:** Maya "Commuter Casual" (solo, phone, one-handed, 1–2 min), Sam "Keyboard / AT user" (keyboard, reduced motion), Dan "Office Micro-breaker" (desktop, short breaks) — from `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** start a run in ≤ 2 taps; control with arrows/WASD/Space or swipes; understand the three obstacle kinds from how they look; get caught or retire; see score + coins; retry in one tap.
- **Value (hard gate):** noticeably easier to read and nicer to look at than the neon version; running, jumping and sliding look like a person doing them; the chase creates tension without cheap deaths.
- **Satisfaction (scored):** "one more run" pull from the stumble / recover loop and from close-call bonuses.

## Design routing

UI surface: **yes**, **not reuse-only** (new in-game art direction, new HUD chrome). Tier Standard → **full** path per `docs/WORKFLOW.md` Phase 1b. **Headless run:** the owner delegated the visual decisions, so the Design Roundtable record is in `design-review.md` (art direction chosen with rationale, rendered screenshots as the mock-ups of record) instead of a 4-option `mockups.html` the owner must pick from.

## Design review

See `design-review.md`.

## User-visible behaviour

1. **Name / identity:** "Sunset Stride", hub tile 🌇, folder `games/sunset-stride/`.
2. **World:** low sun, warm haze, blue sky with clouds; asphalt road with lane markings, paved sidewalks, grass verges, street trees and lamps, brick / plaster facades with windows — all from real photo textures (ambientCG CC0) with procedural fallbacks.
3. **Runner:** a skinned human with a real run cycle, jump, a hand-authored **feet-first slide** pose, a stumble lurch and a caught tumble. Six outfit skins in the shop (3D thumbnails).
4. **Chasers:** a pack of three dogs **behind the runner**. Clean running keeps them back; a hit makes them lunge to the runner's heels; a second hit while they are close = caught. Staying clean makes them fall back again.
5. **Obstacles — real street set pieces (a town street with road works and a market day):** jump over a **road-works barrier** (cones, sandbags, beacon), a **delivery pallet of produce** or a **market fruit cart**; slide under **scaffolding** (LOW HEADROOM sign) or a **market-stall awning**; go around a **delivery van**, **food truck**, **box truck** or **city bus**. Coins, magnet, spring-sneakers, bubble.
6. **Mechanics:** input buffering, forgiving side-scrape (bounce back to your lane, never fatal), stumble → recover, close-call bonus that pushes the dogs back, jump-cancel of a slide, fast-fall.
7. **HUD:** score, coins, mute, quit, dog-proximity meter, power-up chips, toasts. Pause / resume / countdown behaviour unchanged.
8. **Game feel — particles:** pooled dust (footfalls, jump, landing ring), slide skid sparks, coin sparkles, power-up bursts, bubble pop, stumble debris + dizzy stars, dog dust, close-call streaks, sunlit ambient motes (counts scale with the quality tier; mostly off under reduced motion).
9. **Audio:** a chill lo-fi loop (CC0 file) whose tempo follows the speed and which ducks under the "caught" sting; every effect synthesised (footsteps on the run cycle, landing thump, lane swooshes panned to the direction, a pitch-climbing pentatonic coin chime, skid, a wind bed that grows with speed, dog steps / pants / barks panned to where they run, countdown ticks, stings, a new-best fanfare, UI ticks).

## Acceptance criteria

- **AC1 Name:** the hub, page title, setup H1, README, registry and docs say "Sunset Stride"; `/games/neon-rush/` redirects to `/games/sunset-stride/`; no user-visible "Neon Rush" remains except in the changelog/history.
- **AC2 Legibility:** in a screenshot at 390×844 and 1280×720 the road, three lanes, every obstacle type and the runner are distinguishable; mean scene luminance is bright (not a night scene); obstacle colours contrast with the asphalt.
- **AC3 No T-pose:** the runner is never shown in bind pose. `__stride.skin` reports a non-zero total clip weight in every state (setup preview, countdown, run, jump, land, slide, stumble, caught) and arm spread is below T-pose width while running.
- **AC4 Runner animation:** while running, the leg / arm bones move (bone spread changes across frames); the slide uses the authored pose (torso reclined, legs forward, lowest point near the ground, **no non-uniform scale on the model**).
- **AC5 Chasers behind:** after a hit, ≥ 1 dog is at z > 0 (behind the runner), inside the camera frustum, and closes to within 2.2 m; they never spawn ahead of the runner; after ~6 s clean they are ≥ 3.5 m back (the pack falls back 0.35 m/s from 1.7 m).
- **AC6 Mechanics:** (a) a first frontal hit is a stumble (run continues, speed drops, i-frames), a second within the danger window ends the run; (b) a hit while changing lane into a blocker bounces back and is never fatal; (c) a buffered input fires on landing; (d) jumping during a slide cancels it; (e) a close call awards +10 and pushes the dogs back.
- **AC7 Persistence:** coins, unlocked skins, equipped skin, best score and mute persist under `playpad.sunsetStride.v1`; legacy coins/best are imported once.
- **AC8 Fallbacks:** with every asset request failing (and on `file://`) the game starts, runs, and shows a primitive runner and dogs, procedural textures and synth sound, with no uncaught errors.
- **AC9 Existing contract kept:** pause on hide / blur, instant start, quality tiers, ≤ 170 draw calls on high, no per-frame allocation in hot paths, WebGL-missing notice, reduced-motion respected.
- **AC10 Smoke:** `npm run smoke` passes (hub + all games, round starts on phone + desktop).
- **AC11 Model fidelity (owner request mid-run: "high fidelity, improved visual quality"):** within a CC0 stylised pack — smooth (auto-smoothed) normals, a face, trainers and outfit palettes on the runner; eyes, nose and fur shading on the dogs; vehicles with rounded bodies, clearcoat paint, glass, wheels with hubs, lights and a livery; organic trees; every obstacle a recognisable real-world object. Verified by close-up renders and the probes (draw-call / triangle budgets unchanged in kind). **Not** a photoreal or high-polygon character: the rigged CC0 set available offline is stylised low-poly, polished rather than replaced.
- **AC12 Game feel — particles + audio (owner request: "particle effects to make it playable and fun with good audio"):** every gameplay event has both a visual and a sound. Verified by trigger counters and live particle counts (`__stride.audio.played`, `__stride.fx`): footsteps, jump, landing, lane swooshes, skid, coin chimes that climb with the streak, stumble thud + bark + debris; the wind bed is on while running and the music tempo follows speed; the two particle pools never overflow and thin out on lower quality tiers. **Not verifiable headless:** how the mix actually _sounds_ (levels, balance, taste) — that needs a human ear on a real device; screenshots show the particles are visible, not that they look "fun".

## Edge cases & error states

- GLB or texture 404 / blocked → fallbacks (AC8). WebGL missing → existing notice.
- Tab hidden mid-run → pause + 3-2-1 resume (unchanged). Pause while stumbling keeps the danger window.
- Window resize / rotation → camera rig recomputed; all three lanes stay visible on portrait phones.
- Corrupt / missing save → defaults; private mode → in-memory.
- Two obstacles in the same z-slab, spawn overlap with coins, power-up on an obstacle lane → spawner keeps one lethal-free path and offsets coins/power-ups.

## Out of scope

- New music composition, multiplayer, online leaderboards, daily missions, climbing onto vans, additional worlds, haptics.
- Upgrading three.js past r147 (see `games/sunset-stride/CLAUDE.md`).
- Photoreal / high-polygon characters (no suitable CC0 rigged set; Mixamo-style assets cannot be redistributed in this repo). Carrying the old Neon Rush outfits over (the characters changed completely; only coins, best score and mute are imported — recorded in `docs/DECISIONS.md`).

## Non-functional requirements

- **Accuracy:** deterministic fixed-step sim; collision spec table is the single source of truth.
- **Risk:** no new network surface; assets same-origin; save data sanitised; no `innerHTML` with untrusted strings.
- **Compliance:** CC0 attributions (Quaternius, ambientCG, OGA track) in `assets/CREDITS.md`; no PII.
- **Quality:** four-tier comments on new modules; fallbacks documented in the game-local `CLAUDE.md`.
- **Performance:** 60 fps target on a mid phone (medium tier), draw-call budget high ≤ 170 / low ≤ 110, textures 512 px.
- **Verified by / NOT verified (stated so nobody has to guess):**
  - _Verified (headless, software GL):_ draw-call and triangle budgets, animation weights, chase rules, persistence, fallbacks, particle / audio **triggers**, brightness of the frame.
  - _Not verified:_ 60 fps on a real phone (software GL cannot say; tiers + auto-downgrade exist, a handset check is in `docs/IDEAS.md`); how the audio **sounds**; how the motion **feels**; first-run load time on a slow network. Payload is ≈ 3.5 MB (`music.ogg` ≈ 1.1 MB, `runner.glb` ≈ 0.67 MB, `three.min.js` ≈ 0.6 MB); models that finish downloading after a run has started apply from the **next** run, so a very slow first visit can show the primitive fallbacks once.
  - _Known simplification:_ dog locomotion is the pack's `Walking` clip sped up (no run cycle exists in the CC0 dog), so legs read as a trot.
  - _Success metrics 1 and 3_ (first-run readability; seeing why a hit was fatal) are judged by the persona panel and screenshots only, not measured with real players.

## Tech Lead feasibility

**PROCEED_WITH_NOTES.** (1) Models from Quaternius ship as FBX, so they were converted to GLB once (three.js FBXLoader → GLTFExporter, clips trimmed) and the pipeline is recorded in `assets/CREDITS.md`. (2) The pack has no slide clip, so slide / stumble are hand-authored as a direction-based pose layer blended over the mixer — no bone-axis assumptions. (3) Photo textures cannot be uploaded to WebGL from `file://` in Chrome, so every texture has a procedural fallback. (4) The old game file is reworked in place (git rename) rather than a clean new file, keeping the proven loop / pause / audio / save modules.
