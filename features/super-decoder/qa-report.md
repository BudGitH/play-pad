# QA Report — Super Decoder (Post-Run Findings)

> **Phase 4 of the workflow.** Merged + deduped output of the multi-lens QA panel (Accuracy / Quality / Compliance / Risk), plus the end-to-end browser verification. **Gate:** no unresolved CRITICAL/HIGH.

**Feature:** Super Decoder · **Ticket:** PLAY-004 · **Date:** 2026-06-27
**Panel:** 4 independent reviewers, one per lens (ACCURACY · QUALITY · COMPLIANCE · RISK), reviewing `games/super-decoder/index.html`.
**All four panel verdicts:** CLEAN (no CRITICAL/HIGH). Two MEDIUM + four LOW recommendations were **fixed this cycle** (below) rather than ticketed.

---

## Browser verification (preview MCP) — acceptance criteria PASS

| AC | Check | Evidence |
|----|-------|----------|
| AC-1 | Hub card + loads clean | Hub renders "4 games"; Super Decoder card (🔐, green, "Solo/Logic/Code-breaking", players "1"), `<a href="games/super-decoder/">`. No console errors anywhere across a full session. |
| AC-2 | Start always enabled | Defaults Classic + Easy(3); Start → game screen every time. |
| AC-3 | Difficulty = session length | `__decoder.totalCodes` = 3 / 5 / 8 for the three chips. |
| AC-4 | Per-code rules constant | After Start: `attemptsLeft===10`, `secret.length===4`, palette renders exactly 6 buttons — across all difficulties. |
| AC-5 | Per-turn placement | `fillSlot(2,c)` fills slot 2 + auto-advances; tap-filled-slot clears; ⌫ wipes row. |
| AC-6 | Submit gate | `#submitBtn.disabled` true until all 4 slots filled, then false. |
| AC-7 | Feedback algorithm | 5 fixtures (incl. duplicates) → exact B/W. `[R,G,B,Y]/[Y,B,G,R]`→0B/4W; `[R,R,R,R]/[R,G,B,Y]`→1B/0W; `[R,R,G,G]/[R,G,R,G]`→2B/2W; `[R,R,G,Y]/[G,R,Y,B]`→1B/2W; identity→4B/0W. |
| AC-8 | Order doesn't leak position | Feedback cluster renders blacks→whites→greys, never in guess order (`paintFeedbackCluster`). |
| AC-9 | Solve advances | `forceSecret([0,1,2,3])` + match → score 100, solved 1, codeIndex→1. |
| AC-10 | Fail advances | 10 wrong guesses → streak 1→0, secret revealed, advanced. |
| AC-11 | Scoring formula | Solve-in-1 = 100; streak bonus `streak×5` applied on subsequent solves (3-solve perfect run = 295). |
| AC-12 | Quit safety mid-feedback | Submit then quit @150ms → setup visible, phase IDLE, `pendingTimeouts` 4→0, no orphan animation, console clean. |
| AC-13 | 48px quit target | `#quitBtn.getBoundingClientRect()` = 48×48. |
| AC-14 | Countdown teardown in show() | Countdown `.active` cleared inside `show()`; quit-mid-countdown lands on setup. |
| AC-15 | Reduced-motion safe | Functional staggers JS-driven; `lastBeep` records tones fired; rows still populate. |
| AC-16 | Focus ring on palette | Double-stroke `:focus-visible` ring readable on every palette colour. |
| AC-17 | A11y labels | All 6 palette buttons + 40 slots carry `aria-label`; `aria-live` banner + `#srStatus`. |
| AC-18 | Results summary | Perfect session → "295 · 3/3 · 1 try" stats correct. |
| AC-19 | Play again resets | New session → score 0, streak 0, codeIndex 0. |
| AC-20 | Shape redundancy (added) | Every peg + palette button + banner secret carries a distinct shape glyph (●▲■◆★✚) per colour index — colour is not the only signal. Verified: palette + active-row + history pegs all show their shapes. |

---

## Panel findings & resolutions

