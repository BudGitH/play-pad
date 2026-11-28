# QA Report (Post-Run Findings): Kampung Quest playability round

> **Phase 4 output.** Five lenses ran as **independent agents in parallel** (ACCURACY, QUALITY, COMPLIANCE, RISK, plus the optional ACCESSIBILITY + PERFORMANCE lens, since the round has a large UI surface and a stated draw-call budget). Each lens got the requirements, the test plan and its slice of `docs/CODE_QUALITY.md`, ran the real tools, and was told to find problems, not confirm the work. Fixes went through one fix agent; a separate round-2 verifier then checked every claimed fix and hunted regressions. Detail: the fix ledger `qa-fixes-round1.md` (finding → change → test, rounds 1 and 2).

**Feature:** Kampung Quest playability round (map, mounts, hero choice, vehicles, cards, life, looks, iPad, simple actions)
**Ticket:** PLAY-014
**Run at:** 2026-11-28 (round 1 at `1971c30`; round-2 verification at `ec678d8`; final code `0664acd`)
**Overall result:** [x] PASS (no CRITICAL / HIGH found in any round; every MEDIUM fixed or explicitly deferred below)

---

## Gate summary

| Lens (dimension)            | Round 1 verdict | Findings (C / H / M / L) | Round 2 (verifier)                             | Blocking? |
| --------------------------- | --------------- | ------------------------ | ---------------------------------------------- | --------- |
| ACCURACY                    | PASS            | 0 / 0 / 2 / 6            | all fixes verified                             | no        |
| QUALITY                     | PASS            | 0 / 0 / 4 / 9            | all fixes verified                             | no        |
| COMPLIANCE                  | PASS            | 0 / 0 / 2 / 5            | all fixes verified                             | no        |
| RISK (security)             | PASS            | 0 / 0 / 0 / 2            | verified                                       | no        |
| ACCESSIBILITY + PERFORMANCE | PASS            | 0 / 0 / 6 / 6            | 1 regression (N1) + 1 partial (N2), both fixed | no        |
| **Round-2 new findings**    | PASS            | 0 / 0 / 2 / 2            | N1-N4 fixed with tests                         | no        |

### STOP_SHIP cleared before merge

The QUALITY lens's standing "checkable but unenforced" finding reached its **4th recurrence** (`docs/findings-ledger.md`, `unenforced-checkable-rules`), which the ledger rules make a release blocker. The systemic fix landed in this PR, following the PLAY-010 / PLAY-012 precedent: `eslint-plugin-jsdoc` `require-jsdoc` (error in Kampung Quest, a can-only-go-down ratchet elsewhere), `tools/check-commented-code.mjs` (in `npm run check`), a V8 coverage gate on Kampung Quest `js/sim` with every named function exercised (`tools/check-sim-tested.mjs`, in `npm run test:kq`), and a PR-title workflow (`.github/workflows/pr-title.yml`). Each tool was proven by a planted violation that failed, then reverted. `docs/ENFORCEMENT.md` has no `NOT_CONFIGURED` rows left. **Owner action:** mark "PR title" a required check in branch protection (a repo setting, not a file).

### Test results (final code `0664acd`)

