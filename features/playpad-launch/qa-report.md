# QA Report (Post-Run Findings): PlayPad launch — hub + MD3 system + Colour Rush

> **Phase 4 output.** Produced by merging an independent multi-lens QA panel (ACCURACY · QUALITY · COMPLIANCE · RISK · +ACCESSIBILITY) with **adversarial verification of every finding**, then a round-2 re-verification after fixes. The panel was run as a background workflow; agents read the real source and could not be waved through by the implementer.

**Feature:** PlayPad launch (PLAY-001)
**Ticket:** PLAY-001
**Run at:** 2026-06-21 — round 1 (find) + round 2 (re-verify)
**Overall result:** ☑ PASS (round 2 — zero open CRITICAL/HIGH; all MEDIUM resolved; LOWs resolved or logged as deliberate deviations)

---

## Gate summary

### Round 1 (initial panel)

| Lens (dimension)            | Agent verdict | Findings                                                                                      | Blocking?        |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------- | ---------------- |
| ACCURACY                    | PASS          | 0                                                                                             | no               |
| QUALITY                     | PASS          | 4 (1 MED, 3 LOW)                                                                              | no               |
| COMPLIANCE                  | PASS          | 1 (LOW)                                                                                       | no               |
| RISK (security)             | PASS          | 2 (LOW)                                                                                       | no               |
| **ACCESSIBILITY** (UI lens) | **FAIL**      | 6 (1 HIGH, 4 MED, 1 LOW)                                                                      | **yes (1 HIGH)** |
| **Tests**                   | N/A → static  | no harness at Prototype tier (dev commands `TBD`) — fell back to static review + live preview | no               |

### Round 2 (after fixes — re-verification panel, 7 adversarial agents)

| Item                                              | Result                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| All 6 accessibility findings                      | **RESOLVED**, no regression                                      |
| Empty-catch / spacing / esc LOWs                  | **RESOLVED**                                                     |
| Tier-1 header / Tier-2 doc-block LOWs             | **Logged as deliberate Prototype deviation** in `CONVENTIONS.md` |
| New LOW found in round 2 (control-char URL strip) | **RESOLVED** (`safeHref` now strips `\x00–\x1F\x7F`)             |
| Holistic regression sweep                         | **No regressions**                                               |

**Tests run:** none automated (Prototype tier, `CONVENTIONS.md` → Dev commands = `TBD`). Validation = static multi-lens review + live preview (`http://localhost:5500`): both themes render, no console errors, card→game→back nav works, game boots and the loop runs.

---

## Findings (round 1) → resolution

### FINDING-2026-06-21-001 · focus-ring-override @ games/colour-rush (`.swatch`)

- **Severity:** HIGH (confirmed) — **Dimensions:** quality, accessibility
- **What:** `.swatch { outline: 2.5px solid transparent }` (inline, later in source) overrode the global `:focus-visible` ring at equal specificity → unselected colour swatches showed **no keyboard focus indicator** during a _required_ setup step (blocks persona Sam).
- **Fix:** added `.swatch:focus-visible { outline: 3px solid var(--md-sys-color-primary); outline-offset: 2px; }` after the selected-state rule (specificity 0,2,0 beats both).
- **Recurrence:** new (1st). **Status:** ✅ RESOLVED (round-2 confirmed).

### FINDING-2026-06-21-002 · viewport-zoom-block @ games/colour-rush

- **Severity:** MEDIUM (HIGH→MED on verify; iOS 16.4+ ignores it) — **Dimensions:** accessibility
- **What:** game viewport used `maximum-scale=1, user-scalable=no` → blocked pinch-zoom (WCAG 1.4.4 / 1.4.10).
- **Fix:** viewport now `width=device-width, initial-scale=1, viewport-fit=cover`; gesture suppression during play stays element-scoped via `touch-action` on `#playArea`/`.dot`.
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-003 · tap-target-size @ games/colour-rush (`#quitBtn`)

- **Severity:** MEDIUM — **Dimensions:** accessibility
- **What:** Quit (✕) was 36×36px, below the 48px floor (WCAG 2.5.8 / DESIGN-SYSTEM).
- **Fix:** `#quitBtn` is now a 48×48 target with a 36px visual circle drawn by `::before` (z-index layering keeps the ✕ above the circle, circle above the topbar).
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-004 · listitem-role-on-link @ index.html (`cardHTML`)

- **Severity:** MEDIUM — **Dimensions:** accessibility
- **What:** the live card `<a>` carried `role="listitem"`, overriding its implicit **link** role → dropped from screen-reader link rotor.
- **Fix:** removed `role="list"`/`role="listitem"` from the track, cards, and chips; cards are plain `<a href>` (the "soon" card stays a non-focusable `<div aria-disabled>`).
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-005 · reduced-motion-lifespan @ games/colour-rush + base.css