### Resolved this cycle
- **[MEDIUM · Quality/a11y] Colour was the SOLE signal** for the core mechanic — a colour-blind player couldn't distinguish pegs (CODE_QUALITY §13 "colour is not the only signal"; the whole game is colour discrimination). **Fixed:** added a stable per-colour-index shape glyph (`SYMBOLS = ●▲■◆★✚`), rendered (white with a dark halo for contrast on any colour) inside every board peg, palette button, and the banner secret reveal via a single `makePeg()` helper. New **AC-20** + test row added. Verified in preview (all 6 palette shapes + active/history peg shapes render).
- **[MEDIUM · Quality] `submitGuess` duplicated `renderHistoryRow`'s peg-painting loop and ran ~58 lines** (DRY + rule-7 length). **Fixed:** extracted `paintGuessPegs(rowEl, guess, rowIdx)` used by both; `submitGuess` is now well under the 40-line guideline.
- **[LOW · Quality] Dead `var t` + `void t;` in `renderBoard`** (with a misleading comment referencing a non-existent `drawPeg`). **Fixed:** removed both the var and the `void` line.
- **[LOW · Quality] `/^[1-6]$/` recompiled per keypress.** **Fixed:** hoisted to a module constant `DIGIT_KEY_RE`.
- **[LOW · Risk] `forceSecret` accepted unvalidated indices** that could reach `colors[v]` → CSS `undefined` (local-only test hook; no injection — `style.background` is a structured setter, not a string sink). **Fixed:** added a length + in-range-integer guard mirroring `rollSecret`; rejects bad input (verified `forceSecret([9,-1,'x',null])` → `false`, good input → `true`).

### Accepted (no change) — documented rationale
- **[LOW · Quality] Terse config keys** (`{ l:"Easy", … }`, `colors`/`names`) match the peer (`claw-catch` `RARITY`/`DIFFICULTIES`) house style — consistent, not a regression. Left as-is.
- **[LOW · Quality] `refreshActiveRow` re-stamps all 10 rows + `scrollIntoView` per placement.** At 10 rows this is trivially cheap and degrades to `behavior:"auto"` under reduced-motion. Accepted.
- **[INFO · Risk] `window.__decoder` debug hook** exposes read-only getters + `scoreGuess`/`fillSlot`/`submit`/`forceSecret`. Required by the Phase-2 test plan, harmless at Prototype tier (purely local; `forceSecret` now validates input), consistent with the accepted `window.__claw` precedent. Left in per CONVENTIONS PLAY-001.
- **[INFO · Risk] `_headers` enumerates per-path cache rules for `colour-rush` only, not `super-decoder`.** Affects cache freshness, not security — the `/*` CSP block applies to all paths. Out of scope; noted for the deploy step.

### Explicitly checked and sound (static + dynamic)
- `scoreGuess` is provably duplicate-safe: blacks and whites consume disjoint `sUsed`/`gUsed` slots, so `black + white ≤ 4` always and a full match is exactly 4B/0W. All-same secret/guess handled.
- Scoring uses `session.streak` **before** the post-solve increment → first solve correctly earns no bonus; the `max(10,…)` floor doesn't break the banner's "(streak bonus)" label.
- Attempts accounting has no off-by-one: fail fires exactly at guess 10 (`attemptsLeft===0`), no 11th guess reachable; `session.codeIndex` ends a run after exactly N codes; last code routes straight to results (no orphan interstitial).
- Every `innerHTML` write is a clear (`= ""`) or a static literal wrapping internal **integer** counters (`Tries/Score/Streak`); all content text uses `textContent`/`setAttribute`. No injection surface. No `eval`/`Function`/`on*=`/remote fetch. CSP-clean.
- Zero PII / storage / network (grep: no `localStorage`/`sessionStorage`/`fetch`/`cookie`). Audit trail correctly N/A.
- No findings-ledger recurrences: the 48px `#quitBtn` block and the `show()` teardown chokepoint (the two `TICKET_REQUIRED` patterns) are both correctly applied — neither escalates.
- Registry + `docs/ARCHITECTURE.md` + `docs/IDEAS.md` all in sync.

---

## Gate: **CLEAN** ✓ — no unresolved CRITICAL/HIGH. Cleared to Phase 5.
