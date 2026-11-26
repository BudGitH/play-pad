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

## Round 2 — result: **FAIL** (2 HIGH)

Re-verification of round 1: all 5 HIGH fixed; Q-01, Q-03, Q-04, Q-07, ACC-1, ACC-3, ACC-4 and A11Y-01, 03, 05-12 fixed. Partial: ACC-2 (test hooks: ACC2-01/02, stale screenshots ACC2-03), RISK-01 (New game edge: RISK2-01), A11Y-02/04 (toasts over sheets, azan card on short phones), PERF-01/03 (hawker CPU frame still 19-24 ms at 4x; chunking helps little at the mosque). Not fixed: Q-05/Q-06 (function doc blocks, 54 % undocumented), Q-09 (dead exports).

| Severity | Count |
| -------- | ----- |
| HIGH     | 2     |
| MEDIUM   | 5     |
| LOW      | 25    |

### HIGH (blocking)

| ID       | Lens          | Finding                                                                                                  |
| -------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| R2-Q-01  | Quality       | The new Kampung Quest browser specs push the required CI `smoke` job past its timeout.                   |
| A11Y2-01 | Accessibility | On short landscape phones the azan card covers the Talk / "Take wudu" button for the whole azan (~70 s). |

### MEDIUM

- **R2-Q-02** — the AC-14 frame probe runs in no workflow.
- **R2-Q-03** — 54 % of functions lack a Tier-2 doc block; the ledger row is not escalated.
- **A11Y2-02** — the stall sheet's Close button is off-screen at 320 px wide.
- **A11Y2-03** — the wudu tiles are under 48 px at 320 and 360 px wide.
- **A11Y2-04** — the exploring HUD is still heavy on phones.

### LOW

ACC2-01..04, R2-Q-04..07, COMP-R2-01..03, RISK2-01..03, A11Y2-05..10, R2-PERF-01..04 (raw output kept by the orchestrator).

## Round 3

**Run:** 2026-11-26 on HEAD 68f92c4. Six lenses: accuracy, quality, compliance, risk, accessibility-mobile and performance. **Result: PASS (0 CRITICAL, 0 HIGH).** 4 MEDIUM, 18 LOW.

**Tool runs (lens agents' own output):**

- `npm run test:kq`: 155/155.
- kq AC + mobile specs: 52 passed (26.3 min, 1 worker).
- core smoke for Kampung Quest: 2 passed.
- The MUIS times were checked against the data.gov.sg dataset row for 2026-11-26: exact match.

**Re-verified from round 2:**

- **HIGH, both fixed:** R2-Q-01 (the CI split) and A11Y2-01 (the azan card over Talk).
- **Also fixed:** ACC2-01..03, R2-Q-02, R2-Q-04..07, A11Y2-05..09 and R2-PERF-04.
- **Partial:**
  - R2-PERF-02: the 4× gate still has 1.35 slack;
  - A11Y2-10: the spec matrix lacked 667x375 and 640x300.
- **Accepted:** phones narrower than 667 px keep more than 25 % HUD; PERF-07.

| ID                           | Sev    | Lens                | Finding                                                                                                  | Action                                              |
| ---------------------------- | ------ | ------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| ACC3-01                      | MEDIUM | Accuracy            | The tasyahud steps show "raka'at 1 of N" (display only)                                                  | Fix now                                             |
| ACC3-02                      | MEDIUM | Accuracy            | The last mission step speaks the giver's thanks through the wrong NPC (the imam never answers the salam) | Fix now                                             |
| R3-PERF-01                   | MEDIUM | Perf                | Precompiling every tier made the load about 3× slower                                                    | Fix now                                             |
| R3-Q-01                      | MEDIUM | Quality             | Standing: Tier-2 doc rule has no tool. Ledger row at 3× has no PLAY ticket                               | Backfill done (68f92c4). Ticket is the owner's call |
| ACC3-03, COMP-R3-03, R3-Q-06 | LOW    | Accuracy/Compliance | Fallback "Waalaikumsalam" used for everyone (incl. non-Muslim neighbour); reply inverted                 | Fix now                                             |
| R3-Q-02                      | LOW    | Quality             | Phone mission card peeks on every collect / pause                                                        | Fix now                                             |
| A11Y3-01, A11Y3-03           | LOW    | A11y                | Azan card over the mission chip at 667x375; "Missions" label is 2 px too wide                            | Fix now                                             |
| A11Y3-02                     | LOW    | A11y                | The prayer strip has no state text for screen readers                                                    | Fix now                                             |
| ACC3-04                      | LOW    | Accuracy            | No literal-value test of the MUIS times; test-plan line 82 stale                                         | Deferred (ledger)                                   |
| R3-Q-03, R3-Q-04, R3-Q-05    | LOW    | Quality             | Duplicated media queries; round-2 decisions not captured; `Save.clear` result ignored                    | R3-Q-04 at capture; rest deferred                   |
| COMP-R3-01, -02, -04         | LOW    | Compliance          | Tier-1 headers missing in 47 world/figure files; raw CREDITS.md link; ledger missing round-2 LOWs        | -04 at capture; rest deferred                       |
| R3-PERF-02..04               | LOW    | Perf                | Draw-call sweep not deterministic; 4× slack; mosque tris                                                 | Deferred (real-phone run)                           |

Raw output: kept by the orchestrator (session scratchpad).
