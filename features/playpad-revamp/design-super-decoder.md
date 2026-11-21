# Design spec — Super Decoder (PLAY-006 revamp)

> Owner: senior game UX designer (delegated). Scope: `games/super-decoder/index.html` only. Shared `styles/*` are NOT changed; all CSS fixes are local to the game file. Audited hands-on 2026-11-21 with Playwright (touch + keyboard, light + dark, reduced motion) at 360×740, 390×844, 844×390, 768×1024, 1366×800. Screenshots: `/tmp/claude-0/-home-user-play-pad/d673e733-2e20-53e5-baf1-01b45976e8f0/scratchpad/design-decoder/` (shortened below to `shots/`; scratch, not committed).

No console or page errors and no horizontal overflow at any viewport. The problems are layout, legibility and keyboard handling.

## 1. Findings (with evidence)

| #   | Sev | Finding                                                                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                   |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | P0  | **Dark mode: "black" and "white" feedback pegs look the same.** `.fb.black` uses `--md-sys-color-on-surface`, which is #f4f4f7 in dark mode, and `.fb.white` is #ffffff. You can't tell exact from colour-only matches, so the core mechanic is broken in the default theme. In light mode, white (#fff with an outline) vs none (#f0dee1) is also faint. | Computed `rgb(244,244,247)` vs `rgb(255,255,255)`; `shots/dark-360x740-inround.png` rows 4/5/7; `shots/theme3-light-reduced-390.png` row 4 |
| F2  | P0  | **Landscape phone (844×390): the board viewport is 107 px**, so about 1 row shows. Palette buttons are 124 px and the deck takes 215 px. No history is visible while you guess, so you can't deduce anything.                                                                                                                                             | `shots/settled-844x390.png`, `shots/fail-banner-844x390.png`                                                                               |
| F3  | P0  | **Desktop/tablet: the palette grows with width.** Colour buttons are 211 px at 1366 and 112 px at 768, and the deck is 302 px tall at 1366×800. Only 6 of 10 rows fit, so the board scrolls on a large screen.                                                                                                                                            | `shots/dark-1366x800-inround.png`, `shots/settled-1366x800.png`                                                                            |
| F4  | P0  | **Enter is swallowed globally during PLACING.** The window `keydown` handler calls `preventDefault()` on Enter, so Enter on a focused `#quitBtn`, `.colorBtn` or `#clearBtn` does nothing. You can't quit with Enter. Enter on a focused slot submits the row.                                                                                            | Script: focus `#quitBtn` → Enter → still on `game`; focus colour 3 → Enter → no change                                                     |
| F5  | P1  | **Focus is lost.** After Start and after each submit, `document.activeElement` is `<body>` (Submit becomes disabled while focused), so a keyboard/AT user has to Tab from the top every turn.                                                                                                                                                             | Script output `focus after submit: BODY`                                                                                                   |
| F6  | P1  | **A focused slot ignores number keys.** Focus slot 4 and press `5`: the colour lands in `code.activeSlot` (slot 3).                                                                                                                                                                                                                                       | `{"current":[0,1,4,null]}` after focusing slot 4 (IDEAS "Later" item)                                                                      |
| F7  | P1  | **Active-row slots are 34 px on phones** (below 48 px). Fixing a peg one-handed on the train needs precise taps (Maya). Feedback dots are 10 px.                                                                                                                                                                                                          | `slot 34×34`, `fb 10×10` at 360/390                                                                                                        |
| F8  | P1  | **SUBMIT still looks enabled** (primary fill) during the feedback reveal and the banner, because `submitGuess` never re-disables it. This is a misleading affordance, and taps are silently ignored.                                                                                                                                                      | `shots/fail-banner-844x390.png`, `shots/light-390x844-banner.png`                                                                          |
| F9  | P1  | **Feedback cluster has no readable label.** It's a `div` with `aria-label="Feedback for row N"`, no role and no counts, so past rows can't be inspected with AT (Sam).                                                                                                                                                                                    | Script `fb aria: Feedback for row 1`                                                                                                       |
| F10 | P1  | **Dead time.** 2.4 s of 3-2-1-GO before a turn-based puzzle, then ~2.2 s of unskippable banner and tick between codes (Dan).                                                                                                                                                                                                                              | Measured `banner->next code ≈ 2160 ms`                                                                                                     |
| F11 | P1  | **Setup at 360×740: Start is below the fold** (scrollHeight 841). The theme previews (3:4 tiles) waste about 60 px.                                                                                                                                                                                                                                       | `shots/dark-360x740-setup.png`                                                                                                             |
| F12 | P2  | **The banner is a small 151 px pill** pinned at top:56 over rows 1–2, with 22 px pegs. It's an underwhelming payoff and isn't tappable. The solved row isn't celebrated, there's no streak flair and no saved best.                                                                                                                                       | `shots/dark-390x844-banner.png`                                                                                                            |
| F13 | P2  | **Results: "Change settings" wraps** to 2 lines at 360.                                                                                                                                                                                                                                                                                                   | `shots/results-360x740.png`                                                                                                                |

