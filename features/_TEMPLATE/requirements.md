# Feature: <feature name>

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code. A QA agent will hold the implementation to these criteria — vague requirements produce vague QA.

**Status:** DRAFT
**Owner:** @BudGitH
**Ticket:** PLAY-_\_\_
**Created:** 2026-11-21
**Feature tier:** Standard _(defaults to the project tier; may be raised for this feature; lowering needs a one-line note in `docs/DECISIONS.md`)\_

---

## What & why

- **What:** _One or two sentences. The outcome, not the implementation._
- **Why:** _The user/business need. Link to `docs/IDEAS.md` or `docs/PROJECT.md` if relevant._

## Business requirements & success metrics

> **What the Senior PM verifies in Phase 5A.** State the business outcome in measurable terms — vague business goals produce hand-wavy product validation.

- **Business outcome:** _what must be true for the business once this ships._
- **Success metric:** _the measurable signal it should move (+ current baseline if known). Link to `docs/PROJECT.md` success criteria._
- **Must-have business rules:** _the non-negotiable rules the feature must honour._

## Target personas & success bar

> **Who this feature is for and what "good" means to them.** Name the **1–3 relevant personas** from `docs/PRODUCT-PANEL.md` — only these are spawned for the Phase 5B panel.

- **Personas served:** _e.g. "Busy Parent", "Macro-counter" (from `docs/PRODUCT-PANEL.md`)._
- **Baseline (hard gate):** _the primary goal each must be able to complete._
- **Value (hard gate):** _why this beats their current alternative._
- **High satisfaction (scored, not gated):** _what would make them love it / keep coming back._

## Design routing

> Decides whether the design step (Phase 1b) runs. Skip for non-UI features. **UI surface?** (does the user see/interact with anything new) × **reuse-only?** (built entirely from existing `DESIGN-SYSTEM.md` tokens/components) × **tier** → path.

- UI surface? **_yes/no_** · Reuse-only? **_yes/no_** · Tier **_..._** → **Path: _none / lite / full_**
- **Crosses FE/BE seam?** **_yes/no_** — _if yes: `docs/API-CONTRACT.md` rows updated (link them). If the project has no contract file yet, create it first from the skeleton in `docs/ARCHITECTURE.md` → Boundaries & contracts — the seam gets a contract before it gets acceptance criteria._

## Design review

> **Lite path:** record the quick check here. **Full path:** see `features/<name>/design-review.md`. **None:** "n/a — no UI surface".

- _Checked against `DESIGN-SYSTEM.md`: … · Human OK: …_

## User-visible behaviour

_What does the user see/do? Describe the happy path in plain language._

## Acceptance criteria

> Each criterion must be **testable** — a QA agent should be able to mark it pass/fail with no judgement calls. Use "Given / When / Then" where it helps.

- [ ] AC-1: _..._
- [ ] AC-2: _..._
- [ ] AC-3: _..._

## Edge cases & error states

> The boundaries QA will probe: empty, zero, one, many, max, null, invalid input, offline, concurrent.

- _..._

## Out of scope

- _What this feature deliberately does NOT do._

## Non-functional requirements

- **Accuracy:** _correctness rules, rounding, data integrity._
- **Risk/Security:** _trust boundaries, input validation, sensitive data._
- **Compliance:** _audit trail needed? PII involved? required docs?_
- **Quality:** _performance budget, complexity limits beyond the standard._

## Tech Lead feasibility

> Phase-1 exit check (advisory by default). **Blocks only if:** the requirement is impossible/contradictory, the approach is one Phase-4 RISK would certainly fail, or it conflicts with `docs/ARCHITECTURE.md`. Prototype tier → a one-line note, never blocks.

- **Verdict:** _PROCEED / PROCEED_WITH_NOTES / FEASIBILITY_BLOCK_ — _notes / effort flag._
