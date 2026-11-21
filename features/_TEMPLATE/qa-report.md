# QA Report (Post-Run Findings): <feature name>

> **Phase 4 output.** Produced by **merging** the multi-lens QA panel (ACCURACY · QUALITY · COMPLIANCE · RISK). This is the feature's "pipeline result". It is the gate: the feature is not done until this report is clean.

**Feature:** <feature name>
**Ticket:** PLAY-\_\_\_
**Run at:** 2026-11-21 (round 1)
**Overall result:** ☐ PASS ☐ FAIL

---

## Gate summary

| Lens (dimension) | Agent verdict | Findings      | Blocking? |
| ---------------- | ------------- | ------------- | --------- |
| ACCURACY         | _PASS/FAIL_   | _n_           | _y/n_     |
| QUALITY          | _PASS/FAIL_   | _n_           | _y/n_     |
| COMPLIANCE       | _PASS/FAIL_   | _n_           | _y/n_     |
| RISK (security)  | _PASS/FAIL_   | _n_           | _y/n_     |
| **Tests**        | _PASS/FAIL_   | _x/y passing_ | _y/n_     |

## Findings

> One block per finding. Severity ∈ {CRITICAL, HIGH, MEDIUM, LOW}. Dimensions are the lenses it scored on. Check the ledger for recurrence.

### FINDING-2026-11-21-001

- **Severity:** _HIGH_
- **Dimensions:** _quality, risk_
- **Where:** `path/to/file` — _what/which pattern_
- **What:** _the problem, concretely._
- **Recommendation:** _the fix; reference `docs/CODE_QUALITY.md` section._
- **Recurrence:** _new / Nth occurrence — update `docs/findings-ledger.md`._
- **Status:** OPEN

## Blocker classification → response

| Severity | ACCURACY         | QUALITY            | COMPLIANCE          | RISK             |
| -------- | ---------------- | ------------------ | ------------------- | ---------------- |
| CRITICAL | hotfix now       | stop-ship          | stop-ship           | stop-ship        |
| HIGH     | blocks feature   | blocks feature     | blocks feature      | blocks feature   |
| MEDIUM   | fix next release | ticket, ≤2 cycles  | ticket, ≤1 cycle    | ticket, ≤1 cycle |
| LOW      | backlog          | tech-debt register | compliance register | risk register    |

## Human summary

_2–3 plain sentences: what was checked, what passed, what blocks, what's next. Written so a non-engineer understands the state._

---

### Loop control

If any CRITICAL/HIGH is OPEN → **FIX**, then re-spawn the panel and add a new round below. Repeat until **Overall result = PASS**. Then proceed to **Phase 5 (PRODUCT & UX VALIDATION)** — see `features/<feature-name>/product-validation.md` — and only after that gate passes, to **Phase 6 (CAPTURE)**: append learnings, update the map, update the ledger.
