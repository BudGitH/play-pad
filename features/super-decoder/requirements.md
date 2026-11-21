# Feature: Super Decoder

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** VALIDATED (QA clean · PM PASS · persona gate PASS — see `qa-report.md`, `product-validation.md`)
**Owner:** @BudGitH
**Ticket:** PLAY-004
**Created:** 2026-06-27
**Feature tier:** Prototype _(matches the project tier)_

---

## What & why

- **What:** A single-player Mastermind-style code-breaking mini-game called **Super Decoder**, modelled on Giiker's "Super Decoder" toy. The player tries to crack a secret 4-colour code in ≤ 10 guesses; difficulty = how many codes you must crack in one session (3 / 5 / 8). PlayPad's 4th game and its first **logic / deduction** title.
- **Why:** PlayPad's catalog now has reflex (Colour Rush, Snap) and arcade-skill (Claw Catch) — but nothing for a player who wants a brain-on, low-stakes puzzle. Closes that gap in `docs/IDEAS.md` and gives Solo Sam a return-trip reason after Claw Catch.

## Business requirements & success metrics

- **Business outcome:** PlayPad's catalog now serves the _logic / puzzle_ mood, in addition to reflex and arcade. A solo player who's in a "brain-on" mood can find a game in seconds, complete it without sign-up or install, and see why a return visit might be worth it.
- **Success metric:** Adding a 4th game is a **one-object change to `games.js`** (per `PROJECT.md` success criteria). A new player can launch Super Decoder from the hub and solve their first code on Easy in under 3 minutes without external help.
- **Must-have business rules:**
  - Game is fully self-contained — no backend, no network, no storage. (Per `CONVENTIONS.md`.)
  - Adheres to the MD3 design system; no raw hex/px except the 6 theme peg-colour palettes themselves.
  - Reachable from the hub via one registry entry; no edits to `index.html`.

## Target personas & success bar

> Personas drawn from the existing PlayPad persona roster (see `docs/PRODUCT-PANEL.md`-style brief).

- **Personas served (from `docs/PRODUCT-PANEL.md` roster):**
  - **Dan — "Office Micro-breaker"** (primary) — desk worker taking a short, low-stakes _mental reset_ on a laptop between meetings. A deduction puzzle is squarely his job-to-be-done; cares about clear feedback and a round that fits the break.
  - **Maya — "Commuter Casual"** — mobile-first, one-handed, short frequent sessions. Tests instant start and whether the peg/palette taps work one-handed on a phone.
  - **Sam — "Keyboard / AT user"** — navigates by keyboard + screen reader, and (relevant here) represents the colour-vision-accessibility floor. Tests full keyboard operability, focus, labels, and the non-colour (shape) signal.
- **Baseline (hard gate, all three):** can reach the game from the hub, set difficulty, place pegs into a guess row, submit, read feedback, and finish a session (solve or fail) with a score + "play again". For Sam: doable entirely by keyboard with audible/visible feedback and a non-colour way to tell pegs apart.
- **Value (hard gate):**
  - **Dan:** "This is a proper little deduction puzzle — the per-turn placement + staggered feedback feels snappy, and a 3-code Easy run fits a between-meetings break."
  - **Maya:** "I can start in seconds and play it one-handed on the train."
  - **Sam:** "I can place and submit with the keyboard, focus is visible, labels read correctly, and shapes let me read the code without relying on colour."
- **High satisfaction (scored, not gated):**
  - **Dan:** the solve sting + streak counter pull me toward 'one more code'.
  - **Maya:** the board doesn't get visually crowded by round 8; it's pleasant to glance at.
  - **Sam:** browsing → launching → playing feels smooth via AT, not just technically possible.

## Design routing

- UI surface? **yes** · Reuse-only? **mostly** (chrome/tokens reused; one **new** UI surface: the peg board + colour palette) · Tier **Prototype** → **Path: lite**

## Design review

> Lite path — quick check against `docs/DESIGN-SYSTEM.md`.

- **Chrome reused verbatim from Claw Catch:** back link, brand wordmark, `.block` / `.chips` / `.sel-chip` / `.theme-grid` / `.theme-card` / `.toggle-row` / `.switch` / `.start-btn` / `#countdown` overlay / `.stat-grid` results / `.res-actions` / `#quitBtn` (48px tap-target block at claw-catch:212–219 — **load-bearing, copied verbatim** per LEARNINGS row 12).
- **New components, MD3-conformant:**
  - **Peg slot** — square chip, `--md-sys-shape-corner-md`, `--md-sys-color-surface-container-highest` background when empty; the active slot adds a `--md-sys-color-primary` ring and pulses (CSS; decoration only — functional state is JS).
  - **Filled peg** — inner circle, theme palette colour (the 6 palettes are the only raw hex in the file; documented in a comment), bevel via inset shadow.
  - **Feedback peg cluster** — stable 2×2 grid of mini dots beside each row. Black-filled = exact match (colour + position); white outline = colour-match-wrong-position; light grey = no info. Order does NOT encode position (blacks always first → grey last) so a player can't read position from the cluster.
  - **Palette button** — circular colour-button ≥ 48 × 48px, with a double-stroke `:focus-visible` ring (white inner + dark outer) so the ring contrasts on every theme colour (LEARNINGS row 4).
