# Design spec — Claw Catch revamp (PLAY-006)

**Owner area:** `games/claw-catch/index.html` only (the shared `styles/*` are not touched; every style fix stays in the game file).
**Author:** game-design panel (playability + visual) · **Date:** 2026-11-21 · **Status:** ready for build.
**Personas:** Solo Sam (primary, desktop + phone), Kid Pilot (secondary, tablet/phone, imprecise touch).
**Evidence:** screenshots in the session scratchpad `design-claw/` (`round-*`, `play-1280x720-*`, `rotate-844.png`, `results-1280x720.png`). They were captured with Playwright and a bot that aimed at the top prize each time.

---

## 1. Findings

### 1a. Bugs and display quirks (evidence)

| #   | Finding | Viewport / steps | Evidence |
| --- | ------- | ---------------- | -------- |
| B1  | **Rotation and resize break the pile.** `layout()` rescales `prizeR` and the tray, but each prize keeps its old `x` and `rad`. After portrait → landscape, 9 oversized prizes stand in a tower on the left (y up to 73px, past the rail), cover the HUD and claw, and leave the right two-thirds of the tray empty. | 390×844 → start → rotate to 844×390 | `rotate-844.png`; bin ys `[146,216,…,73,81]` |
| B2  | **"Floating prize" (the reported 1280×720 bug) is the refill.** `makePrize(x,false)` spawns the new prize out of nothing at `railY+rad+12` (y≈110) at a random x, sometimes right through the claw cable, and it falls for ~0.55s. It has no source, no sound and no landing cue, so a still frame shows a prize hanging in mid-air. | 1280×720, any round, every `refillMs` | `play-1280x720-0.png` (turtle under the rail); trace: y 113→384 over 520ms |
| B3  | **HUD covers the rail and trolley** on short stages (`railY = max(40, H*.11)` ignores the 56px HUD pill). | 844×390 (stage 272px); the HUD's bottom edge also touches the rail at 360×740 | `round-844x390.png` |
| B4  | **The claw passes through prizes.** `lDrop` is a fixed depth, so the prongs sink into the heap and are drawn over the capsules. Nothing in the pile reacts to the claw. | any | `play-1280x720-2.png` |
| B5  | **Enter on a focused DROP button does nothing.** It only binds `pointerdown`, so the phase stays `idle`. Space works only because a global handler catches it. | keyboard, Tab to DROP, Enter | probe: `phaseAfterEnterOnGrab: idle` |
| B6  | **Light-mode deck clashes with the cabinet.** The deck uses `surface-container`, which renders as a pale pink panel under a dark arcade cabinet. The two halves look like separate apps. | any viewport with the light OS theme | all `round-*` |
| B7  | **HUD and feedback text wrap at 360px.** "Score / 0" breaks onto two lines and the feedback chip is 4 lines tall. | 360×740 | `round-360x740.png` |
| B8  | **The round keeps running in the background.** The clock is wall-time (`sessionEndTs`), so switching apps on a phone costs time or ends the round. | phone app switch | code: `loop()` |
| B9  | **Teardown is not in `show()`.** It lives in `endGame` and `stopToSetup`, which breaks the LEARNINGS rule (PLAY-002 rev2). Any new exit path can leave the RAF loop, countdown or key panel running. | code review | `show()` ~L1144 |
| B10 | **`__claw.forcePrizeUnderTip` builds a prize with no `rad` or `vx`.** The physics then produces `NaN`, so deterministic catch tests silently corrupt the pile. | test helper | code ~L2506 |

No console or page errors and no horizontal overflow at 360×740, 390×844, 844×390, 768×1024 or 1366×800.

### 1b. Measured play (bot aims perfectly at the topmost prize, 56s rounds)

| Run              | Drops | Caught | Score | Lost mid-carry |
| ---------------- | ----- | ------ | ----- | -------------- |
| 1280×720 Normal  | 14    | 11     | 17    | 2 of 13 grabs  |
| 390×844 Tricky   | 21    | 8      | 14    | **5 of 13 grabs (38%)** |
| 1366×800 Chill   | 12    | 9      | 19    | 0              |

Even with perfect aim, Tricky loses 38% of successful grabs to a random `dropChance` that the player cannot influence. On wide desktops a round allows only about 12 drops, because the trolley moves at a fixed 540px/s across a 1200px rail and every catch ends at the far-left chute.