- **Severity:** MEDIUM — **Dimensions:** accessibility, accuracy
- **What:** under `prefers-reduced-motion`, the global `animation-duration: 0.001ms !important` collapsed the `dotlife` animation, so dots fired `animationend` instantly and vanished before they could be tapped → core loop unplayable for reduce-motion users.
- **Fix:** JS detects reduced motion (`matchMedia`); in that branch dots get `.dot--static` (`animation: none`, visible) and are removed via `setTimeout(lifeMs)` instead of `animationend`. Tapped dots still pop+remove via `.dot.tapped`'s `!important` duration. `removeDot` is idempotent. (Round-2 agent traced the full cascade incl. the global rule — robust.)
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-006 · empty-catch @ games/colour-rush (`beep()`)

- **Severity:** MEDIUM — **Dimensions:** quality (Non-Negotiable #8)
- **What:** bare `}catch(e){}` swallowed audio errors with no explanatory comment.
- **Fix:** `}catch(e){ /* a single missed beep must never interrupt gameplay */ }`.
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-007 · url-scheme + attr-quote encoding @ index.html (`esc`/`safeHref`)

- **Severity:** LOW (defense-in-depth; not exploitable — registry is author-controlled, no runtime untrusted input) — **Dimensions:** risk
- **What:** `esc()` didn't encode `'` or block `javascript:`-scheme URLs in the live card `href`; round-2 also noted control chars (`java\nscript:`) could re-collapse to a live scheme.
- **Fix:** `esc()` now encodes `'`; new `safeHref()` strips control chars (`\x00–\x1F\x7F`) then allows only relative or `http(s)` URLs (others → `#`); the live href is `esc(safeHref(g.path))`. Comment notes `esc()` is HTML-context-only.
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-008 · raw-px-spacing @ styles/base.css

- **Severity:** LOW — **Dimensions:** quality
- **What:** shared component rules used raw px where spacing tokens exist (the "never raw values" rule isn't colour-only); base.css header over-claimed "nothing is hardcoded".
- **Fix:** on-grid values tokenized (`48→2xl`, `24→lg`, `8→sm`, `4→xs`); header reworded to acknowledge the few intentional off-grid (6/12px) component paddings.
- **Recurrence:** new. **Status:** ✅ RESOLVED.

### FINDING-2026-06-21-009 · tier1-header / tier2-doc-blocks @ all source; pointer-only-play; minor smells

- **Severity:** LOW — **Dimensions:** quality, compliance, accessibility
- **What:** files lack full Tier-1 headers / per-function Tier-2 doc blocks (CODE_QUALITY §3); the spatial tap loop is pointer-only (no AT play path); minor smells (un-throttled resize, `bump()` timing vs token).
- **Fix / disposition:** Tier-1/Tier-2 relaxation **logged as a deliberate Prototype deviation** in `CONVENTIONS.md` (PLAY-001). Pointer-only play **documented** as a known limitation (`design-review.md` / requirements out-of-scope) + an `aria-live` status now announces the round outcome to AT. Resize handler re-wired to the rAF-throttled `onScroll`; `bump()` timing nit left as accepted tech-debt.
- **Recurrence:** new. **Status:** ✅ RESOLVED / accepted.

---

## Blocker classification → response

| Severity | ACCURACY         | QUALITY            | COMPLIANCE          | RISK             |
| -------- | ---------------- | ------------------ | ------------------- | ---------------- |
| CRITICAL | hotfix now       | stop-ship          | stop-ship           | stop-ship        |
| HIGH     | blocks feature   | blocks feature     | blocks feature      | blocks feature   |
| MEDIUM   | fix next release | ticket, ≤2 cycles  | ticket, ≤1 cycle    | ticket, ≤1 cycle |
| LOW      | backlog          | tech-debt register | compliance register | risk register    |

The single HIGH (swatch focus ring) blocked the feature in round 1 and was fixed before proceeding, per the loop rule.

## Human summary

The independent panel passed correctness, code-quality, compliance, and security, but the accessibility lens **failed the first round** on a real blocker — keyboard users couldn't see which colour swatch was focused — plus a cluster of medium issues (pinch-zoom disabled, an undersized quit button, a mislabeled card link, and reduced-motion making the game unplayable). All were fixed and **re-verified by a second adversarial panel that confirmed each fix and found no regressions**; the remaining low-severity items were either fixed or formally logged as accepted Prototype-tier deviations. **The feature is QA-clean and ready for product validation.**

---

### Loop control

Round 1 had an open HIGH → fixed → round-2 panel re-spawned → **Overall result = PASS**. Proceed to **Phase 5 (Product & UX validation)** → `product-validation.md`, then **Phase 6 (Capture)**.
