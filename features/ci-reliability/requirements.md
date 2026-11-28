# Feature: CI & release reliability

> **Phase 1 of the workflow.** Define what "done" means _before_ writing code.

**Status:** APPROVED (owner: "go with recommendations", 2026-11-28)
**Owner:** @BudGitH
**Ticket:** PLAY-015
**Created:** 2026-11-28
**Feature tier:** Standard

---

## What & why

- **What:** make `main` green again and make the pipeline trustworthy enough that a red check can block a merge: fix or re-baseline the Kampung Quest specs that fail repeatedly, stabilise the heavy software-GL probe legs, add an always-reporting Probes gate, stop cancelling `main` runs, document release + rollback, and give contributors one local command that mirrors CI.
- **Why:** on 2026-11-28 PR #28 merged while its Probes run was red (play 1-3, core 2). Probes is now red on `main`; the KQ boot step in CI smoke flaked on PRs #27 and #28; nothing gates a merge, so Cloudflare deploys whatever lands. Investigation: this session's report (failures table + 8 root causes).

## Business requirements & success metrics

- **Business outcome:** every commit Cloudflare deploys from `main` has a complete, green set of checks, and a red check is a real signal (not noise to be ignored).
- **Success metric:** baseline = Probes red on `main` (4 of 10 legs) and 1 recurring smoke flake. Target = all Probes legs green on the PR head, on the merge to `main` and on the next nightly; KQ smoke boot passes without needing a retry.
- **Must-have business rules:**
  - Never skip, delete or weaken a test just to get green. A spec may change only when it asserts outdated behaviour (with the reason recorded) or when its wait is timing-fragile (it becomes a condition wait, not a longer sleep). If a failure is a real game bug, fix the game.
  - Fork-safe CI stays: `pull_request` (not `_target`), read-only token, no secrets.
  - Build-free: no new runtime dependencies; dev-only tooling only.

## Target personas & success bar

- **Personas served:** You — "The Builder-Owner".
- **Baseline (hard gate):** can tell from one required check ("Probes gate") whether a PR is safe to merge, and can reproduce CI locally with one documented command.
- **Value (hard gate):** red means broken, so branch protection can be switched on without blocking unrelated PRs forever.
- **High satisfaction (scored):** failures leave a trace or report to diagnose; the merge, release and rollback steps fit on one screen.

## Design routing

- UI surface? **no** · Reuse-only? n/a · Tier Standard → **Path: none**
- **Crosses FE/BE seam?** no

## Design review

- n/a — no UI surface.

## Acceptance criteria

- [ ] **AC-1 (main green):** the specs that failed repeatedly at `b7bb460` — `kampung-quest-map` (~378 "You are here: Library"), `kampung-quest-vehicles` (~231 "Let's walk inside the masjid"), `kampung-quest-actions` (~119 AC-P24.1), `kampung-quest-haramain-world` (~290) and `kampung-quest-rituals` (~273) — pass locally 3× in a row on 2 CPUs (`taskset -c 0,1`, `--repeat-each 3`). Every change is classified as a real bug fix, an outdated spec or a timing-fragile wait, and recorded in `notes-specs.md`.
- [ ] **AC-2 (leg stability):** each Probes leg (play 1-3, core 1-2, realism, perf) passes on a GitHub runner on the PR head, with no "Target page, context or browser has been closed" crash. Locally on 2 CPUs, each leg passes once.
- [ ] **AC-3 (diagnosable):** when a Playwright-based leg or the CI smoke/KQ jobs fail, the `test-results/` folder (with traces or screenshots) is uploaded as an artifact (`if: failure()`, retention ≤ 7 days). Nothing is uploaded on success, and nothing uploaded contains secrets.
- [ ] **AC-4 (KQ boot flake):** the CI smoke test "Kampung Quest reaches its in-round state" waits on a readiness condition with enough budget for 2-core runners. It passes 5/5 locally on 2 CPUs.
- [ ] **AC-5 (Probes gate):** Probes triggers on every PR and push to `main` with no workflow-level `paths:`. A first job decides from the changed files whether the probe legs run, using the same path list as today. A final job **`Probes gate`** always runs and reports: it fails if any leg failed or was cancelled, and passes when every leg passed or was skipped because nothing relevant changed. Schedule and `workflow_dispatch` always run every leg.
- [ ] **AC-6 (no cancelled main runs):** `ci.yml` and `probes.yml` cancel in-progress runs only for `pull_request` events, never for pushes to `main`.
- [ ] **AC-7 (local parity):** `npm run ci:local` runs secrets, check, test:kq and smoke:core in CI order and exits non-zero on the first failure. `npm install` sets `core.hooksPath` to `.githooks` through a `prepare` script, and is a no-op outside a git checkout (e.g. a tarball), so it never fails `npm ci` in CI.
- [ ] **AC-8 (release docs):** `docs/PR-STANDARD.md` has a "Merge & release checklist" (which checks must be green, verify the deploy, how to roll back via the Cloudflare dashboard or `git revert` of the squash commit). `docs/ENFORCEMENT.md` and `docs/CONVENTIONS.md` match reality: what is required, what is advisory, every probe leg command, and `ci:local`. It also lists the owner's branch-ruleset step (required: check, smoke, Kampung Quest (AC), Kampung Quest (Phone), PR title, Probes gate).
- [ ] **AC-9 (hygiene):** `npm run check` and `npm run secrets` pass. Workflow YAML is valid (actionlint if available). Action versions stay pinned by SHA, like the existing workflows.

## Edge cases & error states

- A PR touching only docs: the probe legs are skipped, and the gate still reports success.
- A PR touching `games/**`: all legs run, and the gate fails if any one leg fails.
- A leg is cancelled or times out: the gate fails, because cancelled is not success.
- A push to `main` arrives while an earlier `main` run is still going: both complete.
- `prepare` in CI (`npm ci`), or outside git: it must not fail.

## Out of scope

- Post-deploy live-site smoke + version stamp (follow-up PR, recommendation #6).
- Making `tools/serve.mjs` emulate `_headers` / `_redirects` (follow-up; recorded in IDEAS).
- Turning on branch protection — owner action in GitHub Settings once the gate exists.

## Non-functional requirements

- **Accuracy:** the gate's pass/fail must exactly reflect the leg results (no false green).
- **Risk/Security:** no new secrets or write permissions; third-party actions pinned by SHA; artifacts contain test output only.
- **Compliance:** brain docs updated (LEARNINGS, DECISIONS, findings-ledger, ARCHITECTURE file map).
- **Quality:** a leg should take ≤ ~20 min on a GitHub runner; no leg raises its timeout beyond 30 min.

## Tech Lead feasibility

- Advisory: feasible. Gate pattern = a `changes` job (git diff against the base) → matrix `needs: changes` with `if:` → a `gate` job with `needs: [changes, probes]` and `if: always()` that checks `needs.probes.result`. Skipped legs make the matrix result `skipped`, which the gate treats as pass only when `changes` said "no relevant change". Risk: the software-GL crash root cause may need more than the launch flags. Mitigation: fewer specs per leg plus `workers: 1`. Measure, don't guess.