### 1c. Why it isn't fun yet

1. **It doesn't read as a claw machine.** It's a flat gradient with a thin row of 7–10 capsules. There's no cabinet frame, no glass, no lights and no prize mountain. About 60% of the stage is empty (`round-768x1024.png`, `round-1366x800.png`), and the chute is a label stuck onto the side of the box.
2. **Outcomes feel random, not earned.** Aim matters for the grab roll, but slips and mid-carry drops are flat dice rolls. Kid Pilot can't tell what "lined up" means, because the game gives no aim cue.
3. **There's little payoff.** A catch gets one small "+N" at the chute and a beep. There are no streaks, no special prizes, no saved best score, and the results screen is three numbers on a blank page.
4. **There's dead time.** The 2.4s countdown plays on every retry, the trolley is slow on desktop, and the long return trip happens every time.

---

## 2. Decisions

### P0 — bugs and layout (must ship)

- **P0-1 Resolution-independent pile (B1).** Store each prize in normalised tray space: `nx∈[0,1]` across the tray and `radK = rad/prizeR`. On every `layout()`, recompute `x = binLeft + nx*(binRight-binLeft)`, `rad = radK*prizeR`, put `y` at the floor minus `rad` plus its stack order, and let the pile physics re-settle over about 300ms. When the cap shrinks (P1-2), remove the extra prizes from the top of the pile; never let them overflow.
- **P0-2 Refill from a visible hopper (B2).** Draw a **hopper pipe** in the top-right corner of the interior. Refill prizes come out of its mouth (`x = binRight - 1.2*prizeR`, `y = hopperMouthY`) with `vx = -(140..220)` px/s and a short "clunk" (square wave, 160Hz, 60ms). The hopper flap flashes for 150ms. Never spawn inside the claw's column (`|x - cartX| < grabRadius`).
- **P0-3 Measure the HUD for the rail (B3).** Compute `railY = hudRect.bottom - stageRect.top + 14` (minimum 40) every layout. On short-landscape screens, use the compact HUD (P0-6) so the rail sits at ≤ 64px.
- **P0-4 Claw stops on the pile (B4).** During DROP, the target depth is `min(lDrop, topOfPileUnderClaw - clawTipOffset)`. `topOfPileUnderClaw` is the smallest `y - rad` among prizes within `0.6*grabRadius` of the claw x. The claw eases to that depth (same `DROP_MS`) and stops with a 2px "thunk" dip. On CLOSE, every non-chosen prize within `grabRadius` gets an outward nudge (`vx ±120`, `vy -60`) so the prongs visibly shove the heap.
- **P0-5 Keyboard grab (B5).** Add a `click` listener on `#grabBtn` that calls `requestGrab()` when `ev.detail === 0` (keyboard Enter/Space). Keep the existing `pointerdown` for instant touch.
- **P0-6 One dark arcade surface plus responsive deck (B6, B7).**
  - Scope dark MD3 values onto `#game` inside the game `<style>`: copy the dark-default `--md-sys-color-*` values from `tokens.css` into a `#game{…}` block and add `color-scheme: dark`. The deck then always matches the cabinet. Setup and results still follow the OS theme.
  - Add `white-space: nowrap` to `#hud`. Below 400px wide, hide `#feedback small` so the chip stays 1–2 lines.
  - **Short landscape** (`@media (orientation: landscape) and (max-height: 500px)`): drop the deck row. The stage fills the full height, and the joystick (bottom-left) and DROP (bottom-right) float in the side gutters outside the cabinet (P1-1 caps the cabinet's aspect ratio, so the gutters are ≥ 96px at 844×390). Feedback becomes a toast inside the canvas, top-centre under the HUD. The HUD is compact (36px buttons inside 48px hit areas, so it stays at 48px).
- **P0-7 Pause when hidden (B8).** On `visibilitychange` → hidden, set `pausedAt = now`. On visible, add `now - pausedAt` to `sessionEndTs`, `nextRefillTs`, `phaseStartTs` and the golden timer. If the page was hidden during the countdown, restart it.
- **P0-8 Teardown in `show()` (B9).** When `show(s)` leaves `"game"`, it stops everything: `running=false`, cancel the RAF, hide `#countdown`, close `#keyPanel`, reset the joystick and keys, set `carried=null`, and clear any pending `setTimeout`. `endGame` and `stopToSetup` keep only their own logic.
- **P0-9 Fix `forcePrizeUnderTip` (B10).** Build the prize through the same `makePrize` factory, then override `x`, `e`, `r` and `grip`.

### P1 — core feel: make it a real claw machine

- **P1-1 The cabinet.** Draw a centred cabinet with width `cabW = min(stageW - 16, stageH * 1.7)`. On wide desktops and in landscape the rest of the stage is an arcade backdrop: dark gradient plus a soft floor glow in the theme colour. That removes the "huge green box" look. Layers, back to front:
  1. **Back wall:** `--claw-wall`, with faint vertical panel seams (alpha .06) and a soft spotlight cone (radial gradient, alpha .18) from each top corner. Build these once per layout on an offscreen canvas.
  2. **Marquee:** a 28–40px strip above the rail with the theme name in a 800-weight font, plus a row of **bulbs** (8px dots every 22px, `#ffd27a`). Under normal motion the bulbs chase one step every 120ms; under reduced motion they stay on.
  3. **Rail** and the trolley with a mounting plate.
  4. **Prize pile** (P1-2).
  5. **Glass:** two thin diagonal reflection streaks (alpha ≤ .07), clipped to the region **above** the pile top. LEARNINGS rev3 warns that translucent paint over prizes washes them out.
  6. **Frame:** a 10–14px bezel in `--claw-frame` with a 2px `--claw-frame-hi` inner highlight and rounded corners (`--md-sys-shape-corner-lg`).
  7. **Front lip:** an opaque ledge that covers the bottom ~0.35·prizeR of the pile, so the prizes sit *inside* the machine.
- **P1-2 A heaped prize mountain.**
  - Prize radius: `prizeR = clamp(min(cabW*0.05, stageH*0.07), 20, 44)`.
  - Cap: `binCap` = `capacityRows × perRow`, where `perRow = floor(trayW / (2*prizeR*0.92))` and `capacityRows` is 2.6 on Chill, 2.3 on Normal and 2.0 on Tricky. Clamp the result to 12–36. Expected: about 18 at 360×740 and 30–34 at 1366×800.
  - **The pile is mounded.** At round start, place 85% of the cap in a heap shape: rows bottom-up, each row inset 0.5·prizeR. Then let the physics settle for 400ms before the countdown ends.
  - Refill every `refillMs` (Chill 2200 / Normal 2800 / Tricky 3600). When the pile is below 50% of the cap, the hopper drops a **burst of 3** prizes 180ms apart.
  - Raise `PILE_SEPARATION_PASSES` to 3. The O(n²) cost at n=36 is about 1.9k pair checks per substep, which is fine.
- **P1-3 Tumble and settle.**
  - Each prize gets a `rot` and an `av` (angular velocity). `av` blends toward `vx/rad` while touching the floor or another prize, decays at 4/s, and the sprite is drawn rotated.
  - A landing with `|vy| > 400` plays a soft tick (triangle wave, 520Hz, 25ms; throttled to one every 80ms) and spawns a 3-particle dust puff in theme-light, alpha .5.
  - Floor bounce: `PILE_FLOOR_DAMP 0.35`. Gravity: `PILE_GRAVITY 2200`.
- **P1-4 Grip feedback.** On CLOSE:
  - **Caught:** the prongs clamp and a short "clack" plays (square wave, 300→180Hz, 70ms). A white ring pulse expands from the prize (radius ×1.0→1.4 over 240ms). The canvas toast reads **"Got it!"**.
  - **Miss:** the prongs close on air, the claw does a 2-frame wiggle, and a dull thud plays (sine wave, 110Hz, 90ms).
  - **While carrying:** keep the existing bob, sway and lurch. Add a **grip meter**, a 3-segment arc over the claw cap: 3 segments when the drop risk is 0, 2 when the risk is low, 1 when it's high. The mid-carry drop is then foreshadowed instead of random-feeling.
- **P1-5 An integrated chute.** The left `chuteW` of the cabinet becomes a **prize bay**: a glass divider wall `--claw-frame-hi` at alpha .5 rising 2.2·prizeR above the floor, and a dark hole in the floor with a lit rim in `--md-sys-color-tertiary`. Below the glass, on the front lip, a lit **"PRIZE ▾"** door plate shows the count. Remove the floating "PRIZES" chip. When a prize drops in, the rim flashes for 200ms and the door plate bumps (scale 1→1.12→1, 220ms).
- **P1-6 Pacing.**
  - `MAX_CART_SPEED = clamp(cabW*0.62, 320, 760)` px/s.
  - `RETURN_SPEED = clamp(cabW*1.1, 600, 1300)`, `RELEASE_MS 420`, `LIFT_MS 600`. Keep `DROP_MS 680` and `CLOSE_MS 340`.
  - **The countdown plays only on the first round of a session.** "Play again" shows a 600ms "GO" only (LEARNINGS PLAY-005 v2).

### P2 — fun systems (chosen for a 30–120s round, kept lean)

**Chosen:** aim assist, a skill-based grip, streaks, a golden prize that also adds time, the two-prize bonus, a reward screen and a saved best score. **Rejected:** separate timer pickups (folded into the golden prize), power-ups and shops (bloat for a 1-minute round), and multiple claw types.

- **P2-1 Aim assist (Kid Pilot).**
  - While idle, draw a dashed drop line (2px, alpha .35) from the claw to the pile top, and a **target ring** on the prize `resolveGrab` would pick.
  - Ring colour depends on proximity: `prox ≥ 0.75` → **sweet spot** `--claw-sweet` (#7cffb2) with a 1.15× pulse; `0.35–0.75` → white at .6; `< 0.35` → white at .3.
  - On Tricky, show only the line; hide the ring.
  - The toast hint becomes "Green ring = best grab!" for the first 2 drops of a session.
- **P2-2 Skill-based grip (replaces the flat dice rolls).** `prox = 1 - |dx|/grabRadius`. Expose all of it as a pure `catchOdds(prize, prox, diff)` function:
  - `grab = (0.40 + 0.60·prox) · grip[r] · gripMul`, capped at 0.97.
  - `slip = slipChance · (1 - prox)`.
  - `midDrop = r === 1 ? 0 : dropChance · (1.15 - prox)`, so a centred common prize never drops mid-carry.
  - Grip by rarity: ★ .95 · ★★ .80 · ★★★ .62 · golden .70.
  - Difficulty table:

    | Difficulty | `grabRadiusMul` | `gripMul` | `slipChance` | `dropChance` |
    | ---------- | --------------- | --------- | ------------ | ------------ |
    | Chill      | 1.40            | 1.15      | .02          | .05          |
    | Normal     | 1.00            | 1.00      | .05          | .12          |
    | Tricky     | 0.80            | 0.86      | .10          | .24          |

  - Target end-to-end success (grab × no slip × no mid-drop), for a common prize at the sweet spot: Chill ≥ 90%, Normal ≥ 80%, Tricky ≥ 60%. For a rare prize at `prox` 0.4 on Normal: about 30–40%.
- **P2-3 Streak multiplier.**
  - Each consecutive banked catch adds 1 to `streak`. An empty grab, a slip or a mid-drop resets it to 0.
  - Multiplier: ×1 normally, **×2 from the 3rd** consecutive catch, **×3 from the 6th**. It applies to base points.
  - A HUD chip ("🔥×2", tertiary container) appears from streak 2 ("1 more for ×2!" in the toast). It pops in at a scale of 1.2 and pulses each time the multiplier goes up.
  - Sound: a rising arpeggio at each multiplier step. When a streak of 3 or more breaks, the toast reads "Streak lost" in a neutral tone; never in error red.
  - The prize key gets one line: "Catch in a row: ×2 from 3, ×3 from 6".
- **P2-4 Golden prize, which adds time.**
  - If none is present, one spawns from the hopper every 22s on Chill, 25s on Normal and 30s on Tricky. The first one comes at 15s.
  - It's a theme emoji on a gold capsule sprite (radial gradient #fff3c4 → #f4c26b → #c98a1b) with a 4-point glint sparkle every 1.5s (static under reduced motion). It's worth **10 pts** with grip .70.
  - Banking it adds **+5s** to the clock, capped at +20s per round. The clock flashes tertiary and the toast shows "+5s!".
  - Only one golden prize exists at a time, and it never sinks below the pile's top layer: if it's buried, it gets an upward impulse.
- **P2-5 Two-prize bonus (backlog item).** On a successful grab, check for a second prize whose centre is within `0.55·grabRadius` of the claw and that touches the chosen prize. If one exists, roll **35%** (Chill 45%, Tricky 25%) to carry it too, drawn tucked beside the first. If both are banked, the score is both base values × the multiplier, **+3 bonus**, and a "DOUBLE!" popup. A mid-carry drop releases both.
- **P2-6 Catch payoff.**
  - Popup: "+N" (with "×2" appended when a multiplier applies) at the chute, in the rarity colour. Common uses white, uncommon uses `--md-sys-color-secondary`, rare uses `--md-sys-color-tertiary`, and golden uses gold.
  - A **sparkle burst** of 10 particles from the chute hole (14 for rare or golden), with a 600ms life.
  - **Screen shake:** 3px and 160ms for rare, golden or double catches. Rare also gets a 1-frame white flash at alpha .15 on the bay glass. All of this is disabled under reduced motion; the popup and the sound remain.
  - Catch sound scales with rarity: 2, 3 or 4 notes.
  - Last 10s: the clock turns `--md-sys-color-tertiary` with a 1Hz tick sound, and the progress bar turns tertiary.
- **P2-7 End-of-round reward.** The results screen changes:
  - A **prize shelf** above the stats: the caught emoji as DOM spans (max 24, then "+N more"). Golden ones get a gold ring. Each one drops in with a 40ms stagger (static under reduced motion).
  - Title tiers: 0 → "Empty-handed"; a new best → **"New best!"** with a CSS confetti burst (no confetti under reduced motion) and the announcement "New best score, N"; otherwise "Round over".
  - Stats: **Score · Caught · Top streak**. Below them: "Best (1:00 · Normal): 23".
- **P2-8 Best score saved.**
  - Store `localStorage["playpad.clawCatch.v1"] = {"v":1,"best":{"60-normal":23,…},"sound":true}`.
  - Key the best score by `durationSec + "-" + difficultyId`, because scores are only comparable within the same duration and difficulty.
  - Treat stored data as untrusted (LEARNINGS PLAY-005): accept only whitelisted keys, `Number.isFinite`, integer, 0–99999. Wrap everything in try/catch and fail soft (no saving means no best line, never an error).
  - On setup, show "Best: 23" under Start for the current selection. Update it live when the chips change.

### Colours (game-local custom properties, defined in the game `<style>`)

`--claw-sweet:#7cffb2`; gold `#f4c26b` (= the tertiary token value); bulbs `#ffd27a`.

| Theme    | `--claw-frame` | `--claw-frame-hi` | `--claw-wall` |
| -------- | -------------- | ----------------- | ------------- |
| Critters | #0d3b21        | #2fa35a           | #0a2a18       |
| Sweets   | #5e1a55        | #e070b8           | #3a0f35       |
| Space    | #10183f        | #4d6bff           | #0a0f2a       |

Mirror these values in the JS `THEMES` objects, because the canvas can't read CSS variables cheaply. DOM chrome uses `--md-sys-*` tokens only.

### Copy

- Toasts: "Line it up — then drop!" · "Green ring = best grab!" · "Got it!" · "So close!" · "It wriggled free!" · "It dropped!" · "Nice catch! +N" · "DOUBLE! +N" · "🔥 ×2 streak!" · "Golden! +10 · +5s" · "Streak lost".
- Results: "New best!" · "Round over" · "Empty-handed".

---

## 3. Implementation notes for the coder

- **Sizing and DPR.** Use a `ResizeObserver` on `#stage`, plus `resize` and `orientationchange`, coalesced into one rAF. Keep the 2× DPR cap.
  - `layout()` rebuilds the **static layer** on an offscreen canvas: backdrop, back wall, frame, marquee text, chute bay. Draw it per frame with one `drawImage`. Bulbs, glass streaks and the front lip are cheap per-frame shapes.
  - Never allocate gradients per frame (LEARNINGS rev4). Cache the gold sprite like the other prize sprites, and draw emoji only through the existing emoji-first sprite cache (AC-12).
  - Apply P0-1 normalised re-placement on every layout.
- **Input.**
  - The joystick and DROP are unchanged, apart from P0-5.
  - In short landscape, the joystick and DROP are absolutely positioned in the gutters and keep `touch-action:none` and ≥ 48px targets. Use `env(safe-area-inset-*)` for the notch side.
  - Don't re-implement arrow keys on focusable controls (LEARNINGS PLAY-003).
- **Reduced motion.** It disables shake, flash, bulb chase, the glint pulse, the shelf stagger and confetti. Game state never waits on CSS animation: every timing is JS-driven from `performance.now()`.
- **Fixed timestep.** Keep the 120Hz substeps. Do DOM writes (HUD, toast, streak chip) once per rendered frame, outside the substep loop (LEARNINGS PLAY-005). Only write when a value changes.
- **Teardown.** Do it in `show()` (P0-8). Pause on hidden (P0-7). Bank the best score in `endGame()` **before** `show("results")`, never in a timeout (LEARNINGS PLAY-005: deferred banking).
- **Debug hook.** Extend `window.__claw` with `streak`, `mult`, `golden`, `binCap`, `prizeR`, `catchOdds` and `layoutRev`, plus `forceGolden()`. Keep `forcePrizeUnderTip` and fix it (P0-9).
- **Perf budget.** At most 36 prizes and 40 particles, using a pooled particle array. The target is 60fps on a mid phone at 2× DPR.

---

## 4. Acceptance checks (testable)

1. **No errors or overflow.** At 360×740, 390×844, 844×390, 768×1024 and 1366×800: no console or page errors, `scrollWidth === innerWidth`, and the HUD bounding box doesn't overlap the rail (`hud.bottom < stageTop + railY`). Joystick, DROP, ★ and ✕ are all ≥ 48×48 CSS px and don't intersect each other or the cabinet frame.
2. **Rotation.** Start at 390×844, then switch to 844×390 mid-round. Within 500ms every prize has `y - rad ≥ railY + lRest`, `binLeft ≤ x ≤ binRight`, and `rad` within ±20% of the new `prizeR`. Rotating back restores the same guarantees.
3. **Refill.** Each new prize's first recorded position is at the hopper mouth (top-right, `|x - hopperX| < prizeR`), never under the claw column. The bin count never exceeds `binCap`. Below 50% of the cap, a burst of 3 arrives.
4. **Density.** At round start, `binLength ≥ 0.8·binCap`. `binCap ≥ 14` at 360×740 and `≥ 26` at 1366×800. The pile spans ≥ 70% of the tray width, and at 1366×800 it's at least 2 rows deep.
5. **Claw contact.** After a drop over the pile, the claw tip `y` is ≤ the top of the pile under the claw plus 4px.
6. **Keyboard.** Tab to DROP and press Enter: the phase leaves `idle`. Arrow keys, A/D and Space still work. Start → round → results → Play again is fully keyboard-operable.
7. **Odds.** A Monte-Carlo of `catchOdds` (10k trials) meets the P2-2 targets: Chill ≥ .90, Normal ≥ .80, Tricky ≥ .60 for a common prize at prox 1; mid-drop is exactly 0 for a common prize at prox 1.
8. **Streak.** Using `forcePrizeUnderTip`, 3 consecutive banked catches → `mult === 2`. A forced empty grab → `streak === 0`. Points equal base × mult.
9. **Golden.** `forceGolden()` plus a forced catch → +10×mult, and the clock gains +5s. Total added time per round is capped at +20s.
10. **Best score.**
    - After a round, `localStorage["playpad.clawCatch.v1"].best["60-normal"]` equals the max of the old and new scores.
    - The values `"1e999"`, `-5` and `{}` and an unknown key are all rejected without an error.
    - With `localStorage` throwing, the game still plays to the results screen.
11. **Teardown.** Quit (✕) during the countdown, during a carry, and from results → setup. No RAF loop keeps running (`__claw` frame counter frozen), the countdown is hidden, and the key panel is closed.
12. **Hidden tab.** Hide the page for 5s mid-round: on return, the remaining time is within ±0.3s of the remaining time before hiding.
13. **Reduced motion.** Under `prefers-reduced-motion: reduce`, there's no shake offset (camera offset stays 0) and no bulb chase, and catches, results and the best score all still work.
14. **Theme surface.** With the light OS scheme, the computed `#deck` background is the dark container value, and setup/results stay light.
15. **Smoke.** Extend `npm run smoke` to reach in-round (`__claw.running && !countingDown`) at all four viewports plus 844×390. `npm run check` and `npm run secrets` pass.
