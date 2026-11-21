# QA Report (Post-Run Findings): Clear-search button

> **Worked example (Phase 4).** Prototype tier → a single combined QA agent covered all four lenses (still independent of the implementer). Shows what a clean report looks like.

**Feature:** Clear-search button
**Ticket:** PLAY-001
**Run at:** 2026-06-21 (round 1)
**Overall result:** ☑ PASS  ☐ FAIL

---

## Gate summary

| Lens (dimension) | Verdict | Findings | Blocking? |
|---|---|---|---|
| ACCURACY | PASS | 0 | n |
| QUALITY | PASS | 1 (LOW) | n |
| COMPLIANCE | PASS | 0 | n |
| RISK (security) | PASS | 0 | n |
| **Tests** | PASS | 3/3 passing | n |

## Findings

### FINDING-2026-06-21-001
- **Severity:** LOW
- **Dimensions:** quality
- **Where:** `SearchBox` — the clear handler repeated the "reset scroll" line already in `onQueryChange`.
- **What:** minor duplication; not a defect.
- **Recommendation:** call the shared `resetList()` helper. *(Applied.)*
- **Recurrence:** new — logged to `docs/findings-ledger.md`.
- **Status:** RESOLVED

## Human summary

The clear button works: it shows only when there's text, restores the full list, resets scroll, and keeps focus. All three tests pass. One tiny duplication was tidied. Safe to ship.

---

### Loop control
PASS → at Prototype tier the persona panel is skipped (self-confirm baseline) → Phase 6 CAPTURE: logged one learning ("reuse `resetList()`") and removed the idea from `IDEAS.md`.