- **Tokens used:** all `--md-sys-color-*`, `--md-sys-typescale-*`, `--md-sys-shape-corner-*`, `--md-sys-motion-*`, `--md-sys-spacing-*`. No raw hex/px outside the theme palettes + canvas-free constants.
- **Human OK:** owner approved the brief; no full design path needed.

## User-visible behaviour

Happy path:

1. From the PlayPad hub the player taps the **Super Decoder** card → setup screen loads.
2. Setup: pick a **theme** (Classic / Pastel / Neon) — purely changes the 6 peg colours; pick **difficulty / session length** (3 codes / 5 codes / 8 codes); toggle sound. Tap **Start**.
3. A `3-2-1-GO` countdown plays, then the game screen appears with an empty board (10 rows × 4 slots), a colour palette of 6 colours, a ⌫ Clear, and a SUBMIT button (disabled).
4. The HUD shows `Code 1 / 3 · Attempts 10 · Score 0 · Streak 0`.
5. **Per turn:** the first slot on the bottommost empty row is auto-active (subtle pulse). Tap any colour in the palette → a coloured peg drops into the slot with a short bounce animation, the active slot advances. Repeat 4 times. SUBMIT enables.
6. Tap a filled slot to clear it; or tap **⌫ Clear** to wipe the whole row.
7. Tap **SUBMIT**. The row locks. Feedback pegs reveal one at a time (left to right, ~140ms apart) — each with its own tone. After the last peg, the next row up activates.
8. **On solve:** the row briefly highlights, a solve sting plays, score increments, streak +1, the secret is shown in a small banner ("The code was: ● ● ● ●"), then a brief "Code 2 of 3" countdown → next code.
9. **On fail (10th wrong guess):** a fail sting plays, the secret is revealed in the banner with "Failed!" text, streak resets, score does not increment → next code.
10. After the last code: results screen shows total **Score**, **Solved (X of N)**, **Best (fewest-guesses solve)** + Change settings / Play again / ← PlayPad.

## Acceptance criteria

> Each criterion is testable and pass/fail.

- [ ] **AC-1 — Hub integration:** Super Decoder appears as a live card on `index.html` (rendered from `window.GAMES`); tapping its `<a>` link loads `games/super-decoder/`. No edits to `index.html` are required.
- [ ] **AC-2 — Setup gates start:** the Start button is enabled at all times (theme + difficulty have safe defaults — Classic + 3 codes); pressing Start always transitions to the game screen.
- [ ] **AC-3 — Difficulty maps to session length:** picking 3 codes / 5 codes / 8 codes makes the session require exactly that many codes before showing results (verified via `window.__decoder.totalCodes`).
- [ ] **AC-4 — Per-code rules constant:** every code is **4 pegs**, drawn from **6 colours** (with duplicates allowed), with **10 attempts max**, regardless of difficulty.
- [ ] **AC-5 — Per-turn placement:** tapping an empty slot makes it active; tapping a palette colour fills the active slot and auto-advances to the next empty slot; tapping a filled slot clears it.
- [ ] **AC-6 — Submit gate:** the SUBMIT button is disabled until all 4 slots of the active row are filled.
- [ ] **AC-7 — Feedback algorithm (correctness):** the feedback peg counts satisfy classic Mastermind two-pass scoring (duplicate-safe). Specifically:
  - secret `[R,G,B,Y]` + guess `[R,G,B,Y]` → 4 black / 0 white.
  - secret `[R,G,B,Y]` + guess `[Y,B,G,R]` → 0 black / 4 white.
  - secret `[R,R,R,R]` + guess `[R,G,B,Y]` → 1 black / 0 white.
  - secret `[R,R,G,G]` + guess `[R,G,R,G]` → 2 black / 2 white.
  - secret `[R,R,G,Y]` + guess `[G,R,Y,B]` → 1 black / 2 white.
