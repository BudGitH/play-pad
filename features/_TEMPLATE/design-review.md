# Design Review: <feature name>

> **Phase 1b output — full design path only.** Produced *before* building, to choose the UI approach. The pre-build counterpart to `product-validation.md` (which judges the built result). Roles are spawned from `docs/PRODUCT-PANEL.md`; visual rules from `docs/DESIGN-SYSTEM.md`. (Lite-path changes are recorded in `requirements.md` → *Design review*, not here.)

**Feature:** <feature name>
**Ticket:** PLAY-___
**Date:** 2026-06-21

---

## 1. Diverge — options on the table
> Senior UX Designer + the feature's target personas brainstorm 2–3 distinct approaches. Each must conform to `DESIGN-SYSTEM.md`.

- **Option A — <name>:** _approach in a sentence._
- **Option B — <name>:** _..._
- **Option C — <name>:** _..._

## 2. PM brief
> Senior PM frames the business requirement + success metric the chosen option must serve (one short paragraph).

## 3. Design Roundtable — converge
> Senior Tech Lead + Senior PM + Senior UX Designer. The Tech Lead **inherits the Phase-1 feasibility verdict** — it does not re-open "can we build the requirement at all"; it only costs each *option*.

| Option | Desirability (UX / persona) | Viability (PM / business) | Feasibility + effort (Tech Lead) | Recommended? |
|---|---|---|---|---|
| A | _..._ | _..._ | _..._ | _..._ |
| B | _..._ | _..._ | _..._ | _..._ |

## 4. Persona review
> The target personas react to the converged options — which best lets them do their job, which they'd prefer.

- _persona — preference + why._

## 5. Human decision (the real call)
> **Interactive:** present the options to the human, who picks. **Headless:** auto-select the **Recommended** option and stamp it. **Interactive but no response:** stop here — set `Status: BLOCKED — AWAITING DESIGN DECISION`; do not guess.

- **Chosen option:** _A / B / C_
- **Decided by:** _human <handle> / auto-selected (headless)_
- **Date:** 2026-06-21
- **Rationale:** _one line._

## Handoff
The chosen option is now the spec: **Phase 2 tests must encode this** flow/states/components; **Phase 3** builds to it; **Phase 5** evaluates the implementation of this option (it does not re-open the design).