## 2. Decisions

### P0 — must fix

- **D1 Feedback pegs are told apart by shape, not black vs white (F1).** Replace the black/white fill with three shape-distinct, theme-proof states:

  - **exact** = solid dot, `background: var(--md-sys-color-on-surface)`
  - **colour-only** = hollow ring, `background: transparent; border: 2.5px solid var(--md-sys-color-on-surface)`
  - **miss** = small faint pip at 40% scale, `background: var(--md-sys-color-outline-variant)`, no border

  Keep the class names `.fb.black` / `.fb.white` (tests and AC-8 order rely on them) and change only their look. Dot size is `--sd-fb: clamp(12px, 3.4vw, 15px)` with a 4 px gap.

  Change the copy everywhere "black/white peg" appears:

  - Tagline: "**●** solid = right colour, right spot. **○** ring = right colour, wrong spot. Codes can repeat a colour."
  - Results no-solve tip: "…use the rings as your clue."
  - `announce()`: "Row 3: 2 exact, 1 colour only. 7 tries left."

  Add a persistent one-line legend above the board (`label-small`, `on-surface-variant`, 20 px tall): `● right spot · ○ wrong spot`.

- **D2 Board sizing: all 10 rows visible with no board scroll in portrait and on desktop/tablet (F3).**
  - Cap the deck: `#deck` content gets `max-width: 460px; margin-inline: auto` (match `.board`). `.colorBtn` gets `width/height: clamp(48px, 13vw, 60px)` and drops `aspect-ratio` growth via `justify-self: center`.
  - Size rows from height: `--sd-row-h: clamp(40px, calc((100dvh - 250px) / 10.6), 60px)`. History/empty slots use `--sd-slot: calc(var(--sd-row-h) - 10px)` capped at 44 px.
  - The **active row** is taller: `min-height: calc(var(--sd-row-h) + 8px)` and slots at **48 px** (F7).
  - Board gap is 4 px, row padding `4px 8px`.
  - Budget at 360×740: HUD 68 + legend 20 + deck ~135 → board ~517 ≥ 9×44 + 56 + 9×4 + 12 = 500 ✓.
- **D3 Landscape two-pane (F2).** Use `@media (orientation: landscape) and (max-height: 540px)`:
  - `#stage` becomes `display: grid; grid-template-columns: 1fr minmax(280px, 34%)`.
  - The board (with the legend) is on the left, full height, scrolling allowed.
  - The right column stacks the HUD (wraps to 2 lines OK), the palette as **3×2** with 52 px buttons, and Clear/Submit.
  - Rows are 34 px (slots 28 px); the active row is 48 px (slots 44 px, the landscape-only exception, still ≥ 44).
  - Banner and countdown overlays are centred over the board pane.
  - Respect `env(safe-area-inset-left/right)` on both panes.
- **D4 Fix Enter handling (F4).** In the window keydown handler, the **Enter → submit** shortcut fires only when `document.activeElement` is `body`, a `.slot` in the active row, or `#submitBtn`. On any other button, return early **without** `preventDefault()` so native activation works. Apply the same guard to Backspace: ignore it unless focus is body/slot.

### P1 — usability

- **D5 Focus management (F5).** When a row becomes active (after the countdown/intro and after the reveal), if focus is `body`, `#submitBtn` or a now-disabled element, call `activeSlotEl.focus({ preventScroll: true })`. Never steal focus from the palette or quit button.
- **D6 Slot-targeted keys (F6).**
  - If a `.slot` in the active row is focused, number keys `1–6` first set `code.activeSlot` to that slot, then `placeColor`. Focus then moves to the new `activeSlot` (only when it was on a slot).
  - Add **ArrowLeft/ArrowRight** to move `activeSlot` (with wrap) and focus on active-row slots, and **Delete** to clear the focused slot.
  - Update the setup note to: "Tap a slot, then a colour · keys 1–6 place · ←/→ move · Enter submits".
- **D7 Locked states (F8).**
  - On entering `SUBMITTING`/`BETWEEN`, set `#submitBtn.disabled = true` and `#clearBtn.disabled = true` (style `:disabled` with opacity .5).
  - Add `#palette.locked` (opacity .45, `pointer-events:none`) **only during BETWEEN**, not during the ~780 ms reveal, to avoid flicker.
  - `refreshActiveRow()` restores both.
