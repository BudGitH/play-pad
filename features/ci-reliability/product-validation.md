# Product & UX Validation: CI & release reliability

**Ticket:** PLAY-015 · **Date:** 2026-11-28 · **Evidence:** PR #29 head `0e1ccad`. All 23 checks are green, and all 13 Probes legs passed on their first attempt (no retries).

## 5A — Senior PM: **PASS** (with conditions)

- Business outcome met on the PR head. A red result now stops the merge: on the previous head, play3 failed, the test results were uploaded, and the gate failed when that run was cancelled.
- Must-have rules held. Every spec change is classified in `notes-specs.md`, and nothing was skipped or loosened.
- **Conditions:**
  - (1) Owner creates the `main` ruleset (PR-STANDARD 4.1).
  - (2) Check that the merge push and the next nightly run are green; if either is red, open a ticket and add it to the findings ledger.
- **Not yet proven:** the success metric's "green on main and nightly" part, and how often the 120 s floor holds over repeated runs (one sample so far). actionlint was not run (the safety policy refused the binary download).

## 5B — Persona: You, "The Builder-Owner"

| Bar             | Result  | Evidence                                                                                                                                                                                                                                                           |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline (gate) | **Met** | `Probes gate` always reports, and the full list of required checks is short and written down (4.1). `npm run ci:local` mirrors the `check` and `smoke` jobs. Caveat: the KQ AC and Phone legs and the probe legs are separate commands, all listed in CONVENTIONS. |
| Value (gate)    | **Met** | 13/13 legs green, and each earlier failure traced to a cause: real-time timers against software-GL frames, test budgets too small, a hook-load race. Docs-only PRs get a passing gate.                                                                             |
| Satisfaction    | 4/5     | Failure test results are uploaded, and 4.1 fits on one screen. Points lost: legs take about 12 min, KQ traces are off, and the ruleset is a manual step.                                                                                                           |

## Round table

Not needed (no baseline or value blocker).

## Non-blocking feedback → `docs/IDEAS.md`

Track leg duration and flakiness per run; a `ci:local` variant that also runs the KQ AC and Phone legs; a one-line recipe for re-running a failed leg's spec from its uploaded test results. (A post-deploy live smoke and a Cloudflare-like `serve.mjs` are already in IDEAS.)
