# Design Review: Clear-search button (worked example)

> **Worked example (Phase 1b, full path).** A filled sample so you can see what a finished design review looks like. NOTE: at Prototype tier this feature really took the **lite** path; it is shown here as if at Standard tier to demonstrate the format. To start a real feature, copy `features/_TEMPLATE/` — not this folder.

**Feature:** Clear-search button
**Ticket:** PLAY-001
**Date:** 2026-11-21

---

## 1. Diverge — options on the table
> Options live in **`mockups.html`** (open it in a browser). One line each here:

- **Option A — Inline ✕:** clear control inside the field, appears only when text exists.
- **Option B — Button beside:** separate labelled "Clear" button next to the field.
- **Option C — Filter chip:** active search rendered as a removable chip below the field.
- **Option D — Esc shortcut:** keyboard-first clearing with a taught hint.

## 2. PM brief
Business requirement: reduce friction resetting a search so users browse more items per session. Success metric: reset drops from select-all+delete to **one action**. The chosen option must be one-action on **touch**, since the Casual Browser persona is mobile-majority.

## 3. Design Roundtable — converge

| Option | Desirability (UX / persona) | Viability (PM / business) | Feasibility + effort (Tech Lead) | Recommended? |
|---|---|---|---|---|
| A | High — pattern users already know | Meets one-tap metric | Trivial; existing input component | **Yes** |
| B | Medium — discoverable but noisy | Meets metric, costs space | Trivial | No |
| C | Low now — overkill for one query | Future-proof if filters come | Small; new chip component | No (log to `IDEAS.md` for the filters epic) |
| D | Fails touch persona | Misses metric on mobile | Trivial | No |

## 4. Persona review
- **Casual Browser** — prefers A: "it's what search boxes do"; D is invisible on her phone.

## 5. Human decision (the real call)
- **Chosen option:** A — Inline ✕
- **Mockup file:** `mockups.html` · **Chosen tab:** A (states expanded in "Chosen — full states")
- **Decided by:** human (@BudGitH)
- **Date:** 2026-11-21
- **Rationale:** familiar pattern, one tap on touch, zero layout cost. C's chip idea logged to `IDEAS.md` for when filters land.

## Handoff
The chosen option's **"Chosen — full states" tab** in `mockups.html` is now the spec: Phase 2 tests encode its flow/states; Phase 3 builds to it; Phase 5 evaluates the implementation of this option.
