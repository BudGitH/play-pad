# Feature: Neon Rush — 3D endless runner (game #5)

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** APPROVED (plan approved by owner 2026-07-12)
**Owner:** @BudGitH
**Ticket:** PLAY-005
**Created:** 2026-07-12
**Feature tier:** Prototype

---

## What & why

- **What:** A solo 3-lane 3D endless runner ("Neon Rush") in a neon cyber city, rendered with Three.js. Auto-run with ramping speed; dodge barriers and trains; collect coins; a police drone chases for tension; crash → score screen; coins buy skins in a shop; everything persists in localStorage.
- **Why:** PlayPad's catalog is 2 multiplayer + 2 solo 2D games; a polished 3D arcade runner is the biggest "wow" unit of value for the solo personas (Maya/Dan) and the first game with progression/replay hooks (coins, skins, high score).

## Business requirements & success metrics

- **Business outcome:** PlayPad gains a flagship solo game with a persistent progression loop that makes players return.
- **Success metric:** A player can complete run → earn coins → buy a skin → see it in the next run, within one sitting; high score persists across visits.
- **Must-have business rules:**
  - Works online AND offline / from `file://` exactly like the existing games (owner decision 2026-07-12) → Three.js is vendored locally, no CDN, no network at runtime.
  - No backend; saves are device-local (localStorage), fail-soft in private mode.
  - Deployed CSP (`script-src 'self' 'unsafe-inline'`) stays untouched.

## Target personas & success bar

- **Personas served:** Maya (solo player), Dan (parent playing solo/with kids) — from `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** start a run within 2 taps from the game page, control it with arrows or swipes, crash, see score + coins, retry immediately.
- **Value (hard gate):** the run is genuinely fun — readable obstacles at speed, fair spawns (always a survivable path), tangible progression (coins → skins, high score).
- **High satisfaction (scored):** "one more run" pull — drone tension, power-up moments, juicy sound/visuals at 60fps on a mid-range device.

## Design routing

- UI surface? **yes** (new game page: setup/HUD/game-over/shop) · Reuse-only? **mostly** (MD3 chrome reused; the 3D canvas + neon HUD are game-specific like Claw Catch's cabinet) → **Path: lite** — checked against `DESIGN-SYSTEM.md`: MD3 tokens for all chrome, 48px targets, focus rings, reduced-motion support; the neon in-canvas look is game art, exempt like prior canvas games.

## Acceptance criteria

1. **Catalog:** Neon Rush card appears on the hub (registry entry, `status:"live"`); card links to `games/neon-rush/`.
2. **Core run:** 3 lanes; player auto-runs; speed ramps over time. Left/right arrow (or horizontal swipe ≥ ~30px) changes lane; Up/swipe-up jumps; Down/swipe-down slides (also cancels a jump into a fast-fall).
3. **Obstacles:** barriers (jump OR slide past — two heights), low trains (jump only), tall trains (change lane; passable with Super Sneakers jump). Spawn patterns always leave ≥1 survivable option.
4. **Collision:** hitting an obstacle ends the run unless Hoverboard is active (consumes it, brief invulnerability). Game-over screen shows score, coins this run, total coins, high score (with "new best" callout), Try Again, Shop, Change settings, ← PlayPad.
5. **Coins:** spawn in lane rows and jump arcs; collected on contact; +1 each; Coin Magnet bends nearby coins to the player.
6. **Power-ups (pickups, timed, HUD timers):** Coin Magnet, Super Sneakers (higher jump), Hoverboard (one free crash + visible shield shimmer). Active effects visibly rendered; HUD shows a draining timer per active power-up.
7. **Drone chaser:** police drone hovers behind the player; near-misses/hits pull it closer, clean running lets it fall back. Purely visual tension — it never ends the run.
8. **Shop:** 3 skins built from Three.js primitives — Urban Runner (default, owned), Neon Bot, Cyber Skater — with coin prices; buy (deducts coins) and equip; equipped skin used in runs.
9. **Persistence:** coins, unlocks, equipped skin, high score, mute persist in localStorage key `playpad.neonRush.v1`; corrupted/missing data falls back to defaults without crashing; private-mode (throwing storage) fails soft.
10. **HUD:** score (distance + coins), coin count, power-up timers, mute toggle, 48px quit button (verbatim PlayPad chrome).
11. **Look/perf:** low-poly neon (magenta/cyan emissive, fog, follow camera, simple shadows); object pools for obstacles/coins/particles; no per-frame allocations in the hot loop; `dpr` capped ≤2; pause when tab hidden; fixed-timestep update.
12. **A11y floor:** keyboard fully playable; visible focus; reduced-motion respected for chrome/decoration (JS-driven gameplay timing unaffected); status changes announced via a live region; colour never the only signal in chrome/HUD.
13. **Offline:** the page loads and plays from `file://` with no network (vendored `three.min.js`, classic script tag, `THREE` global).

## Labelled assumptions (build, don't stop)

- Drone is cosmetic only (spec: "visual tension only").
- Super Sneakers' higher jump is what clears tall trains.
- Hoverboard: consumed by one crash, otherwise expires with its timer.
- Swipe threshold ~30px; vertical swipe = jump/slide, horizontal = lane.
- Skin prices: Neon Bot 500, Cyber Skater 1200 coins.
- Power-up duration ~10s; spawn rarity tuned by feel.
- Score = distance metres + **5 score per coin** (`COIN_SCORE`); coins are also banked separately (+1 each) for the shop.

## Out of scope

- Missions/daily challenges, multiple environments, leaderboards, character animation rigs, audio files (all synth).

## v2 addendum (2026-07-12) — assets, animation, audio, instant start

Owner feedback after playing shipped v1 drove four changes (overrides the v1 "no audio files / synth only" rule):

- **AC-14 Instant start:** first run ≤~1.3s to control (3-2-1-GO at 300ms/step); **retries skip to a GO! flash** (≤~0.4s); **any tap/key skips** the countdown. _(Verified: 1.28s / 0.22s / 0.18s.)_
- **AC-15 Real 3D models:** the 3 skins are **CC0 animated GLB characters** (KayKit Rogue_Hooded=Urban, KayKit Knight=Skater on a primitive board, three.js RobotExpressive=Neon Bot) with skeletal **run / jump / slide(crouch)** via `AnimationMixer`. KayKit weapons hidden. Three.js pinned **r147** + vendored `GLTFLoader.js`.
- **AC-16 Real audio:** looping **synthwave music** (ansimuz CC0) + **Kenney CC0 SFX** (coin/jump/slide/crash/power/buy); mute-aware; visibility-pause. Drone stays synth.
- **AC-17 Textures:** procedural CanvasTextures — **lit-window building facades** + a **scrolling tech-road**.
- **AC-18 Graceful degradation (hard rule):** every asset has a fallback — primitive skins + synth voices fire automatically if a model/SFX fails to load. **`file://` caveat:** Chrome blocks `fetch` to `file://`, so a double-clicked page runs fallbacks (primitive models + synth SFX + real music); full assets need an http(s) origin (deployed site / any static server). Assets never block start.
- **AC-19 Licensing:** all assets CC0/free, listed in `games/neon-rush/assets/CREDITS.md` + a setup-screen credit line.

## Feasibility (Senior Tech Lead, advisory)

Feasible at Prototype tier. Risks: (1) UMD Three.js required for file:// — pinned r148, last UMD release; (2) perf on mobile — mitigated by pooling, InstancedMesh coins, dpr cap, one shadow caster; (3) rAF verification in headless preview — use screenshots + `window.__neon` hook per LEARNINGS. localStorage is a project first — wrap all access in try/catch and version the key.
