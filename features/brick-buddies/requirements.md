# Feature: Brick Buddies — 2D side-view pixel house & room builder

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** IMPLEMENTED (AC-1..15 proven by `probe.mjs`, AC-16 owner-judged); was APPROVED — owner brief 2026-11-22 (reference image supplied; renamed from "Block Haven" to "Brick Buddies" the same day)
**Owner:** @BudGitH
**Ticket:** PLAY-009
**Created:** 2026-11-22
**Feature tier:** Standard (project tier; public open-source)

---

## What & why

- **What:** a solo, side-on pixel **house and room builder**. The player starts in a furnished multi-storey starter house on a rainy, torch-lit hillside, and builds rooms (walls, floor, ceiling, background walls, a door, light, furniture) that new "buddies" (villagers) ask for. A finished room makes the buddy move in, pays coins that unlock fancier blocks, and the next, bigger request arrives.
- **Why:** the owner supplied a reference screenshot of a moody, torch-lit, rainy cross-section of a brick-and-plank house and wants **design fidelity** to it ("I do not accept less"). The catalog has no building / sandbox game; the solo-playable gap (see `docs/LEARNINGS.md`, product / UX row) is the next unit of value.

## Business requirements & success metrics

- **Business outcome:** PlayPad gains a distinctive, cosy, replayable solo game whose look alone makes a visitor stop on the hub card and press play; progress persists so players return.
- **Success metrics:** (1) first-time player completes request 1 (a cosy bedroom) within ~3 minutes without reading anything outside the game; (2) the first screen is recognisably the reference (brick + plank tower, dark back-walls, warm light pools, rain, ladders, furniture); (3) hub "Housed N" badge shows after the first buddy moves in (`bestOverall`).
- **Must-have business rules:**
  - Static, build-free, works from `file://`; **no fetch, no external files, no audio files** — all art is drawn in code, all sound is synthesised.
  - **Original art only**: no textures, names or characters copied from any other game; 16x16 textures are generated procedurally with a fixed seeded RNG.
  - Save is one versioned key `playpad.brickBuddies.v1`, validated as untrusted input, < ~100 KB, with a top-level numeric `bestOverall` for the hub badge.

## Target personas & success bar

- **Personas served:** Maya "Commuter Casual" (phone, one-handed bursts, touch controls), Dan "Office Micro-breaker" (desktop, mouse + keyboard, short sessions), Sam "Keyboard / AT user" (keyboard-only building, labels, focus, reduced motion) — from `docs/PRODUCT-PANEL.md`.
- **Baseline (hard gate):** Maya can start in one tap, walk, jump, climb, place and break blocks on a phone; Dan can do the same with mouse + keyboard; Sam can do all of it with the keyboard alone (aim cursor + place / break keys).
- **Value (hard gate):** the room-request loop gives a clear goal and visible feedback (checklist, ghost preview, room outline + label, celebration); it is more engaging than an empty sandbox.
- **High satisfaction (scored, not gated):** atmosphere (rain, light pools, music, sound), the starter house to explore, unlocks, "one more room".

## Design routing

- UI surface? **yes** · Reuse-only? **no** · Tier **Standard** → **Path: full** (`docs/WORKFLOW.md` Phase 1b). The owner's reference image **is** the chosen design direction, so the four-option `mockups.html` is replaced by the record in `design-review.md`.
- **Crosses FE/BE seam?** **no** (no backend).

## Design review

See `design-review.md` (reference image = chosen direction; fidelity loop with rendered screenshots is the record).

## User-visible behaviour

1. **Title:** the live (paused) rainy house scene behind a card with "Brick Buddies", a one-line pitch and a **Start building** button (also continues a saved world), a sound toggle, and a note when a save exists.
2. **World:** side-on tile world, ~176x84. A starter house (roof tower with 3 storeys above ground, basement rooms, ladder shafts, furnished rooms, a portal, a hanging sign, brick steps) on grass / dirt / stone terrain. Dark plank background walls, warm light pools, grey rainy sky with diagonal rain streaks, distant blocky hills, day / night cycle.
3. **Moving:** walk, jump, climb ladders (auto-step up 1-tile ledges), smooth camera, two-tile-tall blocky characters; footsteps differ by surface.
4. **Building:** hotbar + Build menu (Structure / Furniture / Light) with coin-gated unlocks; left-click / tap places, right-click / Break mode mines; ghost preview green (valid) / red (invalid) for multi-tile items; reach radius; keyboard aim cursor.
5. **Rooms:** enclosed + fully back-walled + door/hatch + size-limited regions are detected live, outlined and labelled (Bedroom / Kitchen / Library / Workshop / Greenhouse). A checklist shows what the current region is missing.
6. **Requests:** a buddy arrives with a request; build it and the buddy walks in (confetti, chime, coins, stars, "Housed" +1); the next request is bigger. Starter rooms are pre-occupied so the player builds new ones.
7. **Persistence:** automatic save; "New world" (confirm) resets the world but keeps `bestOverall` and sound settings.

## Acceptance criteria

> Each is checked by `features/brick-buddies/probe.mjs` (see `test-plan.md` for the mapping) unless marked (manual).

