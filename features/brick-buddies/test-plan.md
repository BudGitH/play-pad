# Test Plan: Brick Buddies

> **Phase 2 of the workflow.** Tests define "done". Every acceptance criterion maps to at least one probe check.

**Feature:** Brick Buddies — 2D side-view pixel house & room builder
**Ticket:** PLAY-009
**Created:** 2026-11-22

---

## Coverage map (AC -> test)

All automated checks live in `features/brick-buddies/probe.mjs` (headless Chromium through Playwright, real keyboard / mouse / touch input; `window.__buddies.debug` is used only to build fixtures and read state).

| Acceptance criterion        | Probe check (id · what it does)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Type                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| AC-1 Contract               | `AC-1` hook exists, `phase` "title", one `Start building` button, click -> "playing", `frame` +15 in 600 ms                                                                                                                                                                                                                                                                                                                                                                                                                                                        | e2e                   |
| AC-2 Starter world          | `AC-2` >= 3 ladder shafts, >= 5 valid rooms, >= 20 lights of >= 4 kinds, coins > 0, player grounded                                                                                                                                                                                                                                                                                                                                                                                                                                                                | e2e                   |
| AC-3 Movement               | `AC-3` walk right, blocked by a 4-tall wall, jump height 1.5-3.2 tiles and lands, 1-tile ledge auto-step, ladder climb / hold / top-out. `AC-3` touch: hold D-pad, jump button, tap place, Break-mode tap                                                                                                                                                                                                                                                                                                                                                          | e2e (keyboard, touch) |
| AC-4 Place / break rules    | `AC-4` click place / right-click break, reach 9 tiles refused, inside the player refused, bed in mid-air refused, bed 2 tiles, door 2 tiles, break one half removes both, ghost green / red = `canPlace`, mined floor drops a chest, unlock red brick (-15 coins)                                                                                                                                                                                                                                                                                                  | e2e                   |
| AC-5 Room detection (pure)  | `AC-5` hand-made grids: closed + door (24 cells), open roof (no room), missing backing (`backed:false`), sealed (no entry), too big (`max` option), too small, ladder hatch splits into 2 valid rooms, a ladder inside a sealed room is NOT an entry (F-03), the world edge is a wall (F-10), a room open to a big sky is not a room, glass is a wall, 5 room types                                                                                                                                                                                                | unit (via debug hook) |
| AC-6 Request loop           | `AC-6` build a 6x3 bedroom on flattened ground: no bed -> not a Bedroom, checklist flags the bed, bed placed -> "Bedroom" detected live (18 cells), visitor arrives and walks in, torch broken mid-walk -> buddy turns back, repaired -> housed 1, +40 coins, stars, request 2 = Kitchen. `AC-6` path from the visitor spot to the basement workshop through the ladder hatch and a door                                                                                                                                                                           | e2e                   |
| AC-7 Persistence            | `AC-7` key `playpad.brickBuddies.v1`, `v:1`, numeric `bestOverall`, < 100 KB (about 5.4 KB measured), reload restores tile / coins / housed, 7 hostile saves ignored (Infinity, `__proto__`, bad version, junk, bad base64, out-of-range ids), minimal valid save keeps the record                                                                                                                                                                                                                                                                                 | e2e                   |
| AC-8 New world              | `AC-8` Menu -> New world asks; "Keep my world" changes nothing; "Yes, start fresh" resets tiles + coins + housed, keeps `bestOverall` and sound setting (also persisted)                                                                                                                                                                                                                                                                                                                                                                                           | e2e                   |
| AC-9 Lighting               | `AC-9` surface sky 1.0 vs cave 0.0; torch gives 0.69 / 0.52 / 0.00 (source / beside / far); recompute counter +1 on change and flat over 900 ms idle; breaking the torch removes its light; rain toggle                                                                                                                                                                                                                                                                                                                                                            | e2e                   |
| AC-10 Audio                 | `AC-10` no `AudioContext` before the first gesture, exists after Start, a placed block adds voices, title mute persists across reload, `N` toggles music. **Sound quality is manual.**                                                                                                                                                                                                                                                                                                                                                                             | e2e + manual          |
| AC-11 Accessibility         | `AC-11` every button / link named, Tab -> Start -> Enter, visible focus ring (>= 2 px), A / Space, aim cursor `C` `F` `X`, `9` `E` `Esc` flows, Space on a focused button toggles it without jumping, reduced-motion rain does not move (and does move normally)                                                                                                                                                                                                                                                                                                   | e2e                   |
| AC-12 Responsive            | `AC-12` x3 (390x844, 844x390, 1280x800): no horizontal scroll, Start visible without scrolling, every control >= 44x44, touch controls only on touch, HUD boxes < 60 % of the screen, DPR-aware canvas; plus rotation 390x844 -> 844x390 keeps the player in view; screenshots to `screens/`                                                                                                                                                                                                                                                                       | e2e                   |
| AC-13 Performance structure | `AC-13` still scene builds 0 chunks / 0 light passes / 0 room detections in 1 s; one edit rebuilds 1 chunk; canvas 2560x1600 at dpr 2; informational fps                                                                                                                                                                                                                                                                                                                                                                                                           | e2e                   |
| AC-14 Clean run             | `AC-14` aggregated over every page the probe opened: 0 console errors, 0 page errors, 0 failed requests, no fetch / xhr / media / font requests, a single origin                                                                                                                                                                                                                                                                                                                                                                                                   | e2e                   |
| AC-15 Pause on hidden       | `AC-15` fake `visibilitychange` -> `phase "paused"`, frame / world time / player position frozen for 600 ms; visible -> "playing"                                                                                                                                                                                                                                                                                                                                                                                                                                  | e2e                   |
| AC-17 Reading load          | `AC-17` the request rows each carry a non-blank icon canvas and read <= 36 characters; `canPlace` names the blocker ("A door / A piece of furniture / A block is in the way", "You are / Barnaby is standing there"); desktop title shows the keyboard hint incl. `I J K L` / `F` / `X`, a touch phone shows the touch hint; unlocking the Furnace takes the first empty slot and leaves slot 1 alone; with a full bar a further unlock keeps the bar and says "Select a slot"; the back chip leaves on one click (desktop) and needs two taps within 3 s on touch | e2e                   |
| AC-18 First-run path        | `AC-18` fresh world: the plot at x -16..-1 is flat, the tip names the hut, the authored recipe (roof, walls, 6x3 back wall, door, torch, bed) goes through `tryPlace` with zero refusals and Pip is housed (+40 coins). `AC-18` labels read "Kitchen · Barnaby" / "Workshop · Moss" / "· full"; standing in the claimed starter bedroom shows "already someone's home". `AC-18` (flow world, request 2 = Kitchen) the card says "Barnaby already lives here"                                                                                                       | e2e                   |
| AC-19 HUD stays clear       | `AC-19` x2 (390x844, 844x390 touch): card open at start, a real toast showing (empty-slot tap), no pairwise overlap among chips / card / toast / hotbar / mode buttons / pads, card bottom <= dock top, toast above the dock and inside the screen. `AC-12` also checks the card collapses after the first move on touch                                                                                                                                                                                                                                           | e2e                   |
| AC-20 Lived-in starter      | `AC-20` every one of the 8 starter rooms has >= 5 distinct furnishings (measured: fewest 6), >= 8 decor kinds exist, every tile in the world passes `supported()` (stacked cupboards / furnaces, the hanging sign)                                                                                                                                                                                                                                                                                                                                                 | e2e                   |
| AC-21 Stale tab             | `AC-21` two tabs: the stale one shows `#stale` with "Reload now", Start is disabled, the banner outlives the old 2.8 s toast, is announced again on `visibilitychange` -> visible, and Reload now recovers                                                                                                                                                                                                                                                                                                                                                         | e2e                   |
| AC-16 Fidelity              | **Manual** — `screens/*.jpg` read next to the reference; log in `design-review.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual                |

## QA round 1 regression checks (one per fix)

| Finding                                                                                    | Probe check                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 request chain restarted at Bedroom on reload                                          | `AC-7` after the AC-6 house-warming, reload shows `request.index === 1`; `AC-8` New world resets it to 0                                 |
| F-02 starter rooms could be "re-housed" by editing one cell (coin / badge farming)         | `AC-6` F-02: a block on the room's first cell leaves the kitchen occupied; filling the room in drops its claims; the emptied room is new |
| F-03 a ladder inside a sealed room counted as an entry                                     | `AC-5` grid with a 3-high ladder in a sealed room: `hatches 0`, invalid                                                                  |
| F-04 saved in a doorway -> reload on the roof                                              | `AC-4` F-04: stand in a door, save, reload, same `y`                                                                                     |
| F-05 jumping out of the top of the world                                                   | `AC-3` F-05: jump from a row-3 platform, lowest feet y >= 1.84                                                                           |
| F-06 / F-07 doors never dropped; furniture could stand on a closed door                    | `AC-4` F-06/F-07: chest on a door is refused; mining the floor removes the door                                                          |
| F-08 held mouse button kept editing while paused                                           | `AC-4` F-08: button held, Esc, drag over a free tile: nothing placed                                                                     |
| F-09 door open / close recomputed light (flaky AC-13)                                      | `AC-13` F-09: walk through a door: 0 light passes, 0 room detections                                                                     |
| F-10 world edge counted as open                                                            | `AC-5` room against the grid edge is enclosed; hole at the edge is not a sky leak                                                        |
| F-11 grass tufts floated when the ground was mined                                         | `AC-4` F-11                                                                                                                              |
| F-12 move-in toast named the room's first type, not the request                            | `AC-6` the bedroom is also a Library; the toast says "moved into the Bedroom"                                                            |
| F-13 a stale second tab overwrote newer progress                                           | `AC-7` F-13: two tabs; B is told "updated in another tab", `save()` returns -2, A's data intact                                          |
| F-14 unbounded glow sprites                                                                | `AC-13` F-14: 480 torches in view, 256 glows drawn                                                                                       |
| C-01 canvas was the first Tab stop on the title                                            | `AC-11`: Start has focus on load, canvas `tabIndex -1`, Tab never lands on it                                                            |
| C-02 invalid ghost was colour-only                                                         | `AC-4`: `aim.mark === "x"` for an invalid ghost                                                                                          |
| C-04 / C-05 / C-06 48px HUD, names start with visible text, pressed-state category buttons | `AC-12` (48px, title back link >= 48), `AC-11` (name check, no `role=tab`)                                                               |
| C-07 320px phone                                                                           | `AC-12` C-07: all pad / mode buttons inside 320px                                                                                        |
| NEW-2 hotbar slots and 320px pad buttons were 44px                                         | `AC-12` x3: every control (slots included) >= 48px; `AC-12` C-07 at 320px                                                                |
| NEW-3 starter stacked furniture and the sign failed the shared support rule                | `AC-20`: every world tile passes `supported()`                                                                                           |
| NEW-4 the canvas ring showed after any key                                                 | `AC-11`: no ring after WASD; ring after Tab / Shift+Tab; gone after the next move key                                                    |
| NEW-5 an occupied matching room gave no reason                                             | `AC-18`: names the resident (request 2, Kitchen) or says "already someone's home" (request 1, Bedroom)                                   |
| NEW-6 the probe overwrote the committed screenshots                                        | screenshots go to a temp folder unless `SHOTS=1`                                                                                         |

C-03 (label contrast: text at full opacity on an 80%-opaque pill) is a code-level fix verified by inspection of `pill()` and the screenshots.

## Test cases

### Happy path

- [x] Title -> Start building -> walk, jump, climb, place, break, build a bedroom, buddy moves in, next request arrives.
- [x] Reload continues the same world; menu New world starts a fresh one and keeps the record.
- [x] Touch: D-pad hold, jump button, tap place, Break mode.

### Edge cases (boundaries)

- [x] Room of exactly 24 cells valid; `max` 20 -> too big; 4 cells -> too small; 18-cell player bedroom accepted for a 6-cell request.
- [x] Ladder hatch (solid on both sides) closes a room like a trapdoor; a ladder in the middle of a room does not.
- [x] Glass counts as a wall; a missing single back-wall tile invalidates the room.
- [x] One-tile ledge auto-step; 4-tall wall blocks; ladder top is a platform (stand on it, walk off).
- [x] Torch broken while the buddy walks -> the buddy turns back and the request stays open; repair -> completes.
- [x] Placing inside the player, out of reach, mid-air furniture, removing a floor under furniture.
- [x] Space on a focused button activates it and does not jump (global key handler bails).

### Error paths

- [x] Corrupt / hostile saves (`1e999` -> Infinity, `__proto__`, wrong version, non-JSON, bad base64, out-of-range ids) -> fresh world, no console error, no prototype pollution.
- [x] Locked item with too few coins -> toast + error blip (no state change).
- [x] No `AudioContext` before a gesture; hidden tab suspends audio.

### Non-functional checks

- [x] **Accuracy:** room flood fill is a pure function tested on hand-made grids; coins / housed are clamped integers; the save round-trips tiles, coins, housed, unlocks, hotbar.
- [x] **Risk:** save gateway copies fields individually onto defaults, clamps numbers, allow-lists ids, length-checks base64; `textContent` only; nothing fetched (AC-14).
- [x] **Compliance:** no PII; nothing logged; all art procedural, all sound synthesised (original, licence-clean).
- [ ] **Manual only (cannot be proven headless):** how the audio sounds and is balanced; real-device feel of touch controls and pinch zoom; real-GPU frame rate; the art-director read of fidelity.

## How to run

```
# from the repo root; the probe starts `node tools/serve.mjs 5602` itself if nothing listens on 5602
export PW_CHROMIUM_PATH=/path/to/chromium     # only if the repo's Playwright build is not installed
node features/brick-buddies/probe.mjs         # all checks, ~4 minutes, screenshots to a temp folder (SHOTS_DIR to choose)
SHOTS=1 node features/brick-buddies/probe.mjs # the same, and refresh the committed features/brick-buddies/screens/
ONLY=AC-5,AC-9 node features/brick-buddies/probe.mjs   # a subset (AC-7 / AC-8 reuse the AC-6 world, run them together)
```

Result of the last full run: see the report (the probe is deterministic: three consecutive full runs were green).

## Definition of done

- [x] All probe checks above pass.
- [x] Every acceptance criterion in `requirements.md` is covered (AC-16 is manual by design).
- [x] The full design path ran: the reference image is the chosen option (`design-review.md`).
- [ ] `qa-report.md` clean — the QA panel (Phase 4) is run by the orchestrator, not by this implementer.

> The full release checklist is the **Definition of Done** in `docs/WORKFLOW.md` (Phase 6).
