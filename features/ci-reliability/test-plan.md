# Test Plan: CI & release reliability

**Feature:** CI & release reliability
**Ticket:** PLAY-015
**Created:** 2026-11-28

---

## Coverage map (AC → test)

| AC | Test(s) | Type |
| --- | --- | --- |
| AC-1 | `taskset -c 0,1 npx playwright test <the 5 specs> --project=kampung-quest --repeat-each 3` | e2e (local) |
| AC-2 | each `npm run smoke:kq:*` leg once on 2 CPUs locally, then the PR's Probes run on GitHub | e2e (local + CI) |
| AC-3 | inspect workflow: `upload-artifact` step, `if: failure()`, `retention-days`; forced failure check (optional) | config review |
| AC-4 | `taskset -c 0,1 npx playwright test tests/smoke.spec.mjs -g "Kampung Quest" --repeat-each 5` | e2e (local) |
| AC-5 | actionlint; on GitHub, a docs-only PR state (gate green, legs skipped) vs this PR (touches `playwright.config.mjs` → legs run, gate reflects them) | CI |
| AC-6 | inspect `concurrency.cancel-in-progress` expressions in both workflows | config review |
| AC-7 | `npm run ci:local` passes; `git config core.hooksPath` = `.githooks` after `npm install`; `prepare` with `GIT_DIR=/nonexistent` / outside a repo exits 0 | script |
| AC-8 | doc review by the QA COMPLIANCE lens | review |
| AC-9 | `npm run check`, `npm run secrets`, actionlint | lint |

## Test cases

### Happy path

- [ ] All five previously-failing specs pass 3× on 2 CPUs.
- [ ] Every probe leg passes once locally on 2 CPUs.
- [ ] This PR's Probes run: all legs green, `Probes gate` green.

### Edge cases (boundaries)

- [ ] Gate logic: leg results {success, skipped-because-no-change} → pass; {failure} / {cancelled} / {skipped while changes=true} → fail.
- [ ] `prepare` outside git → exit 0.

### Error paths

- [ ] A failing leg uploads `test-results/` (verified by reading the step condition; optionally via a throwaway local `act`-less dry review).

### Non-functional checks

- [ ] **Accuracy:** gate cannot report success when a leg failed (expression reviewed by the ACCURACY lens).
- [ ] **Risk:** permissions stay `contents: read`; actions pinned by SHA; no `pull_request_target`.
- [ ] **Compliance:** brain docs updated.

## How to run

```
npm run check && npm run secrets
taskset -c 0,1 npm run smoke:kq:play1   # … each leg
npm run ci:local
```

## Definition of done

- [ ] All tests above pass.
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).
