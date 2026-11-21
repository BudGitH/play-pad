# Design Review: <feature name>

> **Phase 1b output — full design path only.** Produced _before_ building, to choose the UI approach. The pre-build counterpart to `product-validation.md` (which judges the built result). Roles are spawned from `docs/PRODUCT-PANEL.md`; visual rules from `docs/DESIGN-SYSTEM.md`. (Lite-path changes are recorded in `requirements.md` → _Design review_, not here.)

**Feature:** <feature name>
**Ticket:** PLAY-\_\_\_
**Date:** 2026-11-21

---

## 1. Diverge — 4 concrete mockups

> The options live in **`mockups.html`** (copied from `features/_TEMPLATE/mockups.html` — its embedded comments are the generation spec). Four options differing in **information architecture, not styling**, built from real `requirements.md` content on the shared token set. Open the file to review; summarise each in one line here:

- **Option A — <name>:** _interaction shape in a sentence._
- **Option B — <name>:** _..._
- **Option C — <name>:** _..._
- **Option D — <name>:** _..._

## 2. PM brief

> Senior PM frames the business requirement + success metric the chosen option must serve (one short paragraph).

## 3. Design Roundtable — converge

> Senior Tech Lead + Senior PM + Senior UX Designer. The Tech Lead **inherits the Phase-1 feasibility verdict** — it does not re-open "can we build the requirement at all"; it only costs each _option_.

| Option | Desirability (UX / persona) | Viability (PM / business) | Feasibility + effort (Tech Lead) | Recommended? |
| ------ | --------------------------- | ------------------------- | -------------------------------- | ------------ |
| A      | _..._                       | _..._                     | _..._                            | _..._        |
| B      | _..._                       | _..._                     | _..._                            | _..._        |

## 4. Persona review

> The target personas react to the converged options — which best lets them do their job, which they'd prefer.

- _persona — preference + why._

## 5. Human decision (the real call)

> **Interactive:** present the options to the human, who picks. **Headless:** auto-select the **Recommended** option and stamp it. **Interactive but no response:** stop here — set `Status: BLOCKED — AWAITING DESIGN DECISION`; do not guess.

- **Chosen option:** _A / B / C / D (or a mix — "A's layout with D's detail panel" is valid)_
- **Mockup file:** `mockups.html` · **Chosen tab:** \_\_\_
- **Decided by:** _human <handle> / auto-selected (headless — mockups still generated first, so the auto-decision is on record)_
- **Date:** 2026-11-21
- **Rationale:** _one line._

## Handoff

After the decision, **expand the chosen option's states** (empty · loading · error · disabled) in `mockups.html`'s "Chosen — full states" tab. **That tab is now the spec:** Phase 2 tests encode it; Phase 3 builds to it; Phase 5 evaluates the implementation of this option (it does not re-open the design).
