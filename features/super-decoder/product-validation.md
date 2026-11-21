# Product & UX Validation — Super Decoder

> **Phase 5 of the workflow.** 5A = Senior PM gate (must PASS before personas run). 5B = target personas score baseline / value / satisfaction. 5C = remediation round table for any baseline/value-blocking critical. **Gate:** baseline AND value met for every persona; satisfaction is scored, not gated.

**Feature:** Super Decoder · **Ticket:** PLAY-004 · **Date:** 2026-06-27
**Personas (from `docs/PRODUCT-PANEL.md`):** Dan — Office Micro-breaker · Maya — Commuter Casual · Sam — Keyboard/AT user.

---

## 5A — Senior PM gate: **PASS**

- **Verdict:** PASS (no blocking issues).
- **Outcome:** delivers the business requirement — PlayPad's first logic/puzzle game, added via a single `games.js` object (no `index.html` edit), playable with no install/signup. Moves the "one-object registry add" success metric.
- **Non-blocking note (LOW, deploy hygiene):** `_headers` enumerates per-path cache rules for `colour-rush` only, not `super-decoder` (the `/*` CSP block still covers all paths — affects cache freshness only). Logged for the deploy step.
- **Evidence anchor:** *"Adding a 4th game is a one-object change to `games.js`"* — confirmed at `games.js:60–71`.

## 5B — Persona panel

| Persona | Baseline | Value | Satisfaction | Blocking critical? |
|---|---|---|---|---|
| **Dan** — Office Micro-breaker | met | partial | 4 / 5 | none (tuning → backlog) |
| **Maya** — Commuter Casual | met | partial | 3 / 5 | none (mood-fit → backlog) |
| **Sam** — Keyboard/AT user | met | **met*** | 4 / 5 | **1 raised → fixed → re-validated** |

\* Sam's value was *partial* on first pass with one value-blocking critical; after the 5C fix it re-validated to **met**.

**Dan:** "Tight, clever little brain-reset that plays great on a keyboard — I'd come back, but give me a guaranteed-short round so a bad streak doesn't eat my whole coffee break." Partial value = worst-case a stumped 3-code Easy session can overrun a 2-minute break; no blocking critical (he can always quit; common case fits).

**Maya:** "Opens instantly and plays fine with my thumb — clever little code-cracker, but it's a sit-down-and-think game, not my reflex train filler." Baseline (instant one-handed start) fully met; partial value is mood-fit, not a defect — she confirmed the feature delivers the *required* logic/puzzle value.

**Sam:** "The code finally tells me what it was — I get the same 'aha' a sighted player gets, so this clears my bar; ship it." (after fix).

## 5C — Remediation round table (PM + UX + Sam)

**Blocking critical (Sam, value):** on a solved/failed code the revealed secret was painted only as visual pegs — `announce()` said "the secret is revealed" but never spoke *what the code was*, so a screen-reader user lost the deduction payoff (violates Sam's value bar: "read the code without relying on colour / labels read correctly").

**Plan → fix (back to implementation):**
- Added `secretWords()` → maps `code.secret` to spoken colour names via `curTheme().names`.
- `resolveCode` now speaks the code in words on **both** branches — fail: *"Code failed. The code was blue, blue, blue, blue. Streak reset."*; solve: *"Code solved in 1 try. The code was red, orange, yellow, green. Plus 100 points."*
- `showBanner` sets `#bannerCode`'s `aria-label` to "The code was <names>" so AT inspecting the banner also gets it.

**Re-validation (Sam):** Value → **met**, CRITICAL → **resolved**, satisfaction 4. Round table closed in **1 round** (cap is 3). Verified live: `#srStatus` carried the spoken secret on both paths; no console errors.

---

## Gate: **PASS** ✓

Every persona's **baseline** met; the single **value-blocking critical** (Sam) fixed and re-validated to met; Dan's & Maya's *partial* values carried no blocking critical and their items are logged to `docs/IDEAS.md`. Satisfaction (4 / 3 / 4) recorded, not gated.

## Non-blocking feedback → `docs/IDEAS.md`

- **Quick / 1-code round** (Dan + Maya): a guaranteed-short option (or a per-code soft time cap) so a between-meetings / commute player gets a reliably short session.
- **Skippable countdown + tap-through banner** (Dan): the 3-2-1-GO and the between-code banner hold pad a turn-based puzzle; let them be skipped to keep momentum.
- **Bigger active-row slots on mobile** (Maya): the 34px board slots are fiddly for correcting one peg one-handed; widen the active row.
- **Tap-colour-then-slot placement** (Maya): an alternative to pre-selecting the slot — fewer precise taps for a one-handed player.
- **Focused-slot keyboard targeting** (Sam): let a focused slot accept a number key (today placement always hits `code.activeSlot`; editing a specific slot needs Backspace-walk).
- **Feedback-cluster SR text** (Sam): give each feedback cluster its own `aria-label` (e.g. "feedback: 2 black, 1 white") so a past row is inspectable on focus, not only via the transient live region.
