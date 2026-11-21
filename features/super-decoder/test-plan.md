# Test Plan: Super Decoder

> **Phase 2 of the workflow.** Tests define "done".

**Feature:** Super Decoder
**Ticket:** PLAY-004
**Created:** 2026-06-27

---

## Coverage map (AC → test)

| AC | Test(s) | Type |
|---|---|---|
| AC-1 Hub integration | T-INT-1 (hub-render), T-INT-2 (link-loads-game) | integration |
| AC-2 Setup gates start | T-SETUP-1 (default Start enabled) | e2e |
| AC-3 Difficulty = session length | T-SESS-1 (3/5/8 → totalCodes) | e2e |
| AC-4 Per-code rules constant | T-RULES-1 (4/6/10 invariants across difficulties) | e2e |
| AC-5 Per-turn placement | T-PLACE-1 (active-slot advances), T-PLACE-2 (refill on tap-clear) | e2e |
| AC-6 Submit gate | T-SUBMIT-1 (button disabled until 4) | e2e |
| AC-7 Feedback algorithm | T-ALGO-1..5 (the five fixtures below) | unit (via `scoreGuess`) |
| AC-8 Feedback order | T-ORDER-1 (renders blacks-first, never in slot order) | unit + DOM |
| AC-9 Solve advances | T-SOLVE-1 (force secret, match, advance) | e2e |
| AC-10 Fail advances | T-FAIL-1 (10 wrong → next code, streak reset) | e2e |
| AC-11 Scoring formula | T-SCORE-1 (solve in 1 = 100 + streak), T-SCORE-2 (fail = 0) | unit + e2e |
| AC-12 Quit safety | T-QUIT-1 (mid-stagger), T-QUIT-2 (mid-countdown) | e2e |
| AC-13 48px quit target | T-A11Y-1 (getBoundingClientRect ≥ 48×48) | e2e |
| AC-14 Countdown teardown | T-QUIT-2 (above) covers this | e2e |
| AC-15 Reduced-motion safe | T-RM-1 (stub matchMedia + full play) | e2e |
| AC-16 Focus visible on palette | T-A11Y-2 (focus a palette button, screenshot ring) | e2e |
| AC-17 A11y labels | T-A11Y-3 (assert aria-label on every palette + slot) | e2e |
| AC-18 Results show summary | T-RESULTS-1 (totals after full session) | e2e |
| AC-19 Play again resets | T-RESET-1 (score/streak/codeIndex all 0/0/1) | e2e |
| AC-20 Shape redundancy | T-CB-1 (palette + peg glyphs render per colour index) | e2e |

## Test cases

### Happy path

- [ ] T-INT-1: PlayPad hub renders 4 cards including "Super Decoder". `document.querySelectorAll('.card').length === 4`; the Super Decoder card has a live `<a>` linking to `games/super-decoder/`.
- [ ] T-INT-2: Clicking the Super Decoder card loads `games/super-decoder/` and the setup screen is visible (`#setup.active` present).
- [ ] T-SETUP-1: On setup, the Start button is enabled (`disabled` attribute absent). Defaults: theme = Classic, length = 3 codes.
- [ ] T-SESS-1: Picking each of the three difficulty chips makes `window.__decoder.totalCodes` equal 3 / 5 / 8 respectively at the start of the session.
- [ ] T-RULES-1: Across all 3 difficulties, after Start: `__decoder.attemptsLeft === 10`, `__decoder.secret.length === 4`, palette renders exactly **6** colour buttons.
- [ ] T-PLACE-1: After `fillSlot(2, c)` from a fresh row, `__decoder.code.current === [null, null, c, null]`, `activeSlot === 3` (auto-advance).
- [ ] T-PLACE-2: Clicking a filled slot clears it and makes it active again.
- [ ] T-SUBMIT-1: `#submitBtn.disabled === true` when any slot is null; `false` once all 4 are filled.
- [ ] T-SOLVE-1: `forceSecret([0,1,2,3])`; fill the matching row; click submit; after the reveal completes assert `__decoder.solved === 1`, `__decoder.score > 0`, `__decoder.codeIndex === 1` (i.e. moved to the next code).
- [ ] T-FAIL-1: `forceSecret([0,0,0,0])`; submit 10 guesses that don't match (e.g. all `[1,2,3,4]`); after the 10th reveal assert `__decoder.streak === 0`, the secret is revealed in the banner, then the session advances.
- [ ] T-RESULTS-1: Complete a 3-code session (solve at least 1) → results screen visible with Score / Solved / Best stats populated correctly.
- [ ] T-RESET-1: From results, click "Play again" → setup-or-game; assert `__decoder.score === 0`, `__decoder.streak === 0`, `__decoder.codeIndex === 0`.
- [ ] T-CB-1: After Start, `querySelectorAll('.colorBtn .pegSym')` yields the 6 glyphs `[●,▲,■,◆,★,✚]`; placing a colour renders a `.peg .pegSym` matching that colour's index; the glyph survives the submit-lock (history row keeps it).