- [x] **AC-1 Contract:** on load `window.__buddies` exists with live getters `phase`, `frame`, `coins`, `housed`; `phase === "title"` before start; a button with accessible name exactly `Start building` exists; clicking it makes `phase === "playing"` and `frame` increases every rendered frame.
- [x] **AC-2 Starter world:** after start the world contains a multi-storey house: at least 3 ladder shafts, at least 5 detected valid rooms, at least 20 light sources of at least 4 emitter kinds (torch, lantern, furnace, portal); coins > 0; the player stands on solid ground.
- [x] **AC-3 Movement:** holding right moves the player right; blocked by a solid wall (cannot enter it); jump raises then returns to ground; climbing a ladder with Up raises the player; a 1-tile ledge is auto-stepped.
- [x] **AC-4 Place / break rules:** placing a block through the real input path changes the tile and breaking removes it; out-of-reach placement is refused; placement inside the player is refused; furniture without a solid floor is refused; a bed occupies two tiles and a door two tiles; breaking one half removes both; the ghost validity matches `canPlace`.
- [x] **AC-5 Room detection (pure function):** hand-made grids — open room (not valid), closed room backed by walls with a door (valid, correct size), missing background wall (invalid, `backed:false`), too big (invalid), too small (invalid), ladder hatch does not leak a floor, types derived from contents (Bedroom / Kitchen / Library / Workshop / Greenhouse).
- [x] **AC-6 Request loop:** building a valid bedroom (walls, backing, door, torch, bed) is detected live as "Bedroom", the buddy moves in, `housed` increments to 1, coins increase by the reward, and request 2 appears.
- [x] **AC-7 Persistence:** the key `playpad.brickBuddies.v1` is written (JSON, `v:1`, numeric top-level `bestOverall`, < 100 KB); after a reload the edited tiles, coins and housed count are restored; a corrupt / hostile save (`"1e999"`, wrong shape, bad base64, `__proto__`) is ignored without errors.
- [x] **AC-8 New world:** the New world action asks for confirmation; confirming resets tiles and coins but keeps `bestOverall` and sound settings; cancelling changes nothing.
- [x] **AC-9 Lighting:** a torch lights its surroundings (light map value near a placed torch > far from it); underground without light is darker than the lit surface; breaking the torch removes its light; lighting is recomputed on change, not every frame (counter stays flat while idle).
- [x] **AC-10 Audio:** no `AudioContext` exists before the first gesture; after Start it exists; the mute toggle persists across reload; a placed block triggers an SFX voice (counter); music can be toggled. (Whether it sounds good is manual.)
- [x] **AC-11 Accessibility:** every button has an accessible name; the game is fully operable by keyboard (move, jump, hotbar keys, aim cursor + place + break, build menu, pause); focus ring visible; with `prefers-reduced-motion` the rain does not animate and camera shake is 0; Space / Enter on a focused button activates it instead of jumping.
- [x] **AC-12 Responsive:** at 390x844, 844x390 and 1280x800 there is no horizontal scroll; touch controls show on touch devices; every control is at least 44x44 css px; the HUD does not cover the whole play field.
- [x] **AC-13 Performance structure:** chunk canvases are cached (a still frame builds 0 chunks); chunks rebuild only when dirty; light recompute counter flat when idle; DPR-aware canvas size.
- [x] **AC-14 Clean run:** no console errors / page errors, no failed or non-data network requests during a full probe run (start, play, build, request, reload); nothing is fetched.
- [x] **AC-15 Pause on hidden:** a `visibilitychange` to hidden sets `phase === "paused"` and stops simulation (frame and world time stop); returning visible resumes.
- [ ] **AC-16 Fidelity (manual, owner-judged):** screenshots at 1280x800 and 390x844 read as the reference: warm planks / red brick, dark back-walls, light pools, rain, grey sky, furnished rooms, ladders, portal, sign, ~2-tile characters, ~32-40 css px blocks. Recorded in `design-review.md`.

## Edge cases & error states

- Save missing / corrupt / wrong version / wrong world size -> fresh world, no console error.
- `localStorage` throws (private mode) -> game plays, nothing persists, no error.
- Placing on world edges, above row 0, on the bedrock rows; breaking bedrock refused.
- Removing a floor under furniture / a ceiling above a lantern drops the dependent item.
- A request room broken while the buddy is walking to it -> the buddy turns back; the request stays open.
- Pathfinding fails -> the buddy "poofs" into the room (never blocks the request).
- Phone rotation mid-play -> layout recomputed, camera kept on the player.
- Tab hidden during play -> paused, audio suspended, world flushed to storage.

## Out of scope

- Multiplayer, enemies / combat, crafting recipes, fluids, multiple worlds, mod support, real inventories (creative-infinite blocks; only coin-gated unlocks).
- Copying any existing game's art / audio / names.

## Non-functional requirements

- **Accuracy:** room flood fill is deterministic and pure; coin / housed counters never negative or non-finite; save round-trips exactly.
- **Risk/Security:** `localStorage` is untrusted input — one versioned gateway, whole-load try/catch, copy fields individually onto defaults, clamp numbers, allow-list ids, base64 length-checked; no `innerHTML` with dynamic strings (`textContent` only); no network.
- **Compliance:** no PII; nothing logged; licence-clean (all original, procedurally generated art and synthesised audio).
- **Quality:** 60 fps target — chunk cache, dirty-chunk rebuild, lighting on change, only visible tiles drawn, DPR capped at 2; follows `docs/CODE_QUALITY.md` (section banners, why-comments).

## Tech Lead feasibility

- **Verdict:** PROCEED_WITH_NOTES — one self-contained HTML file with inline CSS + JS fits the project norm (`file://`, no assets). Notes: (1) keep light propagation incremental-by-recompute (whole-world BFS is ~ms at 176x84, fine); (2) run room detection debounced after edits, not per frame; (3) audio only after the first gesture and suspended on hidden; (4) the starter blueprint is the largest authoring cost — build it with helper calls, not a giant literal. Effort: large (largest PlayPad game by line count).