| Suite                                                                                                    | Result                                                                                                  |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run check` (eslint incl. jsdoc, lint ratchet, commented-code, prettier)                             | clean: 0 errors, 1084 baselined warnings (the jsdoc ratchet on the other games), none new               |
| `npm run secrets`                                                                                        | clean                                                                                                   |
| `npm run test:kq` (sim unit tests + V8 coverage gate)                                                    | all pass; coverage ok (0 untested functions)                                                            |
| Playwright, all projects, `--grep-invert @slow`                                                          | in progress at commit time; result recorded in a follow-up commit                                       |
| Draw calls, low tier (AC-14 sweep: every POI × 4 yaws × day/night + kompang / rain / football + prayers) | worst 317 (`block_a`, 12:00); a11y/perf lens' hand sweep worst 329 (getting out of a car). Budget ≤ 400 |
| Leaks (5 rounds of all events; 6 Makkah ↔ Madinah trips)                                                | geometries, textures, objects flat (one small unexplained bump after trip 6, noted)                     |

## Findings (merged and de-duplicated; ids are the lens's)

### MEDIUM, fixed

| Id             | Lens       | What                                                                                                     | Fix (detail in `qa-fixes-round1.md`)                                                        |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ACC-M1         | accuracy   | traffic, the bus, ridden animals and driven vehicles did not yield to scripted-event actors              | `G.Actors.positions()` in all four people lists; events pause while riding; spec            |
| ACC-M2         | accuracy   | Rest from the Tired bar while driving / riding dropped the hero mid-road                                 | "Get off first, then rest."; spec                                                           |
| COMP-M1        | compliance | traffic / bus / vehicle-life files cited no AC                                                           | AC-P26, AC-P27 + test-plan rows; headers cite them                                          |
| COMP-M2        | compliance | unticked ACs had no recorded status                                                                      | status lines; later P17 built, P28 / P29 added                                              |
| QUAL-M1        | quality    | nine older KQ specs ran in no CI job                                                                     | `smoke:kq:core` + a Probes leg; driver files in path filters                                |
| QUAL-M2        | quality    | dead `Missions.pickTarget` kept alive by tests                                                           | deleted; intent moved to `action-order.test.mjs`                                            |
| QUAL-M3        | quality    | game contract drifted ("not yet in CI", "~50 scripts")                                                   | corrected                                                                                   |
| QUAL-M4        | quality    | standing unenforced-rules finding (4th → STOP_SHIP)                                                      | systemic fix above                                                                          |
| A11Y-1         | a11y       | H / "-" acted through the Pause sheet (un-paused, then lost wudu progress)                               | `canHide()` guard; spec                                                                     |
| A11Y-2 + N2    | a11y       | the map overview hid headline places (incl. the horse stable); the first fix could push icons off-canvas | headline icons slide aside within the canvas or drop into "+N more"; unit + spec at 2 sizes |
| A11Y-3, A11Y-4 | a11y       | keyboard focus lost on the chooser in crowds and after "Go here"                                         | stable DOM signature + focus restore; spec                                                  |
| A11Y-5         | a11y       | label-in-name (WCAG 2.5.3): "Eat" / "Buy"                                                                | `nameFor()` starts with the visible word                                                    |
| A11Y-6         | a11y       | hero picker focus order (WCAG 2.4.3)                                                                     | picker focused on a first run; Home / End                                                   |
| A11Y-7         | a11y       | countdown chatter in the polite live region                                                              | region built at boot; countdown announced at most twice                                     |
| N1             | round 2    | regression: Space after a mouse click re-pressed the button instead of jumping                           | own keyboard-navigation flag (not `:focus-visible`); 3 specs                                |

### LOW, fixed

ACC-L1 / N3 (timed holds freeing a prayer's lock → `Player.lockFor` with tickets), ACC-L2 (Block 118 on the map), ACC-L3 (`lookAhead` NaN for animals), ACC-L4 (distinct people for "Say hi to N"), ACC-L5 (test timeout), ACC-L6 (girl's cut sanitised to a lock; Pause during the Rest fade; hint-key cap, N4 evicts the oldest), RISK-L1 (`Object.create(null)` for heard hints), COMP-L (headers, "Milo" → "Air coklat", CREDITS notes generic signs), QUAL-L1/L2/L4/L5/L6/L7/L9 (dead code, `withDetail` with `finally`, neutral comments, Defer polling, rig-merge per-frame cost, weak assertions, CI path filters), A11Y-L (map chip contrast via `ink`, map canvas role, scooter get-in abort threshold 2.5 m).

### Deferred (not fixed, by decision; in `docs/IDEAS.md` where relevant)

- RISK-L2: `Defer.add` has no cap (every caller is internal and bounded).
- QUAL-L3: four `location.search` parsers; QUAL-L8: `holy-world.js` reaches `KQ.Game.S.crowd` (pre-existing).
- COMP-L7: the second `node_modules` line in `.gitignore` is intentional (the trailing-slash form does not match a symlink).
- A11Y-L: the 15 px title footer links (pre-existing); action changes not announced to assistive tech (IDEAS).
- ACC-L6: ice cream when already full (a treat, by design).

## Known failures at the base commit (so "green" is not overclaimed)

Before this round, `4dc684c` had intermittent failures in the AC spec's barber-columns test (an animation-timing flaw, fixed here) and the portrait azan-pill HUD layouts (a real CSS specificity bug, fixed here). Neither remains.

## Open items (owner)

1. AC-P20 (looks) awaits the owner's visual sign-off; AC-P22 / P23 (iPad) are measured in emulation only: a real-iPad Safari session (the `kq:*` performance marks) is the remaining proof.
2. Mark "PR title" as a required status check.
3. The `Probes` workflow legs (realism, playability, core) are path-filtered and not required checks; confirm the first green run on this PR.
