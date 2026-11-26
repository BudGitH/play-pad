# QA report — Kampung Quest (PLAY-013)

> Phase 4 Post-Run Findings Report. Merged + deduped from 6 independent lenses.
> Round 1: 2026-11-26 · Lenses: ACCURACY, QUALITY, COMPLIANCE, RISK, ACCESSIBILITY/MOBILE, PERFORMANCE.

## Round 1 — result: **FAIL** (5 HIGH)

| Severity | Count |
| -------- | ----- |
| CRITICAL | 0     |
| HIGH     | 5     |
| MEDIUM   | 21    |
| LOW      | 25    |

### HIGH (blocking)

| ID      | Lens          | Finding                                                                                                             | Fix owner            |
| ------- | ------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- |
| ACC-1   | Accuracy      | Hawkers Ali / Aminah cannot be Talk-targeted at their stalls (counter always wins) → 2 missions unacceptable by day | gameplay agent       |
| Q-01    | Quality       | `contract.md` not Prettier-formatted → CI `check` fails                                                             | fixed (orchestrator) |
| Q-02    | Quality       | Most browser ACs have no automated test (test plan "probe pending")                                                 | perf/probe agent     |
| A11Y-01 | Accessibility | Phone landscape: dock overlaps coins chip; Pause / Bag cannot be tapped                                             | HUD agent            |
| PERF-01 | Performance   | No AC-14 perf probe; 4×-throttled main-thread frame 18–22 ms (borderline)                                           | perf/probe agent     |

### MEDIUM (fixing this round)

- **ACC-2** — root cause of the "Isyak time!" at 07:10 / 12:55 screenshots: the test hook `setMinute` jumped the clock backwards. Not reachable in natural play. Fix: rebuild the prayer tracker on a backwards jump or a mismatched save.
- **Q-03** — a texture 404 over http leaves a blank material (fallback only on file://).
- **Q-04** — sim unit tests not run in CI.
- **Q-05 / Q-06** — standing enforcement rows; function-level doc blocks are thin.
- **Q-07** — the shipped prayer-time / azan data files are untested.
- **COMP-001** — a real brand name ("Milo") on the sign and menu.
- **COMP-002** — azan CC BY-SA credit visible only on the title screen.
- **COMP-003** — capture docs pending.
- **RISK-01** — no cross-tab save guard (ledger `multi-tab-save-overwrite`, 3×).
- **A11Y-02..07** — toast, Walk-closer bubble and azan card overlaps on phones; action-label contrast 2.49:1; prayer strip overflow on narrow phones; no screen-reader announcements for the azan or steps.
- **PERF-02..04** — draw calls under-counted (shadow pass); whole-map merged batches defeat culling; shader recompiles on auto-downgrade.

### LOW

Tracked in the raw panel output and fixed where cheap: ACC-3/4, Q-08..12, COMP-004..009, RISK-02..04, A11Y-08..12, PERF-05..08.

## Verified OK (round 1)

- Prayer times match the MUIS row on data.gov.sg (`2026-11-26,Thurs,05:29,06:51,12:54,16:17,18:54,20:08`).
- Raka'at plans, the 12-step wudu order and the Subuh window ending at Syuruk are correct.
- A full Zohor flow and 3 missions were driven end to end in the real game; 125/125 sim tests pass.

## Round 2

_Pending — the panel re-runs after the fixes land._
