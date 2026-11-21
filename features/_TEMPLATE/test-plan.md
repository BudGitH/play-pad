# Test Plan: <feature name>

> **Phase 2 of the workflow.** Tests define "done". Write them (and the test cases below) before the implementation is finished. Every acceptance criterion maps to at least one test.

**Feature:** <feature name>
**Ticket:** PLAY-___
**Created:** 2026-06-21

---

## Coverage map (AC → test)

| Acceptance criterion | Test(s) | Type |
|---|---|---|
| AC-1 | _test name_ | unit / integration / e2e |
| AC-2 | _test name_ | _..._ |

## Test cases

### Happy path
- [ ] _..._

### Edge cases (boundaries)
> zero · one · many · max · null/undefined · empty · negative · special chars · timezone edges
- [ ] _..._

### Error paths
> Each invalid input asserts the **specific** error/behaviour, not just "it fails".
- [ ] _..._

### Non-functional checks
- [ ] **Accuracy:** _calculations/data verified against a known-good reference._
- [ ] **Risk:** _injection/auth/validation probes for any trust boundary._
- [ ] **Compliance:** _audit record emitted where required; no PII in logs._

## How to run

```
<command to run these tests — fill once the test harness exists>
```

## Definition of done
- [ ] All tests above pass.
- [ ] Every acceptance criterion in `requirements.md` is covered.
- [ ] If a **full design path** ran, the tests encode the **chosen** option from `design-review.md` (not a generic UI).
- [ ] `qa-report.md` is clean (no unresolved CRITICAL/HIGH).

> The full release checklist is the **Definition of Done** in `docs/WORKFLOW.md` (Phase 6).