- [ ] **AC-8 — Feedback order does not leak position:** the 4 mini-pegs in the cluster render in a stable order (blacks, then whites, then greys) — never in the same order as the guess.
- [ ] **AC-9 — Solve advances:** when a guess matches the secret exactly, score and streak increment, the secret is shown in a banner, and after a short delay the next code begins (or results show if it was the last).
- [ ] **AC-10 — Fail advances:** when the 10th guess is wrong, the code is marked failed, streak resets to 0, the secret is revealed, and the session advances.
- [ ] **AC-11 — Scoring formula:** `points = max(10, (attemptsMax − attemptsUsed + 1) × 10)` for a solved code, plus `streak × 5`. A failed code scores 0.
- [ ] **AC-12 — Quit safety:** tapping `#quitBtn` at any point (including mid-stagger of a feedback reveal) returns to the setup screen with no orphan animations and no errors in the console.
- [ ] **AC-13 — 48px quit target:** `#quitBtn.getBoundingClientRect()` measures **≥ 48 × 48 px** (WCAG 2.5.8; LEARNINGS row 12).
- [ ] **AC-14 — Countdown teardown:** the `#countdown` overlay is cleared inside `show()` itself, so any screen-change exit (quit, end-session, results-to-setup) cannot leave it visible (LEARNINGS rev2 row 13).
- [ ] **AC-15 — Reduced-motion safe:** under `prefers-reduced-motion: reduce`, the game still plays end-to-end: feedback rows still populate, audio still fires, but visual pop / pulse / bounce are suppressed (LEARNINGS row 3).
- [ ] **AC-16 — Focus visible on palette:** every colour palette button has a visible `:focus-visible` ring that is readable against the colour itself (LEARNINGS row 4).
- [ ] **AC-17 — A11y labels:** every palette button has an `aria-label` like "Place red"; slots have `aria-label="Slot N: empty/colour"`; HUD updates announce via `aria-live`.
- [ ] **AC-18 — Results show summary:** session-end screen shows total Score, Solved (X of N), and Best (fewest-attempts solve, or "—" if no solves), with Play again / Change settings / ← PlayPad.
- [ ] **AC-19 — Play again resets cleanly:** pressing Play again on results begins a new session with the same settings, score 0, streak 0, code index 1.
- [ ] **AC-20 — Shape redundancy (colour is not the only signal):** every rendered peg (board slots, palette buttons, banner secret reveal) carries a distinct shape glyph tied to its colour **index** (●▲■◆★✚), so a colour-blind player can read the code by shape. Glyphs are stable across themes (CODE_QUALITY §13).

## Edge cases & error states

- **Solve in 1 guess** — score = `(10 − 1 + 1) × 10 = 100` + streak bonus. (Edge: max points; banner + sting still play.)
- **Fail on 10/10** — feedback reveals correctly, then session advances on the same delay as a solve.
- **Quit mid-feedback reveal** — every pending `setTimeout` is in `pendingTimeouts[]` and cleared inside `show()`; no orphan pegs animate into setup.
- **Quit mid-countdown** — the countdown overlay's `.active` class is removed inside `show()`.
- **Same colour all 4 slots** — allowed, since duplicates are allowed in the secret too; the scoring algorithm handles it.
- **No filled slots → SUBMIT** — SUBMIT is disabled; impossible to fire.
- **Rapid taps on a colour** — first tap fills the active slot; subsequent rapid taps fill the next empty slot (not the same slot twice).
- **Last code solved** — session advances directly to results (no "next code" interstitial).
- **Reduced-motion + sound off** — game must still be playable end-to-end with no animations and no audio.
- **Window resize mid-game** — DOM layout reflows naturally; no canvas to relayout.

## Out of scope

- Multiplayer.
- Persistent high scores (parked in `IDEAS.md` under "Later").
- Hints / aim-assist.
- Custom code length / custom number of colours (parked in `IDEAS.md` if requested later).
- Sharing / deep links.
- Cheat-prevention / timer per code.

## Non-functional requirements

- **Accuracy:** the feedback algorithm is **duplicate-safe** (two-pass). The exposed `scoreGuess(secret, guess)` is a **pure function** of `(secret, guess)` and its outputs match the AC-7 fixtures exactly. Score formula displays the same number that's added to the running total (no rounding drift).
- **Risk/Security:**
  - No user-supplied strings are rendered as HTML (`textContent` only); CSP-safe.
  - Game has no network, no storage, no third-party scripts.
  - The `window.__decoder` test hook is harmless in production (it only exposes read-only state + deterministic test helpers; no privileged operations).
- **Compliance:** no PII; no audit trail required at Prototype tier (per `WORKFLOW.md`).
- **Quality:**
  - Single self-contained `.html` file, ≤ ~1400 lines.
  - Adheres to `CODE_QUALITY.md` Prototype tier: meaningful variable names, no magic numbers (named constants at top of script), no commented-out code, the four-tier-comment system.
  - Performance: no per-frame loop. DOM updates are O(active row) per turn (≤ 4 nodes); the whole board is ≤ 80 nodes (10 rows × ~8 nodes each) — fine on a 360px mobile viewport.
  - All MD3 tokens; no raw hex/px except the documented 6×3 theme palettes.

## Tech Lead feasibility

- **Verdict:** **PROCEED** — DOM-only board game; reuses all setup/results chrome from Claw Catch; the only new mechanic is the feedback algorithm (well-known, pure function, easily tested with fixtures). No new browser APIs needed. Effort ≈ one focused implementation pass + verification.