- **D8 Readable history for AT (F9).** After the reveal, give each `.feedback` `role="img"` and `aria-label="Row N: X exact, Y colour only"`. Each `.row` gets `aria-label="Guess N: red, blue, … — X exact, Y colour only"` once it's locked. Keep `role="grid"`/`row` semantics consistent, or drop `role="grid"` for `role="list"`/`listitem`, which is simpler and correct here (recommended).
- **D9 Cut dead time (F10).**
  - **Remove the 3-2-1-GO** at session start. The board is `PLACING` immediately after Start.
  - Reuse `#countdown` as a non-blocking 700 ms "Code 1 of 3" flash (pointer-events none, CSS fade, skipped under reduced motion).
  - **Banner is skippable** (see D12): auto-advance after `BANNER_MS = 2400`, `NEXT_CODE_TICK_MS = 0`.
  - This supersedes PLAY-004 requirements line 68 / AC-14 wording. Keep `show()` clearing `#countdown`.
- **D10 Quick round (Dan/Maya, IDEAS "Next").** Add a first difficulty chip `{ l: "Quick", sub: "1 code", totalCodes: 1 }`. The default stays Easy. With 4 chips at 360 each is ~75 px, which is fine.
- **D11 Setup fits a phone (F11).**
  - Theme preview becomes a **3×2 dot strip** (`aspect-ratio:auto`, dots 18 px).
  - `.block` margin goes from 26 to 20 px; tagline bottom margin from 26 to 18 px.
  - Sound sub-copy becomes "Peg ticks and a solve chime" (one line).
  - Target: Start fully visible at 360×740.

### P2 — fun and delight

- **D12 Reveal moment (F12).**
  - The banner becomes a centred card over the board pane: `width: min(340px, 100% - 32px)`, `--md-sys-shape-corner-xl`, `elevation-level3`.
  - Content: title (`title-large`), then the secret as **32 px pegs** that flip in one by one at 90 ms stagger (`rotateY` 90→0, 180 ms emphasized; reduced motion shows them instantly), then a line (e.g. "Solved in 4 · +70 pts · streak ×2"), then a 48 px tonal button **"Next code ▸"** (or **"See results ▸"** on the last code).
  - Tap on the button, Enter, Space or tap on the card advances early; otherwise auto-advance at 2400 ms.
  - Move focus to the button when the banner opens, restore per D5 after.
- **D13 Solved-row celebration.** Add `.row.solved` (primary border, `color-mix` glow) and the 4 pegs bounce in sequence (60 ms stagger, 220 ms). On fail, the last row gets `.row.failed` (outline colour, no motion). Reduced motion: border only.
- **D14 Streak flair.**
  - When the streak is 2 or more, the HUD streak reads `🔥 ×N` in `--md-sys-color-tertiary`.
  - One-shot scale pulse (150 ms) when it increments; none under reduced motion.
  - `aria-label` "Streak N".
- **D15 Saved best (fail-soft).**
  - Persist the best score per difficulty in `localStorage` under `playpad.superDecoder.v1` = `{ best: { quick, easy, normal, hard } }`, with every read/write in try/catch (Neon Rush precedent, LEARNINGS).
  - Results: add a "New best!" tonal chip above the stat grid when beaten; the third stat becomes **"Best score"** for this difficulty, and "best solve" moves into the sub line.
  - This supersedes the PLAY-004 "no storage" rule. Record it in `docs/DECISIONS.md`.
- **D16 Results copy (F13):** "Change settings" becomes **"Settings"**.
- **Rejected:**
  - **Hint button.** It undermines the deduction loop; the rings legend is the right help.
  - **"Tap colour then slot".** It conflicts with the auto-advance model; 48 px active slots plus D6 fix the correction pain.
  - **Quit confirm.** The ✕ is far from the thumb zone and a session is short.

## 3. Implementation notes for the coder

- **`scoreGuess` is untouchable.** Don't change its signature, algorithm or `window.__decoder.scoreGuess`. D1 is CSS + copy only; `paintFeedbackCluster` keeps the blacks → whites → greys order (AC-8).
- **The `show()` chokepoint (LEARNINGS rev2 row 13).**
  - Every new transient goes into `show()` teardown: the banner skip handler state, the `#palette.locked` class, `.row.solved/failed`, the intro flash and the streak pulse.
  - All timers use `later()`, so quit mid-reveal or mid-banner cancels them.