### Edge cases (boundaries)

- [ ] T-ALGO-1: `scoreGuess([R,G,B,Y], [R,G,B,Y]) → {black:4, white:0}`. (Identity: 4 exact.)
- [ ] T-ALGO-2: `scoreGuess([R,G,B,Y], [Y,B,G,R]) → {black:0, white:4}`. (All swapped: 4 colour-only.)
- [ ] T-ALGO-3: `scoreGuess([R,R,R,R], [R,G,B,Y]) → {black:1, white:0}`. (Secret duplicates: only 1 colour match, the first.)
- [ ] T-ALGO-4: `scoreGuess([R,R,G,G], [R,G,R,G]) → {black:2, white:2}`. (Mixed duplicates on both sides.)
- [ ] T-ALGO-5: `scoreGuess([R,R,G,Y], [G,R,Y,B]) → {black:1, white:2}`. (Mixed; R@1 exact; G and Y are colour-only matches against the leftover R and G of the secret — B has nothing to match.)
- [ ] T-ORDER-1: After submitting `[Y,B,G,R]` against secret `[R,G,B,Y]` (→ 0B/4W), the feedback cluster renders 4 white dots (no black) — confirmed by `querySelectorAll(".fb.white").length === 4` and order is blacks→whites→greys (the cluster does NOT mirror the guess order).
- [ ] T-SCORE-1: Solve in 1 attempt with streak 0 → score increments by `100 + 0`. Solve in 1 attempt again → next solve adds `100 + 1*5 = 105`.
- [ ] T-SCORE-2: Fail a code (10 wrong) → score unchanged for that code; streak resets to 0.

### Error paths

- [ ] T-QUIT-1: Submit a guess; 200ms later (mid-stagger reveal) click `#quitBtn` → setup screen is visible (`#setup.active`), `__decoder.phase === "IDLE"`, no console errors, no pending timeouts left (`__decoder.pendingTimeouts.length === 0`).
- [ ] T-QUIT-2: Start a game so the `3-2-1` countdown is mid-flow; quit → assert `#countdown.classList.contains("active") === false` and we are on setup.
- [ ] T-RM-1: Stub `window.matchMedia` so `prefers-reduced-motion: reduce` matches; reload the game; complete one solve + one fail; assert rows still populate and tones still fire (`__decoder.lastBeep` records the last `beep(freq, dur)` call).

### Non-functional checks

- [ ] **Accuracy** — the 5 `scoreGuess` fixtures above are the known-good reference; they must all pass before any other tests are considered.
- [ ] **Risk** — no `innerHTML` is used with any value derived from input; all peg colours are taken from a fixed `THEMES` palette by **index** not name; the test hook is read-only.
- [ ] **Compliance** — no PII in console logs; no audit trail required at Prototype tier.
- [ ] **A11y / WCAG 2.5.8** — T-A11Y-1: `#quitBtn.getBoundingClientRect()` width ≥ 48 AND height ≥ 48. T-A11Y-2: focusing each palette button yields a visible focus ring (screenshot at narrow + wide widths). T-A11Y-3: every interactive element has an accessible name (`aria-label` or visible text).

## How to run

No automated harness at Prototype tier. Drive these scenarios using the **`playpad` preview launch config** + `preview_*` MCP tools (see `docs/CONVENTIONS.md` → *Dev commands*).

Helper: `window.__decoder` exposes
```
{ phase, codeIndex, totalCodes, attemptsLeft, secret, rows, score, streak,
  code, pendingTimeouts, lastBeep,
  fillSlot(slotIdx, colorIdx), clearActive(), submit(), forceSecret([a,b,c,d]),
  scoreGuess(secret, guess) }
```

## Definition of done

- [ ] All test cases above pass.
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).
- [ ] `dist/` rebuilt and the deployed copy hard-refreshed (LEARNINGS row 16).