- **Banner skip double-advance pitfall.** Put the advance logic in one idempotent `advanceFromBanner()`. It returns unless `phase === Phase.BETWEEN`, sets phase to `IDLE` before doing anything else, and clears the pending auto-advance timer (`clearTimeout` + remove from `pendingTimeouts`). Otherwise a skip plus the auto timer skips a code (`codeIndex += 2`).
- **Keyboard on the banner.** The global keydown handler returns early unless phase is PLACING. Handle Enter/Space on the banner via the button's native click, not the global handler.
- **D2 sizing.** Use `100dvh` with a `100vh` fallback line before it. `body` is `position:fixed; inset:0`, so `#stage` heights resolve. Check that `scrollIntoView({block:"nearest"})` still runs for landscape (board scrolls there).
- **D3.** The deck, HUD and board are siblings inside `#stage`, so do the two-pane with grid areas inside the media query; there's no DOM move needed if you assign `grid-area`s (`hud`/`deck` → right column, `legend`/`boardWrap` → left). Keep `#quitBtn`'s 48 px block verbatim (LEARNINGS row 12).
- **D4/D6 guard helper:** `function isTypingTarget(el){ return el === document.body || el.id === "submitBtn" || (el.classList.contains("slot") && +el.dataset.row === code.rows.length); }`.
- **Hooks for tests.** Keep `window.__decoder` getters (`phase`, `code`, `codeIndex`…). Add `get bannerOpen()` and `skipBanner()` (calls `advanceFromBanner`) for the smoke/QA tests. The revamp smoke reaches in-round by clicking Start and waiting for `__decoder.phase === "PLACING"`, which becomes instant with D9.
- **Colour tokens:** the only raw hex stays the 18 palette colours. The new legend, ring and pip use tokens. The banner's "win" state keeps `--md-sys-color-secondary-container`.
- **CSP:** no new scripts or styles from outside the file; the `localStorage` write is same-origin.

## 4. Acceptance checks (automatable with Playwright)

1. **No errors / no overflow:** zero `pageerror`/console errors and `documentElement.scrollWidth === innerWidth` on setup, in-round, banner and results at 360×740, 390×844, 844×390, 768×1024 and 1366×800, light and dark.
2. **Feedback distinguishable (D1):** in dark **and** light, computed styles differ by shape:
   - `.fb.black` has `background-color` = the on-surface token and `border-width` ≤ 1.5 px.
   - `.fb.white` has transparent background and `border-width` ≥ 2 px.
   - A miss is rendered smaller (transform scale < 1 or a smaller box).
   - Dot box ≥ 12 px at 360.
3. **All rows fit (D2):** with the board at 7 guesses, `#boardWrap.scrollHeight <= clientHeight + 1` at 360×740, 390×844, 768×1024 and 1366×800.
4. **Landscape (D3):** at 844×390 the board pane and deck are side by side (`deck.left >= board.right - 1`). The active row is fully within the board pane, and at least 5 rows are visible. Each `.colorBtn` is ≥ 48 and ≤ 64 px.
5. **Palette cap (D2):** `.colorBtn` width is between 48 and 64 px at every viewport. Active-row `.slot` is ≥ 48 px in portrait and ≥ 44 px in landscape.
6. **Keyboard (D4–D6):**
   - Focus `#quitBtn` + Enter → setup screen.
   - Focus a `.colorBtn` + Enter → that colour placed.
   - Focus active slot 4 + `5` → `current[3] === 4`.
   - ArrowLeft moves `activeSlot`.
   - After a submit resolves, `document.activeElement` is an active-row `.slot`.
   - A full session completes by keyboard only.
7. **Locked states (D7):** during `SUBMITTING` and `BETWEEN`, `#submitBtn.disabled && #clearBtn.disabled`.
8. **AT (D8):** after row 1 resolves, its `.feedback` has `role="img"` and an `aria-label` matching `/Row 1: \d exact, \d colour only/`.
9. **Pace (D9/D12):**
   - `phase === "PLACING"` within 300 ms of tapping Start.
   - On the banner, tapping "Next code" reaches the next code's PLACING within 400 ms, and `codeIndex` increments by exactly 1 (no double-advance when the auto timer would also fire).
   - Without a tap, it auto-advances in ≤ 2.6 s.
10. **Quick round (D10):** pick Quick → `totalCodes === 1`; a solve goes straight to results.
11. **Setup fits (D11):** at 360×740, `#startBtn.getBoundingClientRect().bottom <= 740`.
12. **Persistence (D15):** after a session, `localStorage['playpad.superDecoder.v1']` holds the score. With `localStorage` throwing (stubbed), the game still completes a session with no errors.
13. **Reduced motion:** with `reducedMotion:'reduce'` a session completes; no `.peg` or banner peg has a running animation (`getAnimations().length === 0`); feedback still reveals one by one (JS cadence).
14. **Quit safety (AC-12/13 kept):** quit mid-reveal and mid-banner → setup; `__decoder.pendingTimeouts.length === 0`; the banner/countdown are hidden; `#quitBtn` is ≥ 48×48.
15. **Correctness unchanged:** the AC-7 `scoreGuess` fixtures still pass unchanged.
